const ethers = require('ethers');
const BigNumber = require('bignumber.js');

const RewardPool = require('../abis/RewardPool.json');
const WrappedNative = require('../abis/WrappedNative.json');
const getRewardsReceived = require('../utils/getRewardsReceived');
const chains = require('../data/chains');

const notifyRewards = async () => {
  for (chain of Object.values(chains)) {
    if (!chain.rewardPool) continue;

    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
      const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);
      const rewardsContract = new ethers.Contract(chain.rewardPool, RewardPool, harvester);
      const wnativeContract = new ethers.Contract(chain.wnative, WrappedNative, harvester);

      const rewardsReceived = await getRewardsReceived(chain);
      let balance = await wnativeContract.balanceOf(chain.rewardPool);
      balance = new BigNumber(balance.toString());

      if (rewardsReceived.lte(balance)) {
        await rewardsContract.notifyRewardAmount(rewardsReceived.toFixed());
        console.log(`${rewardsReceived.div('1e18').toFixed()} in rewards notified on ${chain.id}.`);
      } else {
        console.log('Attempting to notify more than balance', rewardsReceived.toFixed());
      }
    } catch (e) {
      console.log(`Something went wrong with chain ${chain.chainId}: ${e}`);
    }
  }
};

module.exports = notifyRewards;
