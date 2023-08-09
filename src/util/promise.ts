import { Prettify } from 'viem/dist/types/types/utils';

export function splitPromiseResultsByStatus<T>(results: PromiseSettledResult<T>[]) {
    const rejected = results
        .filter(
            (result): result is Prettify<Exclude<typeof result, PromiseFulfilledResult<any>>> =>
                result.status === 'rejected'
        )
        .map(result => result.reason);
    const fulfilled = results
        .filter(
            (result): result is Prettify<Exclude<typeof result, PromiseRejectedResult>> => result.status === 'fulfilled'
        )
        .map(result => result.value);
    return { fulfilled, rejected };
}
