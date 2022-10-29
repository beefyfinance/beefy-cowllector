import * as REDIS from 'redis';

let redisClient:
  | ReturnType<typeof REDIS.createClient>
  | Promise<ReturnType<typeof REDIS.createClient>>
  | undefined;

const initRedis = async (): Promise<ReturnType<typeof REDIS.createClient>> => {
  const client = REDIS.createClient({
    url: process.env.REDISCLOUD_URL || 'redis://localhost:6379',
  });
  client.on('ready', () => console.log('Redis ready'));
  client.on('end', () => console.log('Redis closed'));
  client.on('error', (err: unknown) => console.log('Redis error: ', err));

  await client.connect();
  // await loadCachedValues();
  return client;
}; //const initRedis = async () : typeof EDIS.createClient
if (!redisClient) redisClient = initRedis();

export const setKey = async (key: string, value: any): Promise<void> => {
  if (!redisClient) return;
  if (redisClient instanceof Promise && !(redisClient = await redisClient)) return;

  try {
    await redisClient.set(key, JSON.stringify(value));
  } catch (err: unknown) {
    console.log(`Failed storing value for Redis key "${key}": `, err);
  }
};

export const getKey = async (key: string): Promise<any> => {
  if (!redisClient) return;
  if (redisClient instanceof Promise && !(redisClient = await redisClient)) return;

  try {
    let value: string | null = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err: unknown) {
    console.log(`Failed getting value for Redis key "${key}": `, err);
  }
};

export async function redisDisconnect(): Promise<void> {
  if (!redisClient) return;
  if (redisClient instanceof Promise && !(redisClient = await redisClient)) return;

  await redisClient.quit();
  redisClient = undefined;
}
