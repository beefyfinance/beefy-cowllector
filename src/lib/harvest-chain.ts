import type { Chain } from './chain';
import type { BeefyVault } from './vault';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { HARVEST_AT_LEAST_EVERY_HOURS, HARVEST_OVERESTIMATE_GAS_BY_PERCENT, RPC_CONFIG } from '../util/config';
import { rootLogger } from '../util/logger';
import { createGasEstimationReport, estimateHarvestCallGasAmount } from './gas';
import { reportOnHarvestStep, createDefaultReport, createDefaultReportItem, reportOnAsyncCall } from './harvest-report';
import { IStrategyABI } from '../abi/IStrategyABI';
import { NotEnoughRemainingGasError, UnsupportedChainError } from './harvest-errors';

const logger = rootLogger.child({ module: 'harvest-chain' });

export async function harvestChain({ now, chain, vaults }: { now: Date; chain: Chain; vaults: BeefyVault[] }) {
    logger.debug({ msg: 'Harvesting chain', data: { chain, vaults: vaults.length } });
    const harvestStartedAt = new Date();

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    // create the report objects
    const report = createDefaultReport({ chain });
    var items = vaults.map(vault => ({ vault, report: createDefaultReportItem({ vault }) })); // use var to redefine types along the way
    // add all report item references to the report
    // todo: this is far from ideal, but it works for now, means we have to be careful not to create a copy of the report items
    report.details = items.map(({ report }) => report);

    // we need the harvest lense
    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${chain}`);
    }
    const harvestLensContract = { abi: BeefyHarvestLensABI, address: rpcConfig.contracts.harvestLens };

    const {
        fetchGasPrice: { gasPriceWei: rawGasPrice },
    } = await reportOnAsyncCall({ report }, 'fetchGasPrice', async () => ({
        gasPriceWei: await publicClient.getGasPrice(),
    }));

    const { collectorBalanceBefore } = await reportOnAsyncCall({ report }, 'collectorBalanceBefore', async () => ({
        balanceWei: await publicClient.getBalance({ address: walletAccount.address }),
    }));

    // ==================
    // run the simulation
    // ==================
    const successfulSimulations = await reportOnHarvestStep(items, 'simulation', 'parallel', async item => {
        const { result } = await publicClient.simulateContract({
            ...harvestLensContract,
            functionName: 'harvest',
            args: [item.vault.strategy_address],
        });
        const [estimatedCallRewardsWei, harvestWillSucceed, lastHarvest, strategyPaused] = result;
        return {
            estimatedCallRewardsWei,
            harvestWillSucceed,
            lastHarvest: new Date(Number(lastHarvest) * 1000),
            paused: strategyPaused,
        };
    });

    // ============================
    // Filter out paused strategies
    // ============================
    // use some kind of logic to filter out strats that we don't want to harvest
    if (chain === 'ethereum') {
        throw new UnsupportedChainError({ chain });
    }
    const liveStratsDecisions = await reportOnHarvestStep(
        successfulSimulations,
        'isLiveDecision',
        'parallel',
        async item => {
            if (item.simulation.estimatedCallRewardsWei <= 0n) {
                return {
                    shouldHarvest: false,
                    callRewardsWei: item.simulation.estimatedCallRewardsWei,
                    notHarvestingReason: 'call rewards too low',
                };
            }

            if (item.simulation.paused) {
                return {
                    shouldHarvest: false,
                    notHarvestingReason: 'strategy paused',
                };
            }
            return { shouldHarvest: true };
        }
    );
    const liveStrats = liveStratsDecisions.filter(item => item.isLiveDecision.shouldHarvest);

    // ===========================================
    // Gas Estimation for profitability estimation
    // ===========================================

    const successfulEstimations = await reportOnHarvestStep(liveStrats, 'gasEstimation', 'sequential', async item => {
        const gasEst = await estimateHarvestCallGasAmount({
            chain,
            rpcClient: publicClient,
            strategyAddress: item.vault.strategy_address,
        });
        return createGasEstimationReport({
            rawGasPrice,
            rawGasAmountEstimation: gasEst,
            estimatedCallRewardsWei: item.simulation.estimatedCallRewardsWei,
            overestimateGasByPercent: HARVEST_OVERESTIMATE_GAS_BY_PERCENT,
        });
    });

    // check for last harvest and profitability
    const harvestDecisions = await reportOnHarvestStep(
        successfulEstimations,
        'harvestDecision',
        'parallel',
        async item => {
            const hoursSinceLastHarvest = (now.getTime() - item.simulation.lastHarvest.getTime()) / 1000 / 60 / 60;
            const wouldBeProfitable = item.gasEstimation.estimatedGainWei > 0n;
            const shouldHarvest = wouldBeProfitable || hoursSinceLastHarvest > HARVEST_AT_LEAST_EVERY_HOURS;
            if (!shouldHarvest) {
                return {
                    shouldHarvest: false,
                    hoursSinceLastHarvest,
                    wouldBeProfitable,
                    callRewardsWei: item.gasEstimation.estimatedCallRewardsWei,
                    estimatedGainWei: item.gasEstimation.estimatedGainWei,
                    notHarvestingReason: 'not profitable and harvested too recently',
                };
            } else {
                return {
                    shouldHarvest: true,
                    hoursSinceLastHarvest,
                    wouldBeProfitable,
                    callRewardsWei: item.gasEstimation.estimatedCallRewardsWei,
                    estimatedGainWei: item.gasEstimation.estimatedGainWei,
                };
            }
        }
    );
    const stratsToBeHarvested = harvestDecisions.filter(item => item.harvestDecision.shouldHarvest);

    // =======================
    // now do the havest dance
    // =======================
    let remainingGas = collectorBalanceBefore.balanceWei;

    logger.debug({ msg: 'Harvesting strats', data: { chain, count: stratsToBeHarvested.length } });
    await reportOnHarvestStep(stratsToBeHarvested, 'harvestTransaction', 'sequential', async item => {
        // check if we have enough gas to harvest
        const remainingGasWei = await publicClient.getBalance({ address: walletAccount.address });
        if (remainingGasWei < item.gasEstimation.transactionCostEstimationWei) {
            logger.info({ msg: 'Not enough gas to harvest', data: { chain, remainingGas, strat: item } });
            const error = new NotEnoughRemainingGasError({
                chain,
                remainingGas,
                transactionCostEstimationWei: item.gasEstimation.transactionCostEstimationWei,
                strategyAddress: item.vault.strategy_address,
            });
            throw error;
        }

        const transactionHash = await walletClient.writeContract({
            abi: IStrategyABI,
            address: item.vault.strategy_address,
            functionName: 'harvest',
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: transactionHash });

        // now we officially harvested the strat
        return {
            transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
            remainingGas,
            // todo: this shouldn't be an estimate
            profitWei: item.gasEstimation.estimatedGainWei - item.gasEstimation.transactionCostEstimationWei,
        };
    });

    // =================
    // update the report
    // =================
    report.details.forEach(item => {
        item.summary = {
            harvested: item.harvestTransaction !== null && item.harvestTransaction.status === 'fulfilled',
            error:
                (item.gasEstimation !== null && item.gasEstimation.status === 'rejected') ||
                (item.simulation !== null && item.simulation.status === 'rejected') ||
                (item.harvestTransaction !== null && item.harvestTransaction.status === 'rejected'),
            profitWei: item.harvestTransaction?.status === 'fulfilled' ? item.harvestTransaction?.value.profitWei : 0n,
        };
    });
    report.summary = {
        errors: report.details.filter(item => item.summary.error).length,
        totalProfitWei: report.details.reduce((acc, item) => acc + item.summary.profitWei, 0n),
        harvested: report.details.filter(item => item.summary.harvested).length,
        skipped: report.details.filter(item => !item.summary.harvested && !item.summary.error).length,
        totalStrategies: report.details.length,
    };

    // getting the collector balance shouldn't prevent us from sending the report

    try {
        const { collectorBalanceAfter } = await reportOnAsyncCall({ report }, 'collectorBalanceAfter', async () => ({
            balanceWei: await publicClient.getBalance({ address: walletAccount.address }),
        }));
        report.summary.totalProfitWei = collectorBalanceAfter.balanceWei - collectorBalanceBefore.balanceWei;
    } catch (e) {
        logger.error({ msg: 'Error getting collector balance after', data: { chain, e } });
    }

    const harvestEndedAt = new Date();
    report.timing = {
        startedAt: harvestStartedAt,
        endedAt: harvestEndedAt,
        durationMs: harvestEndedAt.getTime() - harvestStartedAt.getTime(),
    };

    return report;
}
