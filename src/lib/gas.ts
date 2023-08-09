import { bigintPercent } from '../util/bigint';
import { HARVEST_OVERESTIMATE_GAS_BY_PERCENT } from '../util/config';

export function estimateTransactionGain({
    rawGasPrice,
    estimatedCallRewardsWei,
    rawGasAmountEstimation,
    overestimateGasByPercent = HARVEST_OVERESTIMATE_GAS_BY_PERCENT,
}: {
    // current network gas price in wei
    rawGasPrice: bigint; // in wei
    // estimation of the gas amount required for the transaction
    rawGasAmountEstimation: bigint; // in gas units
    // estimation of the call rewards in wei
    estimatedCallRewardsWei: bigint; // in wei
    // overestimate the gas amount by this percent
    // e.g. 0.1 = 10%
    overestimateGasByPercent?: number;
}) {
    const gasPrice = bigintPercent(rawGasPrice, 1.0 + overestimateGasByPercent);
    const transactionCostEstimationWei = rawGasAmountEstimation * gasPrice;
    const estimatedGainWei = estimatedCallRewardsWei - transactionCostEstimationWei;
    return {
        estimatedCallRewardsWei,
        transactionCostEstimationWei,
        estimatedGainWei,
    };
}
