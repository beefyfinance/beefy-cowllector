import Decimal from 'decimal.js';
import dotenv from 'dotenv';
import type { Chain } from '../types/chain';
import { allLogLevels } from '../types/logger';
import type { LogLevels } from '../types/logger';
import type { RpcConfig } from '../types/rpc';
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

// sometimes the programmer error dump is too large and interferes with the log buffers
// this messes up the log output. set to true to disable the dump
export const DISABLE_PROGRAMMER_ERROR_DUMP = process.env.DISABLE_PROGRAMMER_ERROR_DUMP === 'true';

export const BEEFY_API_URL = process.env.BEEFY_API_URL || 'https://api.beefy.finance';

const log_level = process.env.LOG_LEVEL || 'info';
if (!allLogLevels.includes(log_level)) {
    throw new Error(`Invalid log level ${log_level}`);
}

export const LOG_LEVEL: LogLevels = log_level as LogLevels;

export const RPC_FORCE_URL = process.env.RPC_FORCE_URL || null;
export const HARVEST_AT_LEAST_EVERY_HOURS = parseInt(process.env.HARVEST_AT_LEAST_EVERY_HOURS || '24', 10);

const defaultBatch: RpcConfig['batch'] = {
    jsonRpc: {
        batchSize: 1,
        wait: undefined,
    },
    multicall: {
        batchSize: 50,
        wait: 100,
    },
};
const defaultContracts: RpcConfig['contracts'] = {
    harvestLens: '0x2f7bf1B19A9c30C64b13Fd9cD368DdeF24027Ba8',
};

export const RPC_CONFIG: Record<Chain, RpcConfig> = {
    arbitrum: {
        url: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    aurora: {
        url: process.env.AURORA_RPC_URL || 'https://testnet.aurora.dev',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    avax: {
        url: process.env.AVALANCHE_RPC_URL || 'https://api.avax.network/ext/bc/C/rpc',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    base: {
        url: process.env.BASE_RPC_URL || 'https://api.s0.b.hmny.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    bsc: {
        url: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org/',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    canto: {
        url: process.env.CANTO_RPC_URL || 'https://canto-rpc.finance.vote',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    celo: {
        url: process.env.CELO_RPC_URL || 'https://forno.celo.org',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    cronos: {
        url: process.env.CRONOS_RPC_URL || 'https://cronos-testnet.crypto.org:8545',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    emerald: {
        url: process.env.EMERALD_RPC_URL || 'https://ethereum.rpc.emeraldpay.io',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    ethereum: {
        url: process.env.ETHEREUM_RPC_URL || 'https://mainnet.infura.io/v3/84842078b09946638c03157f83405213',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    fantom: {
        url: process.env.FANTOM_RPC_URL || 'https://rpcapi.fantom.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    fuse: {
        url: process.env.FUSE_RPC_URL || 'https://rpc.fuse.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    heco: {
        url: process.env.HECO_RPC_URL || 'https://http-mainnet.hecochain.com',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    kava: {
        url: process.env.KAVA_RPC_URL || 'https://rpc.kava.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    metis: {
        url: process.env.METIS_RPC_URL || 'https://api.metis.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    moonbeam: {
        url: process.env.MOONBEAM_RPC_URL || 'https://rpc.testnet.moonbeam.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    moonriver: {
        url: process.env.MOONRIVER_RPC_URL || 'https://rpc.moonriver.moonbeam.network',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    one: {
        url: process.env.ONE_RPC_URL || 'https://api.s0.t.hmny.io',
        eol: true,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    optimism: {
        url: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    polygon: {
        url: process.env.POLYGON_RPC_URL || 'https://rpc-mainnet.maticvigil.com',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    zkevm: {
        url: process.env.ZKEVM_RPC_URL || 'https://zkevm-testnet.iohkdev.io:443',
        eol: false,
        batch: defaultBatch,
        contracts: defaultContracts,
    },
    zksync: {
        url: process.env.ZKSYNC_RPC_URL || 'https://api.zksync.io/jsrpc',
        eol: false,
        batch: defaultBatch,
        contracts: {
            ...defaultContracts,
            harvestLens: null,
        },
    },
};
