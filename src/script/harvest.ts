import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../types/chain';
import type { Chain } from '../types/chain';
import { rootLogger } from '../util/logger';
import { getVaultsToMonitor } from '../lib/vault-list';
import { groupBy } from 'lodash';
import type { BeefyVault } from '../types/vault';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { HARVEST_AT_LEAST_EVERY_HOURS, HARVEST_OVERESTIMATE_GAS_BY_PERCENT, RPC_CONFIG } from '../util/config';
import { runSequentially, splitPromiseResultsByStatus } from '../util/promise';
import { StrategyABI } from '../abi/StrategyABI';
import { bigintPercent } from '../util/bigint';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain[];
    contractAddress: string | null;
    dryRun: boolean;
    now: Date;
};

/**
 * Steps:
 * - pull vaults from api
 * - split by chain
 * - mc staticall the lense contract
 * - filter out strats given lastharvest and callReward + custom eth logic (prob missing lastharvest here, could pull from db but on chain would be better)
 * - what if it fails?
 * - what if it's stuck forever (i've seen nonce issues before)?
 * - push reports to db
 * - push full debug logs to disk/cdn
 * - send periodic reports to discord (separate thingy)
 */
async function main() {
    const argv = await yargs.usage('$0 <cmd> [args]').options({
        chain: {
            type: 'array',
            choices: [...allChainIds, 'all'],
            alias: 'c',
            demand: false,
            default: 'all',
            describe: 'only harest these chains. eol chains will be ignored',
        },
        'contract-address': {
            type: 'string',
            demand: false,
            alias: 'a',
            describe: 'only harvest for this contract address',
        },
        'dry-run': {
            type: 'boolean',
            demand: false,
            default: false,
            alias: 'd',
            describe: 'do not actually harvest, just simulate',
        },
        now: {
            type: 'string',
            demand: false,
            alias: 'n',
            describe: 'force the current date time instead of using Date.now()',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
        contractAddress: argv['contract-address'] || null,
        dryRun: argv['dry-run'],
        now: argv.now ? new Date(argv.now) : new Date(Date.now()),
    };
    logger.trace({ msg: 'running with options', data: options });

    // fetch vaults from api
    const allVaults = await getVaultsToMonitor();

    // apply command line options
    const vaults = allVaults
        .filter(vault => options.chain.includes(vault.chain))
        .filter(vault => (options.contractAddress ? vault.strategy_address === options.contractAddress : true));
    logger.info({ msg: 'Filtered vaults', data: { vaultLength: vaults.length } });

    // split by chain
    const vaultsByChain = groupBy(vaults, 'chain');
    logger.debug(() => ({
        msg: 'Vaults by chain',
        data: Object.keys(vaultsByChain).map(chain => ({
            chain,
            count: vaultsByChain[chain].length,
        })),
    }));

    // harvest each chain
    const results = await Promise.allSettled(
        Object.entries(vaultsByChain).map(([chain, vaults]) =>
            harvestChain({ cmd: options, chain: chain as Chain, vaults })
        )
    );
    console.log({ where: 'end of harvest script', options, results });
}

async function harvestChain({ cmd, chain, vaults }: { cmd: CmdOptions; chain: Chain; vaults: BeefyVault[] }) {
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
                ]).then(([{ result, request }, gasCostEstimation]) => ({
                    callRewards: result[0],
                    success: result[1],
                    request,
                    rawGasCostEstimation: gasCostEstimation,
                    gasCostEstimation: bigintPercent(gasCostEstimation, 1.0 + HARVEST_OVERESTIMATE_GAS_BY_PERCENT),
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
            const shouldHarvest = stratData.simulation.callRewards > 0n;
            if (!shouldHarvest) {
                logger.debug({
                    msg: 'Skipping strat due to callRewards being 0',
                    data: { chain, stratData },
                });
            }
            return shouldHarvest;
        })
        // check for paused, even though the simulation would fail if that was really the case
        .filter(stratData => {
            const shouldHarvest = !stratData.paused;
            if (!shouldHarvest) {
                logger.debug({ msg: 'Skipping strat due to being paused', data: { chain, stratData } });
            }
            return shouldHarvest;
        })
        // check for last harvest and profitability
        .filter(stratData => {
            const hoursSinceLastHarvest = (cmd.now.getTime() - stratData.lastHarvest.getTime()) / 1000 / 60 / 60;
            const wouldBeProfitable = stratData.simulation.callRewards > stratData.simulation.gasCostEstimation;
            const shouldHarvest = wouldBeProfitable || hoursSinceLastHarvest > HARVEST_AT_LEAST_EVERY_HOURS;
            if (!shouldHarvest) {
                logger.debug({
                    msg: 'Skipping strat due to last harvest being too recent and not profitable',
                    data: { chain, wouldBeProfitable, stratData, hoursSinceLastHarvest },
                });
            }
            return shouldHarvest;
        });
    logger.info({ msg: 'Strategies to be harvested', data: { chain, count: stratsToBeHarvested.length } });
    logger.debug({ msg: 'Strategies to be harvested', data: { chain, stratsToBeHarvested } });

    if (cmd.dryRun) {
        logger.info({ msg: 'Stopping harvest due to dry run', data: { chain, stratsToBeHarvested } });
        return;
    }

    // now do the havest dance
    logger.debug({ msg: 'Harvesting strats', data: { chain, count: stratsToBeHarvested.length } });
    const { fulfilled: successfulHarvests, rejected: failedHarvests } = splitPromiseResultsByStatus(
        await runSequentially(stratsToBeHarvested, async strat => ({
            ...strat,
            harvestTransactionHash: await walletClient.writeContract(strat.simulation.request),
        }))
    );
    logger.debug({ msg: 'Harvest results', data: { chain, failedHarvests, successfulHarvests } });
    logger.info({ msg: 'Skipping strats due to error harvesting', data: { chain, count: failedHarvests.length } });

    // fetch transaction receipts
    logger.debug({ msg: 'Fetching transaction receipts', data: { chain, count: successfulHarvests.length } });
    const { fulfilled: successfulReceipts, rejected: failedReceipts } = splitPromiseResultsByStatus(
        await Promise.allSettled(
            successfulHarvests.map(async strat => ({
                ...strat,
                harvestReceipt: await publicClient.getTransactionReceipt({ hash: strat.harvestTransactionHash }),
            }))
        )
    );

    console.dir({ where: 'end of harvest chain', chain, cmd, successfulReceipts, failedReceipts }, { depth: null });
    logger.debug({ msg: 'Receipt results', data: { chain, failedReceipts, successfulReceipts } });
}

runMain(main);
