import type { Chain } from './chain';
import type { BeefyVault } from './vault';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { HARVEST_AT_LEAST_EVERY_HOURS, RPC_CONFIG } from '../util/config';
import { runSequentially, splitPromiseResultsByStatus } from '../util/promise';
import { rootLogger } from '../util/logger';
import { createGasEstimation } from './gas';
import {
    createDefaultReport,
    createDefaultReportItem,
    reportOnAsyncCall,
    toReportItem,
    toReportItemSummary,
} from './harvest-report';
import { typeSafeSet } from '../util/object';
import { Hex } from 'viem';
import { IStrategyABI } from '../abi/IStrategyABI';

const logger = rootLogger.child({ module: 'harvest-chain' });

export async function harvestChain({ now, chain, vaults }: { now: Date; chain: Chain; vaults: BeefyVault[] }) {
    logger.debug({ msg: 'Harvesting chain', data: { chain, vaults: vaults.length } });
    const harvestStartedAt = new Date();

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    // create the report objects
    const report = createDefaultReport({ chain });
    var items = vaults.map(vault => ({ vault, reportItem: createDefaultReportItem({ vault }) })); // use var to redefine types along the way
    // add all report item references to the report
    // todo: this is far from ideal, but it works for now, means we have to be careful not to create a copy of the report items
    report.details = items.map(({ reportItem }) => reportItem);

    // we need the harvest lense
    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${chain}`);
    }
    const harvestContractAddress = rpcConfig.contracts.harvestLens;

    const rawGasPrice = await publicClient.getGasPrice();
    const collectorBalanceBefore = await reportOnAsyncCall(
        () => publicClient.getBalance({ address: walletAccount.address }).then(balance => ({ balanceWei: balance })),
        balanceRes => typeSafeSet(report, { collectorBalanceBefore: balanceRes })
    );

    // ==================
    // run the simulation
    // ==================
    logger.debug({ msg: 'Running simulation', data: { chain, vaults: vaults.length } });
    const { fulfilled: successfulSimulations, rejected: failedSimulations } = splitPromiseResultsByStatus(
        await Promise.allSettled(
            items.map(async ({ reportItem, vault }) =>
                reportOnAsyncCall(
                    () =>
                        Promise.all([
                            publicClient.simulateContract({
                                abi: BeefyHarvestLensABI,
                                address: harvestContractAddress,
                                functionName: 'harvest',
                                args: [vault.strategy_address],
                            }),
                            publicClient.estimateContractGas({
                                abi: IStrategyABI,
                                address: vault.strategy_address,
                                functionName: 'harvest',
                                account: walletAccount,
                            }),
                        ]).then(
                            ([
                                {
                                    result: [estimatedCallRewardsWei, harvestWillSucceed, lastHarvest, strategyPaused],
                                },
                                rawGasAmountEstimation,
                            ]) => ({
                                vault,
                                reportItem,
                                harvestWillSucceed,
                                lastHarvest: new Date(Number(lastHarvest) * 1000),
                                strategyPaused,
                                gas: createGasEstimation({
                                    rawGasPrice,
                                    estimatedCallRewardsWei,
                                    rawGasAmountEstimation,
                                }),
                            })
                        ),
                    simulationReport =>
                        typeSafeSet(reportItem, {
                            simulation: toReportItem(simulationReport, v => ({
                                harvestWillSucceed: v.harvestWillSucceed,
                                gas: v.gas,
                                lastHarvest: v.lastHarvest,
                                paused: v.strategyPaused,
                            })), // don't need to report the request
                            summary: toReportItemSummary(simulationReport),
                        })
                )
            )
        )
    );
    logger.debug({ msg: 'Simulation results', data: { chain, failedSimulations, successfulSimulations } });
    logger.info({
        msg: 'Skipping simulation errors',
        data: { chain, count: failedSimulations.length, failedSimulations },
    });

    // ============================
    // Make the decision to harvest
    // ============================
    // use some kind of logic to filter out strats that we don't want to harvest
    if (chain === 'ethereum') {
        throw new Error('TODO: implement eth logic');
    }
    const stratsToBeHarvested = successfulSimulations
        // check for callRewards
        .filter(item => {
            const shouldHarvest = item.gas.estimatedCallRewardsWei > 0n;
            if (!shouldHarvest) {
                logger.trace({ msg: 'Skipping strat due to callRewards being 0', data: { chain, stratData: item } });
                typeSafeSet(item.reportItem, {
                    harvestDecision: {
                        shouldHarvest: false,
                        callRewardsWei: item.gas.estimatedCallRewardsWei,
                        notHarvestingReason: 'call rewards too low',
                    },
                    summary: { harvested: false, error: false, profitWei: 0n },
                });
            } else {
                logger.trace({ msg: 'Strat has callRewards', data: { chain, stratData: item } });
            }
            return shouldHarvest;
        })
        // check for paused, even though the simulation would fail if that was really the case
        .filter(item => {
            const shouldHarvest = !item.strategyPaused;
            if (!shouldHarvest) {
                logger.trace({ msg: 'Skipping strat due to being paused', data: { chain, stratData: item } });
                typeSafeSet(item.reportItem, {
                    harvestDecision: {
                        shouldHarvest: false,
                        notHarvestingReason: 'strategy paused',
                    },
                    summary: { harvested: false, error: false, profitWei: 0n },
                });
            } else {
                logger.trace({ msg: 'Strat is not paused', data: { chain, stratData: item } });
            }
            return shouldHarvest;
        })
        // check for last harvest and profitability
        .filter(item => {
            const hoursSinceLastHarvest = (now.getTime() - item.lastHarvest.getTime()) / 1000 / 60 / 60;
            const wouldBeProfitable = item.gas.estimatedGainWei > 0n;
            const shouldHarvest = wouldBeProfitable || hoursSinceLastHarvest > HARVEST_AT_LEAST_EVERY_HOURS;
            if (!shouldHarvest) {
                logger.trace({
                    msg: 'Skipping strat due to last harvest being too recent and not profitable',
                    data: { chain, stratData: item, wouldBeProfitable, hoursSinceLastHarvest },
                });
                typeSafeSet(item.reportItem, {
                    harvestDecision: {
                        shouldHarvest: false,
                        hoursSinceLastHarvest,
                        wouldBeProfitable,
                        callRewardsWei: item.gas.estimatedCallRewardsWei,
                        estimatedGainWei: item.gas.estimatedGainWei,
                        notHarvestingReason: 'not profitable and harvested too recently',
                    },
                    summary: { harvested: false, error: false, profitWei: 0n },
                });
            } else {
                logger.trace({
                    msg: 'Strat should be harvested',
                    data: { chain, stratData: item, wouldBeProfitable, hoursSinceLastHarvest },
                });
                typeSafeSet(item.reportItem, {
                    harvestDecision: {
                        shouldHarvest: true,
                        hoursSinceLastHarvest,
                        wouldBeProfitable,
                        callRewardsWei: item.gas.estimatedCallRewardsWei,
                        estimatedGainWei: item.gas.estimatedGainWei,
                    },
                });
            }
            return shouldHarvest;
        });
    logger.info({ msg: 'Strategies to be harvested', data: { chain, count: stratsToBeHarvested.length } });
    logger.debug({ msg: 'Strategies to be harvested', data: { chain, stratsToBeHarvested } });

    // =======================
    // now do the havest dance
    // =======================
    logger.debug({ msg: 'Harvesting strats', data: { chain, count: stratsToBeHarvested.length } });
    const { fulfilled: successfulHarvests, rejected: failedHarvests } = splitPromiseResultsByStatus(
        await runSequentially(stratsToBeHarvested, async item => {
            logger.debug({ msg: 'Harvesting strat', data: { chain, strat: item } });
            const { transactionHash } = await reportOnAsyncCall<{ transactionHash: Hex }>(
                () =>
                    walletClient
                        .writeContract({
                            abi: IStrategyABI,
                            address: item.vault.strategy_address,
                            functionName: 'harvest',
                        })
                        .then(transactionHash => ({ transactionHash })),
                res => typeSafeSet(item.reportItem, { harvestTransaction: res, summary: toReportItemSummary(res) })
            );

            // we have to wait for the transaction to be minted in order for the next call to have a proper nonce
            const harvestReceipt = await reportOnAsyncCall(
                () =>
                    publicClient.waitForTransactionReceipt({ hash: transactionHash }).then(receipt => ({
                        blockNumber: receipt.blockNumber,
                        gasUsed: receipt.gasUsed,
                        effectiveGasPrice: receipt.effectiveGasPrice,
                    })),
                res => typeSafeSet(item.reportItem, { transactionReceipt: res, summary: toReportItemSummary(res) })
            );
            const res = { ...item, transactionHash, harvestReceipt };
            logger.debug({ msg: 'Harvested strat', data: { chain, strat: item, res } });

            // now we officially harvested the strat
            typeSafeSet(item.reportItem, {
                summary: {
                    harvested: true,
                    error: false,
                    profitWei:
                        item.gas.estimatedCallRewardsWei - harvestReceipt.gasUsed * harvestReceipt.effectiveGasPrice,
                },
            });
            return res;
        })
    );
    logger.debug({ msg: 'Harvest results', data: { chain, failedHarvests, successfulHarvests } });
    logger.info({ msg: 'Skipping strats due to error harvesting', data: { chain, count: failedHarvests.length } });

    // =================
    // update the report
    // =================

    report.summary = {
        errors: report.details.filter(item => item.summary.error).length,
        totalProfitWei: report.details.reduce((acc, item) => acc + item.summary.profitWei, 0n),
        harvested: report.details.filter(item => item.summary.harvested).length,
        skipped: report.details.filter(item => !item.summary.harvested && !item.summary.error).length,
        totalStrategies: report.details.length,
    };

    // getting the collector balance shouldn't prevent us from sending the report
    try {
        const collectorBalanceAfter = await reportOnAsyncCall(
            () =>
                publicClient.getBalance({ address: walletAccount.address }).then(balance => ({ balanceWei: balance })),
            balanceRes => typeSafeSet(report, { collectorBalanceAfter: balanceRes })
        );
        report.summary.totalProfitWei = collectorBalanceAfter.balanceWei - collectorBalanceBefore.balanceWei;
    } catch (e) {
        logger.error({ msg: 'Error getting collector balance after', data: { chain, e } });
    }

    const harvestEndedAt = new Date();
    report.timing = {
        startedAt: harvestStartedAt,
        endedAt: harvestEndedAt,
        durationMs: harvestEndedAt.getTime() - harvestStartedAt.getTime(),
    };

    return report;
}
