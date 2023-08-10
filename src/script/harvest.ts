import yargs from 'yargs';
import { runMain } from '../util/process';
import { allChainIds } from '../lib/chain';
import type { Chain } from '../lib/chain';
import { rootLogger } from '../util/logger';
import { getVaultsToMonitor } from '../lib/vault-list';
import { harvestChain } from '../lib/harvest-chain';
import { Hex } from 'viem';
import { serializeReport } from '../lib/harvest-report';
import { splitPromiseResultsByStatus } from '../util/promise';

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
    const { fulfilled: successfulReports, rejected: rejectedReports } = splitPromiseResultsByStatus(
        await Promise.allSettled(
            Object.entries(vaultsByChain).map(([chain, vaults]) =>
                harvestChain({ now: options.now, chain: chain as Chain, vaults })
            )
        )
    );
    console.log(rejectedReports);
    logger.trace({ msg: 'harvest results', data: { successfulReports, rejectedReports } });
    logger.debug({
        msg: 'Some chains errored',
        data: { count: rejectedReports.length, rejectedReports },
    });

    successfulReports.forEach(r => console.log(serializeReport(r, true)));
}

runMain(main);
