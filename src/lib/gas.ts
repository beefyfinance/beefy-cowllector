import { bigintPercent } from '../util/bigint';
import { HARVEST_OVERESTIMATE_GAS_BY_PERCENT } from '../util/config';

import { Hex, PublicClient } from 'viem';
import { getRedisClient } from '../util/redis';
import { IStrategyABI } from '../abi/IStrategyABI';
import { getWalletAccount } from './rpc-client';
import { Chain } from './chain';
import { rootLogger } from '../util/logger';

const logger = rootLogger.child({ module: 'gas' });

export type GasEstimationResult = { from: 'chain' | 'cache'; estimation: bigint };

export type GasEstimationReport = {
    // input values
    rawGasPrice: bigint;
    rawGasAmountEstimation: GasEstimationResult;
    estimatedCallRewardsWei: bigint;
    overestimateGasByPercent: number;
    // computed values
    gasPrice: bigint;
    transactionCostEstimationWei: bigint;
    estimatedGainWei: bigint;
};

export function createGasEstimationReport({
    rawGasPrice,
    estimatedCallRewardsWei,
    rawGasAmountEstimation,
    overestimateGasByPercent = HARVEST_OVERESTIMATE_GAS_BY_PERCENT,
}: {
    // current network gas price in wei
    rawGasPrice: bigint; // in wei
    // estimation of the gas amount required for the transaction
    rawGasAmountEstimation: GasEstimationResult; // in gas units
    // estimation of the call rewards in wei
    estimatedCallRewardsWei: bigint; // in wei
    // overestimate the gas amount by this percent
    // e.g. 0.1 = 10%
    overestimateGasByPercent?: number;
}): GasEstimationReport {
    const gasPrice = bigintPercent(rawGasPrice, 1.0 + overestimateGasByPercent);
    const transactionCostEstimationWei = rawGasAmountEstimation.estimation * gasPrice;
    const estimatedGainWei = estimatedCallRewardsWei - transactionCostEstimationWei;
    return {
        rawGasPrice,
        rawGasAmountEstimation,
        estimatedCallRewardsWei,
        overestimateGasByPercent,
        gasPrice,
        transactionCostEstimationWei,
        estimatedGainWei,
    };
}

/**
 * Estimate a contract call gas cost by simulating the call.
 *
 * We can't use multicall: https://github.com/mds1/multicall/issues/39#issuecomment-1235732815
 * So we must use eth_estimateGas but we take advantage of the fact that the underlying harvest
 * of strategies is somewhat predictable so we can cache the results of the simulation
 */
export async function estimateHarvestCallGasAmount({
    chain,
    rpcClient,
    strategyAddress,
}: {
    chain: Chain;
    rpcClient: PublicClient;
    strategyAddress: Hex;
}): Promise<GasEstimationResult> {
    const redisClient = await getRedisClient();
    const walletAccount = await getWalletAccount({ chain });

    const cacheKey = `gas-estimation:harvest:${strategyAddress.toLocaleLowerCase()}`;
    const cached = await redisClient.get(cacheKey);
    if (cached) {
        logger.trace({ msg: 'Using cached gas estimation', data: { strategyAddress, cached } });
        return { from: 'cache', estimation: BigInt(cached) };
    }

    logger.trace({ msg: 'Estimating gas cost', data: { strategyAddress } });
    const estimation = await rpcClient.estimateContractGas({
        // we use the lens to avoid having bad estimations on error
        abi: IStrategyABI,
        address: strategyAddress,
        functionName: 'harvest',
        account: walletAccount,
    });

    logger.trace({ msg: 'Gas estimation from chain done', data: { strategyAddress, estimation } });

    await redisClient.set(cacheKey, estimation.toString(), { EX: 60 * 60 * 24 * 7 }); // 1 week

    return { from: 'chain', estimation };
}
