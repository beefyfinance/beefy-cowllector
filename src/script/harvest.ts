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

import yargs from 'yargs';
import { runMain } from '../util/process';
import { Chain, allChainIds } from '../types/chain';

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
        block: {
            type: 'number',
            demand: false,
            alias: 'b',
            describe: 'harvest for this block',
        },
    }).argv;

    const options = {
        chain: argv.chain.includes('all') ? allChainIds : (argv.chain as Chain[]),
        contractAddress: argv.contractAddress || null,
        block: argv.block || null,
    };

    console.log(options);
}

runMain(main);
