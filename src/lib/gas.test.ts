import { estimateTransactionGain } from './gas';

describe('gas', () => {
    it('should estimate transaction gain', () => {
        expect(
            estimateTransactionGain({
                rawGasPrice: 100n,
                estimatedCallRewardsWei: 1000n,
                rawGasAmountEstimation: 100n,
                overestimateGasByPercent: 0.5,
            })
        ).toEqual({
            estimatedCallRewardsWei: 1000n,
            transactionCostEstimationWei: 15000n,
            estimatedGainWei: -14000n,
        });
    });

    it('should account for overestimation parameter', () => {
        expect(
            estimateTransactionGain({
                rawGasPrice: 100n,
                estimatedCallRewardsWei: 1000n,
                rawGasAmountEstimation: 100n,
                overestimateGasByPercent: 0.0,
            })
        ).toEqual({
            estimatedCallRewardsWei: 1000n,
            transactionCostEstimationWei: 10000n,
            estimatedGainWei: -9000n,
        });
    });
});
