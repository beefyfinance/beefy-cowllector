import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../types/chain';
import type { Chain } from '../types/chain';
import { rootLogger } from '../util/logger';
import { getVaultsToMonitor } from '../lib/vault-list';
import { groupBy } from 'lodash';
import type { BeefyVault } from '../types/vault';
import { getReadOnlyRpcClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { HARVEST_AT_LEAST_EVERY_HOURS, RPC_CONFIG } from '../util/config';
import { splitPromiseResultsByStatus } from '../util/promise';
import { StrategyABI } from '../abi/StrategyABI';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain[];
    contractAddress: string | null;
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
        contractAddress: {
            type: 'string',
            demand: false,
            alias: 'a',
            describe: 'only harvest for this contract address',
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
        contractAddress: argv.contractAddress || null,
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
                simulation: await publicClient
                    .simulateContract({
                        ...harvestLensContract,
                        functionName: 'harvest',
                        args: [vault.strategy_address],
                    })
                    .then(({ result, request }) => ({
                        callRewards: result[0],
                        success: result[1],
                        request,
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
    // - last harvest is too recent
    if (chain === 'ethereum') {
        throw new Error('TODO: implement eth logic');
    }
    const stratsToBeHarvested = fetchedStratData
        // check for paused, even though the simulation would fail if that was really the case
        .filter(stratData => {
            const shouldHarvest = !stratData.paused;
            if (!shouldHarvest) {
                logger.debug({ msg: 'Skipping strat due to being paused', data: { chain, stratData } });
            }
            return shouldHarvest;
        })
        // check for last harvest
        .filter(stratData => {
            const hoursSinceLastHarvest = (cmd.now.getTime() - stratData.lastHarvest.getTime()) / 1000 / 60 / 60;
            const shouldHarvest = hoursSinceLastHarvest > HARVEST_AT_LEAST_EVERY_HOURS;
            if (!shouldHarvest) {
                logger.debug({
                    msg: 'Skipping strat due to last harvest being too recent',
                    data: { chain, stratData, hoursSinceLastHarvest },
                });
            }
            return shouldHarvest;
        });
    logger.info({ msg: 'Strategies to be harvested', data: { chain, count: stratsToBeHarvested.length } });
    logger.debug({ msg: 'Strategies to be harvested', data: { chain, stratsToBeHarvested } });

    // now do the havest danse
}

runMain(main);
