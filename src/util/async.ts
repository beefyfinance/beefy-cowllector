import { Prettify } from 'viem/dist/types/types/utils';

export type Timed<T> = Prettify<T & { timing: { startedAt: Date; endedAt: Date; durationMs: number } | null }>;
export type Async<T> = Prettify<Timed<PromiseSettledResult<T>>>;

/**
 * Make an async call
 */
export async function promiseTimings<T>(createPromise: () => Promise<T>): Promise<Async<T>> {
    const startedAt = new Date();
    const timings = (startedAt: Date) => {
        const endedAt = new Date();
        const durationMs = endedAt.getTime() - startedAt.getTime();
        return { startedAt, endedAt, durationMs };
    };

    try {
        const result = await createPromise();
        return { status: 'fulfilled', value: result, timing: timings(startedAt) };
    } catch (error) {
        return { status: 'rejected', reason: error as any, timing: timings(startedAt) };
    }
}
