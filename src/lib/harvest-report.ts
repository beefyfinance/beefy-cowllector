import { GasEstimationReport } from './gas';
import { BeefyVault } from './vault';
import { BaseError, Hex, TimeoutError } from 'viem';
import { Chain } from './chain';
import { Async, AsyncSuccessType, TimingData, promiseTimings } from '../util/async';
import { get, set } from 'lodash';
import { runSequentially, splitPromiseResultsByStatus } from '../util/promise';
import { rootLogger } from '../util/logger';
import { Prettify } from 'viem/dist/types/types/utils';

const logger = rootLogger.child({ module: 'harvest-report' });

export type HarvestReport = {
    timing: TimingData | null;
    chain: Chain;
    details: HarvestReportItem[];
    fetchGasPrice: Async<{ gasPriceWei: bigint }> | null;
    collectorBalanceBefore: Async<{ balanceWei: bigint }> | null;
    collectorBalanceAfter: Async<{ balanceWei: bigint }> | null;
    summary: {
        totalProfitWei: bigint;
        totalStrategies: number;
        harvested: number;
        skipped: number;
        errors: number;
    };
};

type HarvestReportSimulation = Async<{
    estimatedCallRewardsWei: bigint;
    harvestWillSucceed: boolean;
    lastHarvest: Date;
    paused: boolean;
}>;

type HarvestReportGasEstimation = Async<GasEstimationReport>;

type HarvestReportIsLiveDecision =
    | {
          shouldHarvest: false;
          notHarvestingReason: 'strategy paused';
      }
    | {
          shouldHarvest: false;
          notHarvestingReason: 'vault is eol';
      }
    | {
          shouldHarvest: true;
      };

type HarvestReportShouldHarvestDecision =
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
    blockNumber: bigint;
    profitWei: bigint;
    /** Gas used by this transaction */
    gasUsed: bigint;
    /** Pre-London, it is equal to the transaction's gasPrice. Post-London, it is equal to the actual gas price paid for inclusion. */
    effectiveGasPrice: bigint;
}>;

type HarvestReportItem = {
    // context data
    vault: BeefyVault;

    // harvest steps, null: not started
    simulation: HarvestReportSimulation | null;
    isLiveDecision: HarvestReportIsLiveDecision | null;
    gasEstimation: HarvestReportGasEstimation | null;
    harvestDecision: HarvestReportShouldHarvestDecision | null;
    harvestTransaction: HarvestReportHarvestTransaction | null;

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
        fetchGasPrice: null,
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
        gasEstimation: null,
        isLiveDecision: null,
        harvestDecision: null,
        harvestTransaction: null,

        summary: {
            harvested: false,
            error: false,
            profitWei: 0n,
        },
    };
}

/**
 * This type is used to properly type the result of the helper functions belo
 */
type ExpectedResponseType<TReport, TReportKey extends string> = TReportKey extends keyof TReport
    ? AsyncSuccessType<TReport[TReportKey]>
    : never;

/**
 * Method to update the report with the result of an async call even if it fails
 * But still throw the error if it fails so our usage of this method is not too confusing
 *
 * Takes care of:
 * - logging and tracing
 * - error handling
 * - updating the report
 * - timing the calls
 * - properly typing the result
 */
export async function reportOnAsyncCall<
    TItem extends { report: HarvestReport },
    TReportKey extends keyof HarvestReport,
>(
    item: TItem,
    reportKey: TReportKey,
    make: (item: TItem) => Promise<ExpectedResponseType<HarvestReport, TReportKey>>
): Promise<TItem & { [k in TReportKey]: ExpectedResponseType<HarvestReport, TReportKey> }> {
    logger.info({ msg: 'Running async call', data: { reportKey } });
    const result = await promiseTimings(() => make(item));
    if (result.status === 'rejected') {
        logger.error({ msg: 'Report step failed', data: { reportKey, item, error: result.reason } });
        // @ts-ignore
        item.report[reportKey] = formatAsyncResult(result);
        throw result.reason;
    } else {
        logger.trace({ msg: 'Report step succeeded', data: { reportKey, item, result } });
        // @ts-ignore
        item.report[reportKey] = formatAsyncResult(result);
        return { ...item, [reportKey]: result.value } as TItem & {
            [k in TReportKey]: ExpectedResponseType<HarvestReport, TReportKey>;
        };
    }
}

/**
 * Run a report step on a list of items
 * Takes care of:
 * - logging and tracing
 * - error handling
 * - updating the report
 * - returning the successful results only
 * - timing the calls
 * - running in parallel or sequentially
 * - adding the result to the items themselves
 * - properly typing the result
 */
export async function reportOnHarvestStep<
    TItem extends { report: HarvestReportItem },
    TReportKey extends keyof HarvestReportItem,
>(
    items: TItem[],
    reportKey: TReportKey,
    mode: 'parallel' | 'sequential',
    make: (item: TItem) => Promise<ExpectedResponseType<HarvestReportItem, TReportKey>>
): Promise<Prettify<TItem & { [k in TReportKey]: ExpectedResponseType<HarvestReportItem, TReportKey> }>[]> {
    logger.info({ msg: 'Running report step', data: { reportKey, itemsCount: items.length } });

    const processItem = async (item: TItem) => {
        const result = await promiseTimings(() => make(item));
        if (result.status === 'rejected') {
            logger.error({ msg: 'Report step failed', data: { reportKey, item, error: result.reason } });
            // @ts-ignore
            item.report[reportKey] = formatAsyncResult(result);
            throw result.reason;
        } else {
            logger.trace({ msg: 'Report step succeeded', data: { reportKey, item, result } });
            // @ts-ignore
            item.report[reportKey] = formatAsyncResult(result);
            return { ...item, [reportKey]: result.value } as TItem & {
                [k in TReportKey]: ExpectedResponseType<HarvestReportItem, TReportKey>;
            };
        }
    };

    const results = await (mode === 'parallel'
        ? Promise.allSettled(items.map(processItem))
        : runSequentially(items, processItem));
    const { fulfilled, rejected } = splitPromiseResultsByStatus(results);

    logger.info({
        msg: 'Report step results',
        data: { reportKey, itemsCount: items.length, fulfilledCount: fulfilled.length, rejectedCount: rejected.length },
    });
    if (rejected.length > 0) {
        logger.debug({ msg: 'Skipped items', data: { reportKey, items: rejected.length } });
    }
    logger.trace({ msg: 'Report step finished', data: { reportKey, itemsCount: items.length, fulfilled, rejected } });

    return fulfilled;
}

/**
 * Format an async result to make it more readable, especially for errors
 */
function formatAsyncResult<T>(asyncResult: Async<T>): Async<T> {
    if (asyncResult.status === 'rejected') {
        // prettify the error
        const error = asyncResult.reason;
        if (error instanceof TimeoutError) {
            return { status: 'rejected', reason: 'Request timed out', timing: asyncResult.timing } as Async<T>;
        } else if (error instanceof BaseError) {
            // remove abi from the error object
            if (get(error, 'abi')) {
                set(error, 'abi', undefined);
            }
            return { status: 'rejected', reason: error, timing: asyncResult.timing } as Async<T>;
        } else if (error instanceof Error) {
            error;
            return {
                status: 'rejected',
                reason: { name: error.name, message: error.message, cause: error.cause, stack: error.stack },
                timing: asyncResult.timing,
            } as Async<T>;
        }
        return asyncResult;
    }
    return { status: 'fulfilled', value: asyncResult.value, timing: asyncResult.timing } as Async<T>;
}

/**
 * JSON.stringify cannot handle BigInt and set a good format for dates, so we need to serialize it ourselves
 */
export function serializeReport(o: object, pretty: boolean = false): string {
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
