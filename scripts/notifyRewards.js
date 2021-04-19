const ethers = require('ethers');

const RewardPool = require('../abis/RewardPool.json');
const getRewardsReceived = require('../utils/getRewardsReceived');
const chains = require('../data/chains');

const notifyRewards = async () => {
  for (chain of chains) {
    if (!chain.rewardPool) continue;

    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);
    const rewardsContract = new ethers.Contract(chain.rewardPool, RewardPool, harvester);

    const rewardsReceived = await getRewardsReceived(chain);

    await rewardsContract.notifyRewardAmount(rewardsReceived.toString());

    console.log(`${rewardsReceived.div('1e18').toString()} in rewards notified on ${chain.id}.`);
  }
};

module.exports = notifyRewards;
