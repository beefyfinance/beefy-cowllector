import { createPublicClient, http } from 'viem';
import { Chain } from '../types/chain';
import { RPC_FORCE_URL, RPC_CONFIG } from '../util/config';

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
