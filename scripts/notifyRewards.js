const ethers = require('ethers');

const RewardPool = require('../abis/RewardPool.json');
const getRewardsReceived = require('../utils/getRewardsReceived');

const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
const rewards = '0x453D4Ba9a2D594314DF88564248497F7D74d6b2C';

const notifyRewards = async () => {
  const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);
  const rewardsContract = new ethers.Contract(rewards, RewardPool, harvester);

  const rewardsReceived = await getRewardsReceived();

  await rewardsContract.notifyRewardAmount(rewardsReceived.toString());

  console.log(`${rewardsReceived.div('1e18').toString()} in rewards notified.`);
};

module.exports = notifyRewards;
