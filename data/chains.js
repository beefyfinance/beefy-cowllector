require('dotenv').config();
const { addressBook } = require('blockchain-addressbook');

const {
  aurora,
  arbitrum,
  bsc,
  heco,
  avax,
  polygon,
  fantom,
  one,
  celo,
  moonriver,
  cronos,
  fuse,
  metis,
} = addressBook;

const chains = {
  56: {
    id: 'bsc',
    chainId: 56,
    wnative: bsc.tokens.WNATIVE.address,
    rewardPool: bsc.platforms.beefyfinance.rewardPool,
    notifyInterval: 10,
    treasury: bsc.platforms.beefyfinance.treasury,
    beefyFeeBatcher: bsc.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 4,
    harvestHourInterval: parseInt(process.env.BSC_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 8,
    wnativeMintoUnwrap: parseInt(process.env.BSC_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.BSC_RPC || 'https://bsc-dataseed2.defibit.io/',
    appVaultsFilename: 'bsc_pools.js',
    multicall: bsc.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    firstRewardBlock: 1457038,
    blockTime: 3,
    blockExplorer: 'http://bscscan.com',
    gas: {
      limit: Number(process.env.BSC_GAS_LIMIT) || 2e7,
      price: Number(process.env.BSC_GAS_PRICE) || 5e9,
    },
  },
  128: {
    id: 'heco',
    chainId: 128,
    wnative: heco.tokens.WNATIVE.address,
    rewardPool: heco.platforms.beefyfinance.rewardPool,
    treasury: heco.platforms.beefyfinance.treasury,
    beefyFeeBatcher: heco.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 4,
    harvestHourInterval: parseInt(process.env.HECO_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 4,
    wnativeMintoUnwrap: parseInt(process.env.HECO_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.HECO_RPC || 'https://http-mainnet.hecochain.com',
    appVaultsFilename: 'heco_pools.js',
    multicall: heco.platforms.beefyfinance.multicall,
    queryLimit: 2000,
    queryInterval: 100,
    blockTime: 3,
    blockExplorer: 'https://hecoinfo.com',
    gas: {
      limit: Number(process.env.HECO_GAS_LIMIT) || 30e6,
      price: Number(process.env.HECO_GAS_PRICE) || 3e9,
    },
  },
  43114: {
    id: 'avax',
    chainId: 43114,
    wnative: avax.tokens.WNATIVE.address,
    rewardPool: avax.platforms.beefyfinance.rewardPool,
    treasury: avax.platforms.beefyfinance.treasury,
    beefyFeeBatcher: avax.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 8,
    harvestHourInterval: parseInt(process.env.AVAX_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 8,
    wnativeMintoUnwrap: parseInt(process.env.AVAX_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.AVAX_RPC || 'https://api.avax.network/ext/bc/C/rpc',
    appVaultsFilename: 'avalanche_pools.js',
    multicall: avax.platforms.beefyfinance.multicall,
    queryLimit: 512,
    queryInterval: 100,
    blockTime: 5,
    blockExplorer: 'https://cchain.explorer.avax.network',
    gas: {
      limit: Number(process.env.AVAX_GAS_LIMIT) || 1e6,
      price: Number(process.env.AVAX_GAS_PRICE) || 30e9,
    },
  },
  137: {
    id: 'polygon',
    chainId: 137,
    wnative: polygon.tokens.WNATIVE.address,
    rewardPool: polygon.platforms.beefyfinance.rewardPool,
    treasury: polygon.platforms.beefyfinance.treasury,
    beefyFeeBatcher: polygon.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 1,
    harvestHourInterval: parseInt(process.env.POLYGON_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 4,
    wnativeMintoUnwrap: parseInt(process.env.POLYGON_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.POLYGON_RPC || 'https://polygon-rpc.com/',
    appVaultsFilename: 'polygon_pools.js',
    multicall: polygon.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 2,
    blockExplorer: 'https://polygonscan.com',
    gas: {
      limit: Number(process.env.POLYGON_GAS_LIMIT) || 2e6,
      price: Number(process.env.POLYGON_GAS_PRICE) || 40e9,
    },
  },
  250: {
    id: 'fantom',
    chainId: 250,
    wnative: fantom.tokens.WNATIVE.address,
    rewardPool: fantom.platforms.beefyfinance.rewardPool,
    treasury: fantom.platforms.beefyfinance.treasury,
    beefyFeeBatcher: fantom.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 1,
    harvestHourInterval: parseInt(process.env.FANTOM_HARVEST_HOUR_INTERVAL) || 4,
    wnativeUnwrapInterval: 4,
    wnativeMintoUnwrap: parseInt(process.env.FANTOM_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.FANTOM_RPC || 'https://rpcapi.fantom.network',
    appVaultsFilename: 'fantom_pools.js',
    multicall: fantom.platforms.beefyfinance.multicall,
    queryLimit: 500,
    queryInterval: 100,
    blockTime: 10,
    blockExplorer: 'https://ftmscan.com',
    gas: {
      limit: Number(process.env.FANTOM_GAS_LIMIT) || 3e6,
      price: Number(process.env.FANTOM_GAS_PRICE) || 350e9,
    },
  },
  1666600000: {
    id: 'one',
    chainId: 1666600000,
    wnative: one.tokens.WNATIVE.address,
    rewardPool: one.platforms.beefyfinance.rewardPool,
    treasury: one.platforms.beefyfinance.treasury,
    beefyFeeBatcher: one.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 1,
    harvestHourInterval: parseInt(process.env.ONE_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 4,
    wnativeMintoUnwrap: parseInt(process.env.ONE_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.ONE_RPC || 'https://api.s0.t.hmny.io/',
    appVaultsFilename: 'harmony_pools.js',
    multicall: one.platforms.beefyfinance.multicall,
    queryLimit: 500,
    queryInterval: 100,
    blockTime: 3,
    blockExplorer: 'https://explorer.harmony.one/',
    gas: {
      limit: Number(process.env.ONE_GAS_LIMIT) || 1e6,
      price: Number(process.env.ONE_GAS_PRICE) || null,
    },
  },
  42161: {
    id: 'arbitrum',
    chainId: 42161,
    wnative: arbitrum.tokens.WNATIVE.address,
    rewardPool: arbitrum.platforms.beefyfinance.rewardPool,
    treasury: arbitrum.platforms.beefyfinance.treasury,
    beefyFeeBatcher: arbitrum.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 8,
    harvestHourInterval: parseInt(process.env.ARBITRUM_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 20,
    wnativeMintoUnwrap: parseInt(process.env.ARBITRUM_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    appVaultsFilename: 'arbitrum_pools.js',
    multicall: arbitrum.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 2.8,
    blockExplorer: 'http://arbiscan.com',
    gas: {
      limit: Number(process.env.ARBITRUM_GAS_LIMIT) || 30e6,
      price: Number(process.env.ARBITRUM_GAS_PRICE) || 5e9,
    },
  },
  42220: {
    id: 'celo',
    chainId: 42220,
    rewardPool: celo.platforms.beefyfinance.rewardPool,
    treasury: celo.platforms.beefyfinance.treasury,
    beefyFeeBatcher: celo.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 1,
    harvestHourInterval: parseInt(process.env.CELO_HARVEST_HOUR_INTERVAL) || 1,
    wnative: null,
    wnativeUnwrapInterval: null,
    wnativeMintoUnwrap: parseInt(process.env.CELO_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.CELO_RPC || 'https://forno.celo.org',
    appVaultsFilename: 'celo_pools.js',
    multicall: celo.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 5,
    blockExplorer: 'https://explorer.celo.org/',
    gas: {
      limit: Number(process.env.CELO_GAS_LIMIT) || 5e6,
      price: Number(process.env.CELO_GAS_PRICE) || 5e8,
    },
  },
  1285: {
    id: 'moonriver',
    chainId: 1285,
    wnative: moonriver.tokens.WNATIVE.address,
    rewardPool: moonriver.platforms.beefyfinance.rewardPool,
    treasury: moonriver.platforms.beefyfinance.treasury,
    beefyFeeBatcher: moonriver.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 2,
    harvestHourInterval: parseInt(process.env.MOONRIVER_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 6,
    wnativeMintoUnwrap: parseInt(process.env.MOONRIVER_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.MOONRIVER_RPC || 'https://rpc.moonriver.moonbeam.network',
    appVaultsFilename: 'moonriver_pools.js',
    multicall: moonriver.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 15,
    blockExplorer: 'https://moonriver.moonscan.io/',
    gas: {
      limit: Number(process.env.MOONRIVER_GAS_LIMIT) || 5e6,
      price: Number(process.env.MOONRIVER_GAS_PRICE) || 1e9,
    },
  },
  25: {
    id: 'cronos',
    chainId: 25,
    wnative: cronos.tokens.WNATIVE.address,
    rewardPool: cronos.platforms.beefyfinance.rewardPool,
    treasury: cronos.platforms.beefyfinance.treasury,
    beefyFeeBatcher: cronos.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 6,
    harvestHourInterval: parseInt(process.env.CRONOS_HARVEST_HOUR_INTERVAL) || 8,
    wnativeUnwrapInterval: 6,
    wnativeMintoUnwrap: parseInt(process.env.CRONOS_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.CRONOS_RPC || 'https://evm-cronos.crypto.org',
    appVaultsFilename: 'cronos_pools.js',
    multicall: cronos.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 5,
    blockExplorer: 'https://cronos.crypto.org/explorer/',
    gas: {
      limit: Number(process.env.CRONOS_GAS_LIMIT) || 1e6,
      price: Number(process.env.CRONOS_GAS_PRICE) || 5e12,
    },
  },
  122: {
    id: 'fuse',
    chainId: 122,
    wnative: fuse.tokens.WNATIVE.address,
    rewardPool: fuse.platforms.beefyfinance.rewardPool,
    treasury: fuse.platforms.beefyfinance.treasury,
    beefyFeeBatcher: fuse.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 1,
    harvestHourInterval: parseInt(process.env.FUSE_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 6,
    wnativeMintoUnwrap: parseInt(process.env.FUSE_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.FUSE_RPC || 'https://rpc.fuse.io',
    appVaultsFilename: 'fuse_pools.js',
    multicall: fuse.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 5,
    blockExplorer: 'https://explorer.fuse.io/',
    gas: {
      limit: Number(process.env.FUSE_GAS_LIMIT) || 10e6,
      price: Number(process.env.FUSE_GAS_PRICE) || 1e9,
    },
  },
  1088: {
    id: 'metis',
    chainId: 1088,
    wnative: null,
    rewardPool: metis.platforms.beefyfinance.rewardPool,
    treasury: metis.platforms.beefyfinance.treasury,
    beefyFeeBatcher: metis.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 4,
    harvestHourInterval: parseInt(process.env.METIS_HARVEST_HOUR_INTERVAL) || 1,
    wnativeUnwrapInterval: 6,
    wnativeMintoUnwrap: parseInt(process.env.METIS_WNATIVE_MIN_TO_UNWRAP) || 1e17,
    rpc: process.env.METIS_RPC || 'https://andromeda.metis.io/?owner=1088',
    appVaultsFilename: 'metis_pools.js',
    multicall: metis.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 1,
    blockExplorer: 'https://andromeda-explorer.metis.io/',
    gas: {
      limit: Number(process.env.METIS_GAS_LIMIT) || 10e6,
      price: Number(process.env.METIS_GAS_PRICE) || 30e9,
    },
  },
  // 1313161554: {
  //   id: 'aurora',
  //   chainId: 1313161554,
  //   wnative: aurora.tokens.WNATIVE.address,
  //   rewardPool: aurora.platforms.beefyfinance.rewardPool,
  //   treasury: aurora.platforms.beefyfinance.treasury,
  //   beefyFeeBatcher: aurora.platforms.beefyfinance.beefyFeeRecipient,
  //   beefyFeeHarvestInterval: 2,
  //   harvestHourInterval: parseInt(process.env.AURORA_HARVEST_HOUR_INTERVAL) || 1,
  //   wnativeUnwrapInterval: 8,
  //   wnativeMintoUnwrap: parseInt(process.env.AURORA_WNATIVE_MIN_TO_UNWRAP) || 1e17,
  //   rpc:
  //     process.env.aurora_RPC ||
  //     'https://mainnet.aurora.dev/Fon6fPMs5rCdJc4mxX4kiSK1vsKdzc3D8k6UF8aruek',
  //   appVaultsFilename: 'aurora_pools.js',
  //   multicall: aurora.platforms.beefyfinance.multicall,
  //   queryLimit: 1000,
  //   queryInterval: 100,
  //   blockTime: 1,
  //   blockExplorer: 'https://explorer.mainnet.aurora.dev/',
  // gas: {
  //   limit: Number(process.env.AURORA_GAS_LIMIT) || 30e6,
  //   price: Number(process.env.AURORA_GAS_PRICE) || 1e9,
  // },
  // },
};

module.exports = chains;
