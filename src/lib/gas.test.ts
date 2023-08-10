import { GasEstimationResult, createGasEstimationReport } from './gas';

describe('gas', () => {
    it('should estimate transaction gain', () => {
        const input = {
            rawGasPrice: 100n,
            estimatedCallRewardsWei: 1000n,
            rawGasAmountEstimation: { from: 'cache', estimation: 100n } satisfies GasEstimationResult,
            overestimateGasByPercent: 0.5,
        };
        expect(createGasEstimationReport(input)).toEqual({
            ...input,
            gasPrice: 150n,
            transactionCostEstimationWei: 15000n,
            estimatedGainWei: -14000n,
        });
    });

    it('should account for overestimation parameter', () => {
        const input = {
            rawGasPrice: 100n,
            estimatedCallRewardsWei: 1000n,
            rawGasAmountEstimation: { from: 'cache', estimation: 100n } satisfies GasEstimationResult,
            overestimateGasByPercent: 0.0,
        };
        expect(createGasEstimationReport(input)).toEqual({
            ...input,
            gasPrice: 100n,
            transactionCostEstimationWei: 10000n,
            estimatedGainWei: -9000n,
        });
    });
});
