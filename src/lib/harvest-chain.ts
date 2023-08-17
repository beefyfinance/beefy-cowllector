import type { Chain } from './chain';
import type { BeefyVault } from './vault';
import { getReadOnlyRpcClient, getWalletAccount, getWalletClient } from '../lib/rpc-client';
import { BeefyHarvestLensABI } from '../abi/BeefyHarvestLensABI';
import { HARVEST_AT_LEAST_EVERY_HOURS, HARVEST_OVERESTIMATE_GAS_BY_PERCENT, RPC_CONFIG } from '../util/config';
import { rootLogger } from '../util/logger';
import { createGasEstimationReport, estimateHarvestCallGasAmount } from './gas';
import { reportOnHarvestStep, reportOnAsyncCall, HarvestReport, createDefaultReportItem } from './harvest-report';
import { IStrategyABI } from '../abi/IStrategyABI';
import { NotEnoughRemainingGasError, UnsupportedChainError } from './harvest-errors';

const logger = rootLogger.child({ module: 'harvest-chain' });

export async function harvestChain({
    report,
    now,
    chain,
    vaults,
}: {
    report: HarvestReport;
    now: Date;
    chain: Chain;
    vaults: BeefyVault[];
}) {
    logger.debug({ msg: 'Harvesting chain', data: { chain, vaults: vaults.length } });

    const publicClient = getReadOnlyRpcClient({ chain });
    const walletClient = getWalletClient({ chain });
    const walletAccount = getWalletAccount({ chain });
    const rpcConfig = RPC_CONFIG[chain];

    const items = vaults.map(vault => ({ vault, report: createDefaultReportItem({ vault }) }));
    report.details = items.map(({ report }) => report);

    // we need the harvest lense
    if (!rpcConfig.contracts.harvestLens) {
        throw new Error(`Missing harvest lens address for chain ${chain}`);
    }
    const harvestLensContract = { abi: BeefyHarvestLensABI, address: rpcConfig.contracts.harvestLens };

    // ======================
    // get some context first
    // ======================

    const {
        fetchGasPrice: { gasPriceWei: rawGasPrice },
    } = await reportOnAsyncCall({ report }, 'fetchGasPrice', async () => ({
        gasPriceWei: await publicClient.getGasPrice(),
    }));

    const { collectorBalanceBefore } = await reportOnAsyncCall({ report }, 'collectorBalanceBefore', async () => ({
        balanceWei: await publicClient.getBalance({ address: walletAccount.address }),
    }));

    // ==================
    // run the simulation
    // ==================
    const successfulSimulations = await reportOnHarvestStep(items, 'simulation', 'parallel', async item => {
        const { result } = await publicClient.simulateContract({
            ...harvestLensContract,
            functionName: 'harvest',
            args: [item.vault.strategy_address],
        });
        const [estimatedCallRewardsWei, harvestWillSucceed, lastHarvest, strategyPaused] = result;
        return {
            estimatedCallRewardsWei,
            harvestWillSucceed,
            lastHarvest: new Date(Number(lastHarvest) * 1000),
            paused: strategyPaused,
        };
    });

    // ============================
    // Filter out paused strategies
    // ============================

    // use some kind of logic to filter out strats that we don't want to harvest
    if (chain === 'ethereum') {
        throw new UnsupportedChainError({ chain });
    }
    const liveStratsDecisions = await reportOnHarvestStep(
        successfulSimulations,
        'isLiveDecision',
        'parallel',
        async item => {
            if (item.vault.eol) {
                return {
                    shouldHarvest: false,
                    notHarvestingReason: 'vault is eol',
                };
            }

            if (item.simulation.paused) {
                return {
                    shouldHarvest: false,
                    notHarvestingReason: 'strategy paused',
                };
            }
            return { shouldHarvest: true };
        }
    );
    const liveStrats = liveStratsDecisions.filter(item => item.isLiveDecision.shouldHarvest);

    // ==============
    // Gas Estimation
    // ==============

    const successfulEstimations = await reportOnHarvestStep(liveStrats, 'gasEstimation', 'sequential', async item => {
        const gasEst = await estimateHarvestCallGasAmount({
            chain,
            rpcClient: publicClient,
            strategyAddress: item.vault.strategy_address,
        });
        return createGasEstimationReport({
            rawGasPrice,
            rawGasAmountEstimation: gasEst,
            estimatedCallRewardsWei: item.simulation.estimatedCallRewardsWei,
            overestimateGasByPercent: HARVEST_OVERESTIMATE_GAS_BY_PERCENT,
        });
    });

    // ======================
    // profitability decision
    // ======================

    // check for last harvest and profitability
    const harvestDecisions = await reportOnHarvestStep(
        successfulEstimations,
        'harvestDecision',
        'parallel',
        async item => {
            // - If lastHarvest was > 24 hrs ago -> harvest.
            // - If callReward > gasLimit * gasPrice -> harvest.
            const hoursSinceLastHarvest = (now.getTime() - item.simulation.lastHarvest.getTime()) / 1000 / 60 / 60;
            const wouldBeProfitable = item.gasEstimation.estimatedGainWei > 0n;
            const shouldHarvest = wouldBeProfitable || hoursSinceLastHarvest > HARVEST_AT_LEAST_EVERY_HOURS;

            if (!shouldHarvest) {
                return {
                    shouldHarvest: false,
                    hoursSinceLastHarvest,
                    wouldBeProfitable,
                    callRewardsWei: item.gasEstimation.estimatedCallRewardsWei,
                    estimatedGainWei: item.gasEstimation.estimatedGainWei,
                    notHarvestingReason: 'not profitable and harvested too recently',
                };
            } else {
                return {
                    shouldHarvest: true,
                    hoursSinceLastHarvest,
                    wouldBeProfitable,
                    callRewardsWei: item.gasEstimation.estimatedCallRewardsWei,
                    estimatedGainWei: item.gasEstimation.estimatedGainWei,
                };
            }
        }
    );
    const stratsToBeHarvested = harvestDecisions.filter(item => item.harvestDecision.shouldHarvest);

    // =======================
    // now do the havest dance
    // =======================
    let remainingGas = collectorBalanceBefore.balanceWei;

    logger.debug({ msg: 'Harvesting strats', data: { chain, count: stratsToBeHarvested.length } });
    await reportOnHarvestStep(stratsToBeHarvested, 'harvestTransaction', 'sequential', async item => {
        // check if we have enough gas to harvest
        const remainingGasWei = await publicClient.getBalance({ address: walletAccount.address });
        if (remainingGasWei < item.gasEstimation.transactionCostEstimationWei) {
            logger.info({ msg: 'Not enough gas to harvest', data: { chain, remainingGas, strat: item } });
            const error = new NotEnoughRemainingGasError({
                chain,
                remainingGas,
                transactionCostEstimationWei: item.gasEstimation.transactionCostEstimationWei,
                strategyAddress: item.vault.strategy_address,
            });
            throw error;
        }

        // harvest the strat
        // no need to set gas fees as viem has automatic EIP-1559 detection and gas settings
        // https://github.com/wagmi-dev/viem/blob/viem%401.6.0/src/utils/transaction/prepareRequest.ts#L89
        const transactionHash = await walletClient.writeContract({
            abi: IStrategyABI,
            address: item.vault.strategy_address,
            functionName: 'harvest',
        });

        // wait for the transaction to be mined so we have a proper nonce for the next transaction
        const receipt = await publicClient.waitForTransactionReceipt({
            hash: transactionHash,
            confirmations: rpcConfig.transaction.blockConfirmations,
            timeout: rpcConfig.transaction.timeoutMs,
        });

        // now we officially harvested the strat
        return {
            transactionHash,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed,
            effectiveGasPrice: receipt.effectiveGasPrice,
            remainingGas,
            // todo: this shouldn't be an estimate
            profitWei: item.gasEstimation.estimatedGainWei - item.gasEstimation.transactionCostEstimationWei,
        };
    });

    // ===============
    // final reporting
    // ===============

    // fetching this additional info shouldn't crash the whole harvest
    try {
        const { collectorBalanceAfter } = await reportOnAsyncCall({ report }, 'collectorBalanceAfter', async () => ({
            balanceWei: await publicClient.getBalance({ address: walletAccount.address }),
        }));
        report.summary.totalProfitWei = collectorBalanceAfter.balanceWei - collectorBalanceBefore.balanceWei;
    } catch (e) {
        logger.error({ msg: 'Error getting collector balance after', data: { chain, e } });
    }

    return report;
}
