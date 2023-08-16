import { Async, AsyncSuccessType, promiseTimings } from './async';
import { sleep } from './promise';

describe('promiseTimings', () => {
    it('should return a successful result', async () => {
        const result = await promiseTimings(() => Promise.resolve('foo'));
        expect(result).toEqual({ status: 'fulfilled', value: 'foo', timing: expect.anything() });
    });

    it('should return a rejected result', async () => {
        const result = await promiseTimings(() => Promise.reject('foo'));
        expect(result).toEqual({ status: 'rejected', reason: 'foo', timing: expect.anything() });
    });

    it('should properly time the call duration', async () => {
        const start = Date.now();
        const result = await promiseTimings(() => sleep(100));
        const stop = Date.now();
        expect(result.timing.startedAt.getTime()).toBeGreaterThanOrEqual(start);
        expect(result.timing.startedAt.getTime()).toBeLessThanOrEqual(stop);
        expect(result.timing.endedAt.getTime()).toBeGreaterThanOrEqual(start);
        expect(result.timing.endedAt.getTime()).toBeLessThanOrEqual(stop);
        expect(result.timing.durationMs).toBeGreaterThanOrEqual(100);
        expect(result.timing.durationMs).toBeLessThan(200);
    });
});

describe('AsyncSuccessType', () => {
    it('should return the success type of a promise', async () => {
        type Output = AsyncSuccessType<Promise<string>>;
        type Expected = string;
        const t: Expected = 'foo' as Output;
        expect(t).toBe('foo');
    });

    it('should return the success type of a promise or null', async () => {
        type Output = AsyncSuccessType<Promise<string> | null>;
        type Expected = string;
        const t: Expected = 'foo' as Output;
        expect(t).toBe('foo');
    });

    it('should return the success type of an async', async () => {
        type Output = AsyncSuccessType<Async<string>>;
        type Expected = string;
        const t: Expected = 'foo' as Output;
        expect(t).toBe('foo');
    });

    it('should return the success type of an async or null', async () => {
        type Output = AsyncSuccessType<Async<string> | null>;
        type Expected = string;
        const t: Expected = 'foo' as Output;
        expect(t).toBe('foo');
    });

    it('should return the success type of a nullable result', async () => {
        type Output = AsyncSuccessType<string | null>;
        type Expected = string;
        const t: Expected = 'foo' as Output;
        expect(t).toBe('foo');
    });

    it('should be passthrough for other cases', async () => {
        type Output = AsyncSuccessType<string>;
        type Expected = string;
        const t: Expected = 'foo' as Output;
        expect(t).toBe('foo');
    });
});
