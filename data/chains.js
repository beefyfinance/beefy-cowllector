require('dotenv').config();
const {addressBook} = require( 'blockchain-addressbook');

const {
  aurora,
  arbitrum,
  bsc,
  avax,
  polygon,
  fantom,
  celo,
  moonriver,
  cronos,
  fuse,
  metis,
  moonbeam,
  emerald,
  optimism,
	kava,
	canto,
	zksync
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
    harvestHourInterval: process.env.BSC_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.BSC_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.BSC_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.BSC_RPC || 'https://bsc-dataseed2.defibit.io/',
    multicall: bsc.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    firstRewardBlock: 1457038,
    blockTime: 3,
    blockExplorer: 'http://bscscan.com',
    gas: {
      limit: Number(process.env.BSC_GAS_LIMIT) || 2.33e6,
      price: Number(process.env.BSC_GAS_PRICE) || 5e9,
			priceOverride: Number( process.env.BSC_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.BSC_GAS_PRICE_CAP)
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
    hasOnChainHarvesting: true,
    addressHarvester: '0xFf49e0289b6D07372aB3B3B3CEC2dEE6788F2418',
    addressHarvesterOperations: '0x8aB6aDbC1fec4F18617C9B889F5cE7F28401B8dB',
    harvestHourInterval: process.env.AVAX_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.AVAX_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.AVAX_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.AVAX_RPC || 'https://api.avax.network/ext/bc/C/rpc',
    multicall: avax.platforms.beefyfinance.multicall,
    queryLimit: 512,
    queryInterval: 100,
    blockTime: 2,
    blockExplorer: 'https://snowtrace.io',
    gas:	{
      limit: Number( process.env.AVAX_GAS_LIMIT) || 2.33e6,
      price: Number( process.env.AVAX_GAS_PRICE) || 35e9,
			priceOverride: Number( process.env.AVAX_GAS_PRICE_OVERRIDE),
      priceCap: Number( process.env.AVAX_GAS_PRICE_CAP)
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
    harvestHourInterval: process.env.POLYGON_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.POLYGON_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.POLYGON_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.POLYGON_RPC || 'https://polygon-rpc.com/',
    multicall: polygon.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 2,
    blockExplorer: 'https://polygonscan.com',
    gas: {
      limit: Number(process.env.POLYGON_GAS_LIMIT) || 2e6,
      price: Number(process.env.POLYGON_GAS_PRICE) || 40e9,
			priceOverride: Number( process.env.POLYGON_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.POLYGON_GAS_PRICE_CAP)
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
    hasOnChainHarvesting: true,
    addressHarvester: '0x5e7F411EE92838275c96438B6A1A93acCC16364C',
    addressHarvesterOperations: '0x6EDe1597c05A0ca77031cBA43Ab887ccf24cd7e8',
    harvestHourInterval: process.env.FANTOM_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.FANTOM_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.FANTOM_WNATIVE_MIN_TO_UNWRAP || '1',
    rpc: process.env.FANTOM_RPC || 'https://rpcapi.fantom.network',
    multicall: fantom.platforms.beefyfinance.multicall,
    queryLimit: 500,
    queryInterval: 100,
    blockTime: 10,
    blockExplorer: 'https://ftmscan.com',
    gas: {
      limit: Number(process.env.FANTOM_GAS_LIMIT) || 9.5e6,
      price: Number(process.env.FANTOM_GAS_PRICE) || 1e9,
			priceOverride: Number( process.env.FANTOM_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.FANTOM_GAS_PRICE_CAP)
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
    harvestHourInterval: process.env.ARBITRUM_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.ARBITRUM_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 8,
    wnativeMinToUnwrap: process.env.ARBITRUM_WNATIVE_MIN_TO_UNWRAP || '0.005',
    rpc: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    multicall: arbitrum.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 2.8,
    blockExplorer: 'https://arbiscan.com',
    gas: {
      limit: Number( process.env.ARBITRUM_GAS_LIMIT) || 2.33e6,
      price: Number( process.env.ARBITRUM_GAS_PRICE) || 1e8,
			priceOverride: Number( process.env.ARBITRUM_GAS_PRICE_OVERRIDE),
      priceCap: Number( process.env.ARBITRUM_GAS_PRICE_CAP)
    },
  },
  42220: {
    id: 'celo',
    chainId: 42220,
    wnative: celo.tokens.WNATIVE.address,
    rewardPool: celo.platforms.beefyfinance.rewardPool,
    treasury: celo.platforms.beefyfinance.treasury,
    beefyFeeBatcher: celo.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 1,
    harvestHourInterval: process.env.CELO_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.CELO_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.CELO_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.CELO_RPC || 'https://forno.celo.org',
    multicall: celo.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 5,
    blockExplorer: 'https://explorer.celo.org/',
    gas: {
      limit: Number(process.env.CELO_GAS_LIMIT) || 5e6,
      price: Number(process.env.CELO_GAS_PRICE) || 5e8,
			priceOverride: Number( process.env.CELO_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.CELO_GAS_PRICE_CAP)
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
    harvestHourInterval: process.env.MOONRIVER_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.MOONRIVER_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.MOONRIVER_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.MOONRIVER_RPC || 'https://moonriver.api.onfinality.io/public',
    multicall: moonriver.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 15,
    blockExplorer: 'https://moonriver.moonscan.io/',
    gas: {
      limit: Number(process.env.MOONRIVER_GAS_LIMIT) || 5e6,
      price: Number(process.env.MOONRIVER_GAS_PRICE) || 1e9,
			priceOverride: Number( process.env.MOONRIVER_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.MOONRIVER_GAS_PRICE_CAP)
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
    harvestHourInterval: process.env.CRONOS_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.CRONOS_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.CRONOS_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.CRONOS_RPC || 'https://evm.cronos.org',
    multicall: cronos.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 5,
    blockExplorer: 'https://cronoscan.com',
    gas: {
      limit: Number(process.env.CRONOS_GAS_LIMIT) || 2e6,
      price: Number(process.env.CRONOS_GAS_PRICE) || 5e12,
			priceOverride: Number( process.env.CRONOS_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.CRONOS_GAS_PRICE_CAP)
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
    harvestHourInterval: process.env.FUSE_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.FUSE_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.FUSE_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.FUSE_RPC || 'https://rpc.fuse.io',
    multicall: fuse.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 5,
    blockExplorer: 'https://explorer.fuse.io/',
    gas: {
      limit: Number(process.env.FUSE_GAS_LIMIT) || 7e6,
      price: Number(process.env.FUSE_GAS_PRICE) || 1e9,
			priceOverride: Number( process.env.FUSE_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.FUSE_GAS_PRICE_CAP)
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
    harvestHourInterval: process.env.METIS_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.METIS_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.METIS_WNATIVE_MIN_TO_UNWRAP || '0.05',
    rpc: process.env.METIS_RPC || 'https://andromeda.metis.io/?owner=1088',
    multicall: metis.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 1,
    blockExplorer: 'https://andromeda-explorer.metis.io/',
    gas: {
      limit: Number(process.env.METIS_GAS_LIMIT) || 7e6,
      price: Number(process.env.METIS_GAS_PRICE) || 30e9,
			priceOverride: Number( process.env.METIS_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.METIS_GAS_PRICE_CAP)
    },
  },
  1313161554: {
    id: 'aurora',
    chainId: 1313161554,
    wnative: aurora.tokens.WNATIVE.address,
    rewardPool: aurora.platforms.beefyfinance.rewardPool,
    treasury: aurora.platforms.beefyfinance.treasury,
    beefyFeeBatcher: aurora.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 2,
    harvestHourInterval: process.env.AURORA_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.AURORA_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.AURORA_WNATIVE_MIN_TO_UNWRAP || '0.005',
    rpc:
      process.env.AURORA_RPC ||
      'https://mainnet.aurora.dev/Fon6fPMs5rCdJc4mxX4kiSK1vsKdzc3D8k6UF8aruek',
    multicall: aurora.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 1,
    blockExplorer: 'https://explorer.mainnet.aurora.dev/',
    gas: {
      limit: Number(process.env.AURORA_GAS_LIMIT) || 0,
      price: Number(process.env.AURORA_GAS_PRICE) || 0,
			priceOverride: Number( process.env.AURORA_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.AURORA_GAS_PRICE_CAP)
    },
  },
  1284: {
    id: 'moonbeam',
    chainId: 1284,
    wnative: moonbeam.tokens.WNATIVE.address,
    rewardPool: moonbeam.platforms.beefyfinance.rewardPool,
    treasury: moonbeam.platforms.beefyfinance.treasury,
    beefyFeeBatcher: moonbeam.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 12,
    harvestHourInterval: process.env.MOONBEAM_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.MOONBEAM_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.MOONBEAM_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.MOONBEAM_RPC || 'https://rpc.api.moonbeam.network',
    multicall: moonbeam.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 1,
    blockExplorer: 'https://moonscan.io/',
    gas: {
      limit: Number( process.env.MOONBEAM_GAS_LIMIT) || 2.33e6,
      price: Number( process.env.MOONBEAM_GAS_PRICE) || 100e9,
			priceOverride: Number( process.env.MOONBEAM_GAS_PRICE_OVERRIDE),
      priceCap: Number( process.env.MOONBEAM_GAS_PRICE_CAP)
    }
  },
  42262: {
    id: 'emerald',
    chainId: 42262,
    wnative: emerald.tokens.WNATIVE.address,
    rewardPool: emerald.platforms.beefyfinance.rewardPool,
    treasury: emerald.platforms.beefyfinance.treasury,
    beefyFeeBatcher: emerald.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 12,
    harvestHourInterval: process.env.OASIS_HARVEST_HOUR_INTERVAL
      ? parseInt(process.env.OASIS_HARVEST_HOUR_INTERVAL)
      : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.OASIS_WNATIVE_MIN_TO_UNWRAP || '0.1',
    rpc: process.env.OASIS_RPC || 'https://emerald.oasis.dev',
    multicall: emerald.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 6,
    blockExplorer: 'https://explorer.emerald.oasis.dev/',
    gas: {
      limit: Number(process.env.OASIS_GAS_LIMIT) || 7e6,
      price: Number(process.env.OASIS_GAS_PRICE) || 100e9,
			priceOverride: Number( process.env.OASIS_GAS_PRICE_OVERRIDE),
      priceCap: Number(process.env.OASIS_GAS_PRICE_CAP)
    },
  },
  10: {
    id: 'optimism',
    chainId: 10,
    wnative: optimism.tokens.WNATIVE.address,
    rewardPool: optimism.platforms.beefyfinance.rewardPool,
    treasury: optimism.platforms.beefyfinance.treasury,
    beefyFeeBatcher: optimism.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 12,
    hasOnChainHarvesting: false,
    addressHarvester: '0xC181FDE612a22DD5013E87461b9c6D9791339E82',
    addressHarvesterOperations: '0x340759c8346A1E6Ed92035FB8B6ec57cE1D82c2c',
    harvestHourInterval: process.env.OPTIMISM_HARVEST_HOUR_INTERVAL ? 
											parseInt( process.env.OPTIMISM_HARVEST_HOUR_INTERVAL) : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.OPTIMISM_WNATIVE_MIN_TO_UNWRAP || '0.005',
    rpc: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io',
    multicall: optimism.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 2,
    blockExplorer: 'https://optimistic.etherscan.io/',
    gas: {
      //AT: To be clear, "price" is the minimum price. I got the limit default 
			//	via https://www.npmjs.com/package/@eth-optimism/contracts/v/0.5.0
      limit: Number( process.env.OPTIMISM_GAS_LIMIT) || 9e6,
      price: Number( process.env.OPTIMISM_GAS_PRICE) || 0.001e9,
			priceOverride: Number( process.env.OPTIMISM_GAS_PRICE_OVERRIDE),
      priceCap: Number( process.env.OPTIMISM_GAS_PRICE_CAP)
    }
  },
  7700: {
    id: 'canto',
    chainId: 7700,
    wnative: canto.tokens.WNATIVE.address,
    rewardPool: canto.platforms.beefyfinance.rewardPool,
    treasury: canto.platforms.beefyfinance.treasury,
    beefyFeeBatcher: canto.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 12,
    hasOnChainHarvesting: false,
    harvestHourInterval: process.env.CANTO_HARVEST_HOUR_INTERVAL ? 
												parseInt( process.env.CANTO_HARVEST_HOUR_INTERVAL) : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.CANTO_WNATIVE_MIN_TO_UNWRAP || '0.5',
    rpc: process.env.CANTO_RPC || 'https://mainnode.plexnode.org:8545',
    multicall: canto.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 6,						//observed
    blockExplorer: 'https://tuber.build/',
    gas:	{
      limit: Number( process.env.CANTO_GAS_LIMIT) || 2.33e6,
      price: Number( process.env.CANTO_GAS_PRICE) || 1001e9, //observed minimum
			priceOverride: Number( process.env.CANTO_GAS_PRICE_OVERRIDE),
      priceCap: Number( process.env.CANTO_GAS_PRICE_CAP)
    } 
  }, 
  2222: {
    id: 'kava',
    chainId: 2222,
    wnative: kava.tokens.WNATIVE.address,
    rewardPool: kava.platforms.beefyfinance.rewardPool,
    treasury: kava.platforms.beefyfinance.treasury,
    beefyFeeBatcher: kava.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 12,
    hasOnChainHarvesting: false,
    harvestHourInterval: process.env.KAVA_HARVEST_HOUR_INTERVAL ? 
												parseInt( process.env.KAVA_HARVEST_HOUR_INTERVAL) : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.KAVA_WNATIVE_MIN_TO_UNWRAP || '0.5',
    rpc: process.env.KAVA_RPC || 'https://evm.kava.io',
    multicall: kava.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 6,						//observed
    blockExplorer: 'https://explorer.kava.io/',
    gas:	{
      limit: Number( process.env.KAVA_GAS_LIMIT) || 2.33e6,
      price: Number( process.env.KAVA_GAS_PRICE) || 1e9, //observed minimum
			priceOverride: Number( process.env.KAVA_GAS_PRICE_OVERRIDE),
      priceCap: Number( process.env.KAVA_GAS_PRICE_CAP)
    }
  },
  324: {
    id: 'zksync',
    chainId: 324,
    wnative: zksync.tokens.WNATIVE.address,
    rewardPool: zksync.platforms.beefyfinance.rewardPool,
    treasury: zksync.platforms.beefyfinance.treasury,
    beefyFeeBatcher: zksync.platforms.beefyfinance.beefyFeeRecipient,
    beefyFeeHarvestInterval: 12,
    hasOnChainHarvesting: false,
    harvestHourInterval: process.env.ZKSYNC_HARVEST_HOUR_INTERVAL ? 
												parseInt( process.env.ZKSYNC_HARVEST_HOUR_INTERVAL) : 4,
    wnativeUnwrapInterval: 4,
    wnativeMinToUnwrap: process.env.ZKSYNC_WNATIVE_MIN_TO_UNWRAP || '0.005',
    rpc: process.env.ZKSYNC_RPC || 'https://mainnet.era.zksync.io',
    multicall: zksync.platforms.beefyfinance.multicall,
    queryLimit: 1000,
    queryInterval: 100,
    blockTime: 3,						//observed
    blockExplorer: 'https://explorer.zksync.io',
    gas:	{
      limit: Number( process.env.ZKSYNC_GAS_LIMIT) || 2.33e6, //guess
      price: Number( process.env.ZKSYNC_GAS_PRICE) || 0.25e9, //observed minimum
			priceOverride: Number( process.env.ZKSYNC_GAS_PRICE_OVERRIDE),
      priceCap: Number( process.env.ZKSYNC_GAS_PRICE_CAP)
    }
  }
};

module.exports = chains;
