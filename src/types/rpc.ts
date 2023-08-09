import { Hex, MulticallBatchOptions } from 'viem';
import { BatchOptions } from 'viem/dist/types/clients/transports/http';

export type RpcConfig = {
    url: string;
    eol: boolean;
    batch: {
        // https://viem.sh/docs/clients/transports/http.html#batch-batchsize-optional
        // applies at the transport level
        jsonRpc: BatchOptions;
        // https://viem.sh/docs/clients/public.html#batch-multicall-batchsize-optional
        // only applies for the public client
        multicall: false | MulticallBatchOptions;
    };
    contracts: {
        harvestLens: Hex | null;
    };
};
