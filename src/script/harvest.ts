import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../types/chain';
import type { Chain } from '../types/chain';
import { rootLogger } from '../util/logger';
import { getVaultsToMonitor } from '../lib/vault-list';
import { harvestChain } from '../lib/harvest-chain';
import { Hex } from 'viem';

const logger = rootLogger.child({ module: 'harvest-main' });

type CmdOptions = {
    chain: Chain[];
    contractAddress: Hex | null;
    now: Date;
};

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
        now: {
            type: 'string',
            demand: false,
            alias: 'n',
            describe: 'force the current date time instead of using Date.now()',
        },
    }).argv;

    const options: CmdOptions = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
        contractAddress: (argv['contract-address'] || null) as Hex | null,
        now: argv.now ? new Date(argv.now) : new Date(Date.now()),
    };
    logger.trace({ msg: 'running with options', data: options });

    // fetch vaults from beefy api
    const vaultsByChain = await getVaultsToMonitor({ chains: options.chain, contractAddress: options.contractAddress });

    // harvest each chain
    const results = await Promise.allSettled(
        Object.entries(vaultsByChain).map(([chain, vaults]) =>
            harvestChain({ now: options.now, chain: chain as Chain, vaults })
        )
    );
    console.log({ where: 'end of harvest script', options, results });
}

runMain(main);
