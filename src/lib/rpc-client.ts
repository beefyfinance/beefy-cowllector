import { createPublicClient, createWalletClient, http } from 'viem';
import { Chain } from './chain';
import { privateKeyToAccount } from 'viem/accounts';
import { RPC_FORCE_URL, RPC_FORCE_PRIVATE_KEY, RPC_CONFIG } from '../util/config';
import type { Chain as ViemChain } from 'viem/chains';
import {
    arbitrum,
    aurora,
    avalanche,
    base,
    bsc,
    canto,
    celo,
    cronos,
    fantom,
    mainnet,
    harmonyOne,
    polygon,
    moonbeam,
    moonriver,
    metis,
    optimism,
    polygonZkEvm,
    zkSync,
} from 'viem/chains';
import { addressBook } from 'blockchain-addressbook';

const fuse = {
    id: addressBook.fuse.tokens.FUSE.chainId,
    name: 'Fuse',
    network: 'fuse',
    nativeCurrency: {
        decimals: addressBook.fuse.tokens.FUSE.decimals,
        name: addressBook.fuse.tokens.FUSE.name,
        symbol: addressBook.fuse.tokens.FUSE.name,
    },
    rpcUrls: {
        // we will use our own http transport anyway
        public: { http: [] },
        default: { http: [] },
    },
    blockExplorers: {
        default: { name: 'Fuse Explorer', url: 'https://explorer.fuse.io' },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 16_146_628,
        },
    },
} as const satisfies ViemChain;

const kava = {
    id: addressBook.kava.tokens.KAVA.chainId,
    name: 'Kava',
    network: 'kava',
    nativeCurrency: {
        decimals: addressBook.kava.tokens.KAVA.decimals,
        name: addressBook.kava.tokens.KAVA.name,
        symbol: addressBook.kava.tokens.KAVA.name,
    },
    rpcUrls: {
        // we will use our own http transport anyway
        public: { http: [] },
        default: { http: [] },
    },
    blockExplorers: {
        default: { name: 'Kava Explorer', url: 'https://explorer.kava.io/' },
    },
    contracts: {
        multicall3: {
            address: '0xcA11bde05977b3631167028862bE2a173976CA11',
            blockCreated: 3_661_165,
        },
    },
} as const satisfies ViemChain;

const VIEM_CHAINS: Record<Chain, ViemChain | null> = {
    arbitrum: arbitrum,
    aurora: aurora,
    avax: avalanche,
    base: base,
    bsc: bsc,
    canto: canto,
    celo: celo,
    cronos: cronos,
    fantom: fantom,
    ethereum: mainnet,
    emerald: null,
    one: harmonyOne,
    heco: null,
    fuse: fuse,
    kava: kava,
    polygon: polygon,
    moonbeam: moonbeam,
    moonriver: moonriver,
    metis: metis,
    optimism: optimism,
    zkevm: polygonZkEvm,
    zksync: zkSync,
};

// the view read only client has more options for batching
export function getReadOnlyRpcClient({ chain }: { chain: Chain }) {
    const rpcConfig = RPC_CONFIG[chain];
    const url = RPC_FORCE_URL || rpcConfig.url;
    return createPublicClient({
        transport: http(url, {
            batch: rpcConfig.batch.jsonRpc,
        }),
        batch: {
            multicall: rpcConfig.batch.multicall,
        },
    });
}

export function getWalletClient({ chain }: { chain: Chain }) {
    const rpcConfig = RPC_CONFIG[chain];
    const url = RPC_FORCE_URL || rpcConfig.url;
    const viemChain = VIEM_CHAINS[chain];
    if (!viemChain) {
        throw new Error(`Unsupported chain ${chain}`);
    }
    if (RPC_FORCE_URL) {
        viemChain.rpcUrls = {
            default: { http: [RPC_FORCE_URL] },
            public: { http: [RPC_FORCE_URL] },
        };
    }

    return createWalletClient({
        chain: viemChain,
        account: getWalletAccount({ chain }),
        transport: http(url, {
            batch: false,
        }),
    });
}

export function getWalletAccount({ chain }: { chain: Chain }) {
    const rpcConfig = RPC_CONFIG[chain];
    const pk = RPC_FORCE_PRIVATE_KEY || rpcConfig.account.privateKey;
    return privateKeyToAccount(pk);
}
