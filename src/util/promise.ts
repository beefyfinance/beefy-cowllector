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

export async function runSequentially<T, R>(
    items: T[],
    process: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
    const results: PromiseSettledResult<R>[] = [];
    for (const item of items) {
        try {
            const result = await process(item);
            results.push({ status: 'fulfilled', value: result });
        } catch (error) {
            results.push({ status: 'rejected', reason: error });
        }
    }
    return results;
}
