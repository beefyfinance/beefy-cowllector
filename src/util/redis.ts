import * as redis from 'redis';
import type { RedisClientType } from 'redis';
import { REDIS_URL } from './config';
import { rootLogger } from './logger';
import { sleep } from './promise';

const logger = rootLogger.child({ module: 'redis' });

let redisClient: RedisClientType | null = null;
let isReady = false;
export async function getRedisClient() {
    if (!redisClient) {
        const startedAt = Date.now();
        redisClient = redis.createClient({
            url: REDIS_URL,
        });

        redisClient.on('error', err => logger.error({ msg: 'Redis Error', data: err }));
        redisClient.on('connect', () => logger.debug({ msg: 'Redis connected' }));
        redisClient.on('reconnecting', () => logger.warn({ msg: 'Redis reconnecting' }));
        redisClient.on('ready', () => {
            isReady = true;
            logger.debug({ msg: 'Redis ready', data: { durationMs: Date.now() - startedAt } });
        });

        redisClient.connect();

        while (!isReady) {
            await sleep(100);
        }
    }

    return redisClient;
}
