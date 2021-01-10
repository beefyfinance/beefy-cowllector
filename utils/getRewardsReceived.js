const Web3 = require('web3');
const BigNumber = require('bignumber.js');

const { getTopicFromSignature, getTopicFromAddress, getValueFromData } = require('./topicHelpers');

const web3 = new Web3(process.env.BSC_RPC);

const rewardPool = '0x453D4Ba9a2D594314DF88564248497F7D74d6b2C';
const wbnb = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const getRewardsReceived = async () => {
  let result = new BigNumber(0);

  const details = await getLastRewardAddedDetails();

  const transferTopic = getTopicFromSignature('Transfer(address,address,uint256)');
  const toTopic = getTopicFromAddress(rewardPool);
  const logs = await web3.eth.getPastLogs({
    fromBlock: details.blockNumber,
    toBlock: 'latest',
    address: wbnb,
    topics: [transferTopic, null, toTopic],
  });

  for (let i = 0; i < logs.length; i++) {
    if (
      logs[i].blockNumber === details.blockNumber &&
      logs[i].transactionIndex < details.transactionIndex
    ) {
      continue;
    }
    const value = getValueFromData(logs[i].data);
    result = result.plus(value);
  }

  return result;
};

const getLastRewardAddedDetails = async () => {
  let details = {};

  const topic = getTopicFromSignature('RewardAdded(uint256)');

  const logs = await web3.eth.getPastLogs({
    fromBlock: 0,
    toBlock: 'latest',
    address: rewardPool,
    topics: [topic],
  });

  const last = logs[logs.length - 1];
  details.blockNumber = last.blockNumber;
  details.transactionIndex = last.transactionIndex;

  return details;
};

module.exports = getRewardsReceived;
