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
const REDIS = __importStar(require("redis"));
let redisClient;
const initRedis = async () => {
    const client = REDIS.createClient({ url: process.env.REDISCLOUD_URL ||
            'redis://localhost:6379' });
    client.on('ready', () => console.log('Redis ready'));
    client.on('end', () => console.log('Redis closed'));
    client.on('error', (err) => console.log('Redis error: ', err));
    await client.connect();
    // await loadCachedValues();
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
    catch (err) {
        console.log(`Failed storing value for Redis key "${key}": `, err);
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
    catch (err) {
        console.log(`Failed getting value for Redis key "${key}": `, err);
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
