import { createPublicClient, createWalletClient, http } from 'viem';
import { Chain } from '../types/chain';
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
    fuse: null, // TODO: add fuse https://viem.sh/docs/clients/chains.html#build-your-own
    kava: null, // TODO: add kava https://viem.sh/docs/clients/chains.html#build-your-own
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
    const pk = RPC_FORCE_PRIVATE_KEY || rpcConfig.account.privateKey;

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
        account: privateKeyToAccount(pk),
        transport: http(url, {
            batch: false,
        }),
    });
}
