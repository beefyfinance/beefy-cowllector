import { Prettify } from 'viem/dist/types/types/utils';
import { GasEstimation } from '../lib/gas';
import { BeefyVault } from './vault';
import { Hex } from 'viem';
import { Chain } from './chain';

type Timed<T> = Prettify<T & { startedAt: Date; endedAt: Date; durationSec: number }>;
type MightFail<T> = Prettify<({ success: true } & T) | { success: false; error: string }>;
type Async<T> = Prettify<Timed<MightFail<T>>>;

export type HarvestReport = Timed<{
    chain: Chain;
    fetchedVaults: Async<{ vaultFetched: number }>;
    details: HarvestReportItem[];
    collectorBalance: {
        /** The balance of the collector before the harvest */
        beforeWei: bigint;
        /** The balance of the collector after the harvest */
        afterWei: bigint;
    };
    summary: {
        totalProfitWei: bigint;
        totalStrategies: number;
        harvested: number;
        skipped: number;
        errors: number;
    };
}>;

type HarvestReportSimulation = Async<{
    harvestWillSucceed: boolean;
    gas: GasEstimation;
}>;

type HarvestReportFetchStrategyData = Async<{
    lastHarvest: Date;
    paused: boolean;
}>;

type HarvestReportDecision = {
    shouldHarvest: boolean;
    hoursSinceLastHarvest: number;
    wouldBeProfitable: boolean;
    notHarvestingReason: 'strategy paused' | 'call rewards too low' | 'not profitable and harvested too recently';
};

type HarvestReportHarvestTransaction = Async<{
    transactionHash: Hex;
}>;

type HarvestReportTransactionReceipt = Async<{
    blockNumber: number;
    /** Gas used by this transaction */
    gasUsed: bigint;
    /** Pre-London, it is equal to the transaction's gasPrice. Post-London, it is equal to the actual gas price paid for inclusion. */
    effectiveGasPrice: bigint;
}>;

export type HarvestReportItem = {
    // context data
    vault: BeefyVault;

    // harvest steps, null: not started
    simulation: HarvestReportSimulation;
    strategyData: HarvestReportFetchStrategyData | null;
    harvestDecision: HarvestReportDecision | null;
    harvestTransaction: HarvestReportHarvestTransaction | null;
    waitingForTransactionReceipt: HarvestReportTransactionReceipt | null;

    // summary
    summary: {
        harvested: boolean;
        error: boolean;
        profitWei: bigint;
    };
};
