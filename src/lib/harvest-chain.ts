import type { Chain } from '../types/chain';
import type { BeefyVault } from '../types/vault';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { HARVEST_AT_LEAST_EVERY_HOURS, RPC_CONFIG } from '../util/config';
import { runSequentially, splitPromiseResultsByStatus } from '../util/promise';
import { StrategyABI } from '../abi/StrategyABI';
import { rootLogger } from '../util/logger';
import { estimateTransactionGain } from './gas';

const logger = rootLogger.child({ module: 'harvest-chain' });

export async function harvestChain({ now, chain, vaults }: { now: Date; chain: Chain; vaults: BeefyVault[] }) {
    logger.debug({ msg: 'Harvesting chain', data: { chain, vaults: vaults.length } });

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    // we need the harvest lense
    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${chain}`);
    }
    const harvestLensContract = {
        abi: BeefyHarvestLensABI,
        address: rpcConfig.contracts.harvestLens,
    };

    const rawGasPrice = await publicClient.getGasPrice();

    // run the simulation
    logger.debug({ msg: 'Running simulation', data: { chain, vaults: vaults.length } });
    const { fulfilled: successfulSimulations, rejected: failedSimulations } = splitPromiseResultsByStatus(
        await Promise.allSettled(
            vaults.map(async vault => ({
                vault,
                simulation: await Promise.all([
                    publicClient.simulateContract({
                        ...harvestLensContract,
                        functionName: 'harvest',
                        args: [vault.strategy_address],
                    }),
                    publicClient.estimateContractGas({
                        ...harvestLensContract,
                        functionName: 'harvest',
                        args: [vault.strategy_address],
                        account: walletAccount,
                    }),
                ]).then(([{ result, request }, rawGasAmountEstimation]) => ({
                    request,
                    harvestWillSucceed: result[1],
                    gas: estimateTransactionGain({
                        rawGasPrice,
                        estimatedCallRewardsWei: result[0],
                        rawGasAmountEstimation,
                    }),
                })),
            }))
        )
    );
    logger.debug({ msg: 'Simulation results', data: { chain, failedSimulations, successfulSimulations } });
    logger.info({
        msg: 'Skipping simulation errors',
        data: { chain, count: failedSimulations.length, failedSimulations },
    });

    // get `paused` and `lastHarvest` from the strategies
    // TODO: add this in the lens contract and remove this code?
    logger.debug({
        msg: 'Fetching additional strategy data',
        data: { chain, strategyCount: successfulSimulations.length },
    });
    const { fulfilled: fetchedStratData, rejected: failedStratData } = splitPromiseResultsByStatus(
        await Promise.allSettled(
            successfulSimulations.map(simulation =>
                Promise.all([
                    Promise.resolve(simulation),
                    publicClient.readContract({
                        abi: StrategyABI,
                        address: simulation.vault.strategy_address,
                        functionName: 'lastHarvest',
                    }),
                    publicClient.readContract({
                        abi: StrategyABI,
                        address: simulation.vault.strategy_address,
                        functionName: 'paused',
                    }),
                ]).then(([simulation, lastHarvest, paused]) => ({
                    ...simulation,
                    lastHarvest: new Date(Number(lastHarvest) * 1000),
                    paused,
                }))
            )
        )
    );
    logger.debug({ msg: 'Additional data results', data: { chain, failedStratData, fetchedStratData } });
    logger.info({
        msg: 'Skipping strats due to error fetching additional data',
        data: { chain, count: failedStratData.length, failedStratData },
    });

    // use some kind of logic to filter out strats that we don't want to harvest
    if (chain === 'ethereum') {
        throw new Error('TODO: implement eth logic');
    }
    const stratsToBeHarvested = fetchedStratData
        // check for callRewards
        .filter(stratData => {
            const shouldHarvest = stratData.simulation.gas.estimatedCallRewardsWei > 0n;
            if (!shouldHarvest) {
                logger.trace({ msg: 'Skipping strat due to callRewards being 0', data: { chain, stratData } });
            } else {
                logger.trace({ msg: 'Strat has callRewards', data: { chain, stratData } });
            }
            return shouldHarvest;
        })
        // check for paused, even though the simulation would fail if that was really the case
        .filter(stratData => {
            const shouldHarvest = !stratData.paused;
            if (!shouldHarvest) {
                logger.trace({ msg: 'Skipping strat due to being paused', data: { chain, stratData } });
            } else {
                logger.trace({ msg: 'Strat is not paused', data: { chain, stratData } });
            }
            return shouldHarvest;
        })
        // check for last harvest and profitability
        .filter(stratData => {
            const hoursSinceLastHarvest = (now.getTime() - stratData.lastHarvest.getTime()) / 1000 / 60 / 60;
            const wouldBeProfitable = stratData.simulation.gas.estimatedGainWei > 0n;
            const shouldHarvest = wouldBeProfitable || hoursSinceLastHarvest > HARVEST_AT_LEAST_EVERY_HOURS;
            if (!shouldHarvest) {
                logger.trace({
                    msg: 'Skipping strat due to last harvest being too recent and not profitable',
                    data: { chain, stratData, wouldBeProfitable, hoursSinceLastHarvest },
                });
            } else {
                logger.trace({
                    msg: 'Strat should be harvested',
                    data: { chain, stratData, wouldBeProfitable, hoursSinceLastHarvest },
                });
            }
            return shouldHarvest;
        });
    logger.info({ msg: 'Strategies to be harvested', data: { chain, count: stratsToBeHarvested.length } });
    logger.debug({ msg: 'Strategies to be harvested', data: { chain, stratsToBeHarvested } });

    // now do the havest dance
    logger.debug({ msg: 'Harvesting strats', data: { chain, count: stratsToBeHarvested.length } });
    const { fulfilled: successfulHarvests, rejected: failedHarvests } = splitPromiseResultsByStatus(
        await runSequentially(stratsToBeHarvested, async strat => {
            logger.debug({ msg: 'Harvesting strat', data: { chain, strat } });
            const harvestTransactionHash = await walletClient.writeContract(strat.simulation.request);

            // we have to wait for the transaction to be minted in order for the next call to have a proper nonce
            const harvestReceipt = await publicClient.waitForTransactionReceipt({ hash: harvestTransactionHash });
            const res = { ...strat, harvestTransactionHash, harvestReceipt };
            logger.debug({ msg: 'Harvested strat', data: { chain, strat, res } });
            return res;
        })
    );
    logger.debug({ msg: 'Harvest results', data: { chain, failedHarvests, successfulHarvests } });
    logger.info({ msg: 'Skipping strats due to error harvesting', data: { chain, count: failedHarvests.length } });
}
