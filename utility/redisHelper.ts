import 'dotenv/config';
import * as REDIS from 'redis';
import {logger} from '../utility/Logger';

const _logger = logger.getLogger( 'RedisClient');
let redisClient: ReturnType< typeof REDIS.createClient> | Promise< ReturnType< 
																				typeof REDIS.createClient>> | undefined;


const initRedis = async () : 
												Promise< ReturnType< typeof REDIS.createClient>> => {
  const client = REDIS.createClient( {url: process.env.REDISCLOUD_URL || 
																										 'redis://localhost:6379'});
	client.on( 'ready', () => _logger.info( 'Redis ready'));
	client.on( 'end', () => _logger.info( 'Redis closed'));
  client.on( 'error', (error: unknown) => _logger.error( `Redis error: ${
																																			error}`));
  
  await client.connect();
  // await loadCachedValues();
  return client;
}; //const initRedis = async () : typeof EDIS.createClient
if (!redisClient)
	redisClient = initRedis();


export const setKey = async (key: string, value: any) : Promise< void> => {
  if (!redisClient)
		return;
	if (redisClient instanceof Promise && !(redisClient = await redisClient))
		return;

  try {
    await redisClient.set( key, JSON.stringify( value));
  } catch (error: unknown) {
    _logger.error( `Failed storing value for Redis key "${key}": ${error}`);
  }
};


export const getKey = async (key: string) : Promise< any> => {
  if (!redisClient)
		return;
	if (redisClient instanceof Promise && !(redisClient = await redisClient))
		return;

  try {
    let value: string | null = await redisClient.get( key);
    return value ? JSON.parse( value) : null;
  } catch (error: unknown) {
    _logger.error( `Failed getting value for Redis key "${key}": ${error}`);
  }
};


export async function redisDisconnect()	: Promise< void> {
	if (!redisClient)
		return;
	if (redisClient instanceof Promise && !(redisClient = await redisClient))
		return;

	await redisClient.quit();
	redisClient = undefined;
}
