import yargs from 'yargs';
import { runMain } from '../util/process';
import { Chain, allChainIds } from '../types/chain';
import { rootLogger } from '../util/logger';
import { getVaultsToMonitor } from '../lib/vault-list';
import { groupBy } from 'lodash';
import { BeefyVault } from '../types/vault';
import { getReadOnlyRpcClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { RPC_CONFIG } from '../util/config';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain[];
    contractAddress: string | null;
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
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
        contractAddress: argv.contractAddress || null,
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
    const results = await Promise.all(
        Object.entries(vaultsByChain).map(([chain, vaults]) =>
            harvestChain({ cmd: options, chain: chain as Chain, vaults })
        )
    );
    console.log(options, results);
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
    const results = await Promise.all(
        vaults.map(vault =>
            publicClient.simulateContract({
                ...harvestLensContract,
                functionName: 'harvest',
                args: [vault.strategy_address],
            })
        )
    );

    console.log(results);
}

runMain(main);
