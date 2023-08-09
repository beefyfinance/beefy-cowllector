import { Prettify } from 'viem/dist/types/types/utils';
import { GasEstimation } from '../lib/gas';
import { BeefyVault } from './vault';
import { Hex } from 'viem';
import { Chain } from './chain';

type Timed<T> = Prettify<T & { startedAt: Date; endedAt: Date; durationSec: number }>;

export type HarvestReport = Timed<{
    chain: Chain;
    items: HarvestReportItem[];
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

export type HarvestReportItem = {
    vault: BeefyVault;
    simulation: Timed<
        | {
              success: true;
              harvestWillSucceed: boolean;
              gas: GasEstimation;
          }
        | { success: false; error: string }
    >;
    strategyData: Timed<
        | {
              success: true;
              lastHarvest: Date;
              paused: boolean;
          }
        | { success: false; error: string }
    > | null; // not started
    harvestDecision: {
        shouldHarvest: boolean;
        hoursSinceLastHarvest: number;
        wouldBeProfitable: boolean;
        notHarvestingReason: 'strategy paused' | 'call rewards too low' | 'not profitable and harvested too recently';
    } | null; // not started
    harvest: Timed<
        | {
              success: true;
              transactionHash: Hex;
          }
        | { success: false; error: string }
    > | null; // not started
    waitingForConfirmations: Timed<
        | {
              success: true;
              blockNumber: number;
              /** Gas used by this transaction */
              gasUsed: bigint;
              /** Pre-London, it is equal to the transaction's gasPrice. Post-London, it is equal to the actual gas price paid for inclusion. */
              effectiveGasPrice: bigint;
          }
        | { success: false }
    > | null; // not started
    summary: {
        harvested: boolean;
        error: boolean;
        profitWei: bigint;
    };
};
