import { GasEstimation } from './gas';
import { BeefyVault } from './vault';
import { BaseError, Hex, TimeoutError } from 'viem';
import { Chain } from './chain';
import { Async, Timed, promiseTimings } from '../util/async';
import { DeepPartial } from '../util/object';
import { get, set } from 'lodash';

export type HarvestReport = Timed<{
    chain: Chain;
    details: HarvestReportItem[];
    collectorBalanceBefore: Async<{ balanceWei: bigint }> | null;
    collectorBalanceAfter: Async<{ balanceWei: bigint }> | null;
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

type HarvestReportDecision =
    | {
          shouldHarvest: false;
          callRewardsWei: bigint;
          notHarvestingReason: 'call rewards too low';
      }
    | {
          shouldHarvest: false;
          notHarvestingReason: 'strategy paused';
      }
    | {
          shouldHarvest: false;
          callRewardsWei: bigint;
          hoursSinceLastHarvest: number;
          estimatedGainWei: bigint;
          wouldBeProfitable: boolean;
          notHarvestingReason: 'not profitable and harvested too recently';
      }
    | {
          shouldHarvest: true;
          callRewardsWei: bigint;
          hoursSinceLastHarvest: number;
          estimatedGainWei: bigint;
          wouldBeProfitable: boolean;
      };

type HarvestReportHarvestTransaction = Async<{
    transactionHash: Hex;
}>;

type HarvestReportTransactionReceipt = Async<{
    blockNumber: bigint;
    /** Gas used by this transaction */
    gasUsed: bigint;
    /** Pre-London, it is equal to the transaction's gasPrice. Post-London, it is equal to the actual gas price paid for inclusion. */
    effectiveGasPrice: bigint;
}>;

export type HarvestReportItem = {
    // context data
    vault: BeefyVault;

    // harvest steps, null: not started
    simulation: HarvestReportSimulation | null;
    strategyData: HarvestReportFetchStrategyData | null;
    harvestDecision: HarvestReportDecision | null;
    harvestTransaction: HarvestReportHarvestTransaction | null;
    transactionReceipt: HarvestReportTransactionReceipt | null;

    // summary
    summary: {
        harvested: boolean;
        error: boolean;
        profitWei: bigint;
    };
};

export function createDefaultReport({ chain }: { chain: Chain }): HarvestReport {
    return {
        timing: null,
        chain,
        details: [],
        collectorBalanceBefore: null,
        collectorBalanceAfter: null,
        summary: {
            totalProfitWei: 0n,
            totalStrategies: 0,
            harvested: 0,
            skipped: 0,
            errors: 0,
        },
    };
}

export function createDefaultReportItem({ vault }: { vault: BeefyVault }): HarvestReportItem {
    return {
        vault,

        simulation: null,
        strategyData: null,
        harvestDecision: null,
        harvestTransaction: null,
        transactionReceipt: null,

        summary: {
            harvested: false,
            error: false,
            profitWei: 0n,
        },
    };
}

/**
 * Method to update the report with the result of an async call even if it fails
 * But still throw the error if it fails so our usage of this method is not too confusing
 */
export async function reportOnAsyncCall<T>(make: () => Promise<T>, set: (res: Async<T>) => void): Promise<T> {
    const asyncRes = await promiseTimings(make);
    set(asyncRes);
    if (asyncRes.status === 'rejected') {
        throw asyncRes.reason;
    }
    return asyncRes.value;
}

export function toReportItem<T, O extends DeepPartial<T>>(asyncResult: Async<T>, extract: (o: T) => O): Async<O> {
    if (asyncResult.status === 'rejected') {
        // prettify the error
        const error = asyncResult.reason;
        if (error instanceof TimeoutError) {
            return { status: 'rejected', reason: 'Request timed out', timing: asyncResult.timing } as Async<O>;
        } else if (error instanceof BaseError) {
            // remove abi from the error object
            if (get(error, 'abi')) {
                set(error, 'abi', undefined);
            }
            return { status: 'rejected', reason: error, timing: asyncResult.timing } as Async<O>;
        }
        return asyncResult;
    }
    return { status: 'fulfilled', value: extract(asyncResult.value), timing: asyncResult.timing } as Async<O>;
}

export function toReportItemSummary<T>(asyncResult: Async<T>): Partial<HarvestReportItem['summary']> {
    if (asyncResult.status === 'rejected') {
        return { harvested: false, error: true };
    }
    return {};
}

export function serializeReport(o: DeepPartial<HarvestReport>, pretty: boolean = false): string {
    return JSON.stringify(
        o,
        (_, value) => {
            // handle BigInt
            if (typeof value === 'bigint') {
                return value.toString();
            }
            // handle dates
            if (value instanceof Date) {
                return value.toISOString();
            }
            return value;
        },
        pretty ? 2 : undefined
    );
}
