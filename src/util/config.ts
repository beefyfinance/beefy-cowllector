import dotenv from 'dotenv';
import type { Chain } from '../lib/chain';
import { allLogLevels } from './logger-type';
import type { LogLevels } from './logger-type';
import type { RpcConfig } from '../lib/rpc-config';
import { Hex } from 'viem';
dotenv.config();

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

const RPC_FORCE_URL = process.env.RPC_FORCE_URL || null;
const RPC_FORCE_PRIVATE_KEY = (process.env.RPC_FORCE_PRIVATE_KEY || null) as Hex | null;
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || null;
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
    privateKey: RPC_FORCE_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000000',
};
const defaultTransactionConfig = {
    blockConfirmations: 3,
    timeoutMs: 5 * 60 * 1000,
};
const defaultTimeoutMs = 60_000; // high timeout because we batch calls
const defaultConfig = {
    eol: false,
    timeoutMs: defaultTimeoutMs,
    batch: defaultBatch,
    contracts: defaultContracts,
    account: defaultAccount,
    transaction: defaultTransactionConfig,
};

export const RPC_CONFIG: Record<Chain, RpcConfig> = {
    arbitrum: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ARBITRUM_RPC_URL || 'https://rpc.ankr.com/arbitrum',
    },
    aurora: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AURORA_RPC_URL || 'https://mainnet.aurora.dev',
    },
    avax: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.AVALANCHE_RPC_URL || 'https://rpc.ankr.com/avalanche',
    },
    base: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.BASE_RPC_URL || 'https://rpc.ankr.com/base',
    },
    bsc: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.BSC_RPC_URL || 'https://rpc.ankr.com/bsc',
    },
    canto: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CANTO_RPC_URL || 'https://canto.slingshot.finance',
    },
    celo: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CELO_RPC_URL || 'https://rpc.ankr.com/celo',
        eol: true,
    },
    cronos: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.CRONOS_RPC_URL || 'https://evm.cronos.org',
    },
    emerald: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.EMERALD_RPC_URL || 'https://emerald.oasis.dev',
        eol: true,
    },
    ethereum: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ETHEREUM_RPC_URL || 'https://rpc.ankr.com/eth',
    },
    fantom: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.FANTOM_RPC_URL || 'https://rpc.ankr.com/fantom',
    },
    fuse: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.FUSE_RPC_URL || 'https://rpc.fuse.io',
    },
    heco: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.HECO_RPC_URL || 'https://http-mainnet.hecochain.com',
    },
    kava: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.KAVA_RPC_URL || 'https://evm.kava.io',
    },
    metis: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.METIS_RPC_URL || 'https://andromeda.metis.io/?owner=1088',
    },
    moonbeam: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MOONBEAM_RPC_URL || 'https://rpc.testnet.moonbeam.network',
    },
    moonriver: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.MOONRIVER_RPC_URL || 'https://rpc.api.moonriver.moonbeam.network',
    },
    one: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ONE_RPC_URL || 'https://rpc.ankr.com/harmony',
        eol: true,
    },
    optimism: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.OPTIMISM_RPC_URL || 'https://rpc.ankr.com/optimism',
    },
    polygon: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.POLYGON_RPC_URL || 'https://rpc.ankr.com/polygon',
    },
    zkevm: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ZKEVM_RPC_URL || 'https://rpc.ankr.com/polygon_zkevm',
    },
    zksync: {
        ...defaultConfig,
        url: RPC_FORCE_URL || process.env.ZKSYNC_RPC_URL || 'https://rpc.ankr.com/zksync_era',
        contracts: {
            ...defaultContracts,
            harvestLens: null,
        },
    },
};
