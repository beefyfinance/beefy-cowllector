import Decimal from 'decimal.js';
import dotenv from 'dotenv';
import type { Chain } from '../lib/chain';
import { allLogLevels } from './logger-type';
import type { LogLevels } from './logger-type';
import type { RpcConfig } from '../lib/rpc-config';
import { Hex } from 'viem';
dotenv.config();

Decimal.set({
    // make sure we have enough precision
    precision: 50,
    // configure the Decimals lib to format without exponents
    toExpNeg: -250,
    toExpPos: 250,
});

const timezone = process.env.TZ;
if (timezone !== 'UTC') {
    throw new Error('Please set TZ=UTC in your .env file or command line');
}

export const REDIS_URL = process.env.REDIS_URL || process.env.REDISCLOUD_URL || 'redis://localhost:6379';
export const BEEFY_API_URL = process.env.BEEFY_API_URL || 'https://api.beefy.finance';

const log_level = process.env.LOG_LEVEL || 'info';
if (!allLogLevels.includes(log_level as LogLevels)) {
    throw new Error(`Invalid log level ${log_level}`);
}

export const LOG_LEVEL: LogLevels = log_level as LogLevels;

export const RPC_FORCE_URL = process.env.RPC_FORCE_URL || null;
export const RPC_FORCE_PRIVATE_KEY = (process.env.RPC_FORCE_PRIVATE_KEY || null) as Hex | null;
export const HARVEST_AT_LEAST_EVERY_HOURS = parseInt(process.env.HARVEST_AT_LEAST_EVERY_HOURS || '24', 10);
export const HARVEST_OVERESTIMATE_GAS_BY_PERCENT = parseFloat(process.env.HARVEST_OVERESTIMATE_GAS_BY_PERCENT || '0.5');

const defaultBatch: RpcConfig['batch'] = {
    jsonRpc: {
        batchSize: 1,
        wait: undefined,
    },
    multicall: {
        batchSize: 4_096,
        wait: 100,
    },
};
const defaultContracts: RpcConfig['contracts'] = {
    harvestLens: '0xa9b924a0AaFad0e6aAE25410bc16C205446A11D2',
};
const defaultAccount: RpcConfig['account'] = {
    // TODO: pull from environment variables
    privateKey: '0x0000000000000000000000000000000000000000000000000000000000000000',
};

export const RPC_CONFIG: Record<Chain, RpcConfig> = {
    arbitrum: {
        url: process.env.ARBITRUM_RPC_URL || 'https://rpc.ankr.com/arbitrum',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    aurora: {
        url: process.env.AURORA_RPC_URL || 'https://mainnet.aurora.dev',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    avax: {
        url: process.env.AVALANCHE_RPC_URL || 'https://rpc.ankr.com/avalanche',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    base: {
        url: process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    bsc: {
        url: process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    canto: {
        url: process.env.CANTO_RPC_URL || 'https://canto.slingshot.finance',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    celo: {
        url: process.env.CELO_RPC_URL || 'https://rpc.ankr.com/celo',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    cronos: {
        url: process.env.CRONOS_RPC_URL || 'https://evm.cronos.org',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    emerald: {
        url: process.env.EMERALD_RPC_URL || 'https://emerald.oasis.dev',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    ethereum: {
        url: process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    fantom: {
        url: process.env.FANTOM_RPC_URL || 'https://rpc.ankr.com/fantom',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    fuse: {
        url: process.env.FUSE_RPC_URL || 'https://rpc.fuse.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    heco: {
        url: process.env.HECO_RPC_URL || 'https://http-mainnet.hecochain.com',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    kava: {
        url: process.env.KAVA_RPC_URL || 'https://evm.kava.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    metis: {
        url: process.env.METIS_RPC_URL || 'https://andromeda.metis.io/?owner=1088',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    moonbeam: {
        url: process.env.MOONBEAM_RPC_URL || 'https://rpc.testnet.moonbeam.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    moonriver: {
        url: process.env.MOONRIVER_RPC_URL || 'https://rpc.api.moonriver.moonbeam.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    one: {
        url: process.env.ONE_RPC_URL || 'https://rpc.ankr.com/harmony',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    optimism: {
        url: process.env.OPTIMISM_RPC_URL || 'https://rpc.ankr.com/optimism',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    polygon: {
        url: process.env.POLYGON_RPC_URL || 'https://rpc.ankr.com/polygon',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    zkevm: {
        url: process.env.ZKEVM_RPC_URL || 'https://rpc.ankr.com/polygon_zkevm',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
        account: defaultAccount,
    },
    zksync: {
        url: process.env.ZKSYNC_RPC_URL || 'https://rpc.ankr.com/zksync_era',
        eol: false,
        batch: defaultBatch,
        contracts: {
            ...defaultContracts,
            harvestLens: null,
        },
        account: defaultAccount,
    },
};
