const ethers = require('ethers');
const BigNumber = require('bignumber.js');

const RewardPool = require('../abis/RewardPool.json');
const WrappedNative = require('../abis/WrappedNative.json');
const getRewardsReceived = require('../utils/getRewardsReceived');
const { isNewPeriodNaive } = require('../utils/harvestHelpers');
const chains = require('../data/chains');

const notifyRewards = async () => {
  for (chain of Object.values(chains)) {
    if (!chain.notifyInterval) continue;

    if (!isNewPeriodNaive(chain.notifyInterval)) {
      console.log(`Is not time to notify ${chain.id}, skipping.`);
      continue;
    }

    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
      const harvester = new ethers.Wallet(process.env.REWARDER_PK, provider);
      const rewardsContract = new ethers.Contract(chain.rewardPool, RewardPool, harvester);
      const wnativeContract = new ethers.Contract(chain.wnative, WrappedNative, harvester);

      const rewardsReceived = await getRewardsReceived(chain);
      const rewardsNormalized = rewardsReceived.div('1e18').toFixed();

      let balance = await wnativeContract.balanceOf(chain.rewardPool);
      balance = new BigNumber(balance.toString());

      if (rewardsReceived.lte(balance)) {
        let tx = await rewardsContract.notifyRewardAmount(rewardsReceived.toFixed(), {
          gasLimit: 200000,
        });
        tx = await tx.wait();

        tx.status === 1
          ? console.log(
              `Notify ${rewardsNormalized} on ${chain.id} with tx: ${tx.transactionHash}.`
            )
          : console.log(
              `Notify of ${rewardsNormalized} on chain ${chain.chainId} failed with tx: ${tx.transactionHash}`
            );
      } else {
        console.log(`Attempting to notify more than balance: ${rewardsNormalized}`);
      }
    } catch (e) {
      console.log(`Something went wrong with chain ${chain.chainId}: ${e}`);
    }
  }
};

module.exports = notifyRewards;
