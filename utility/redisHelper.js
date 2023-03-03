"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisDisconnect = exports.getKey = exports.setKey = void 0;
require("dotenv/config");
const REDIS = __importStar(require("redis"));
const Logger_1 = require("../utility/Logger");
const _logger = Logger_1.logger.getLogger('RedisClient');
let redisClient;
const initRedis = async () => {
    const client = REDIS.createClient({ url: process.env.REDISCLOUD_URL ||
            'redis://localhost:6379' });
    client.on('ready', () => _logger.info('Redis ready'));
    client.on('end', () => _logger.info('Redis closed'));
    client.on('error', (error) => _logger.error(`Redis error: ${error}`));
    await client.connect();
    return client;
}; //const initRedis = async () : typeof EDIS.createClient
if (!redisClient)
    redisClient = initRedis();
const setKey = async (key, value) => {
    if (!redisClient)
        return;
    if (redisClient instanceof Promise && !(redisClient = await redisClient))
        return;
    try {
        await redisClient.set(key, JSON.stringify(value));
    }
    catch (error) {
        _logger.error(`Failed storing value for Redis key "${key}": ${error}`);
    }
};
exports.setKey = setKey;
const getKey = async (key) => {
    if (!redisClient)
        return;
    if (redisClient instanceof Promise && !(redisClient = await redisClient))
        return;
    try {
        let value = await redisClient.get(key);
        return value ? JSON.parse(value) : null;
    }
    catch (error) {
        _logger.error(`Failed getting value for Redis key "${key}": ${error}`);
    }
};
exports.getKey = getKey;
async function redisDisconnect() {
    if (!redisClient)
        return;
    if (redisClient instanceof Promise && !(redisClient = await redisClient))
        return;
    await redisClient.quit();
    redisClient = undefined;
}
exports.redisDisconnect = redisDisconnect;
