const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const { sleep } = require('./harvestHelpers');

const { getTopicFromSignature, getTopicFromAddress, getValueFromData } = require('./topicHelpers');

const RPC_QUERY_LIMIT = 1000;
const RPC_QUERY_INTERVAL = 100;
const FIRST_REWARD_BLOCK = 1457038;

const REWARD_POOL = '0x453D4Ba9a2D594314DF88564248497F7D74d6b2C';
const WBNB = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';

const web3 = new Web3(process.env.BSC_RPC);

const getRewardsReceived = async () => {
  let result = new BigNumber(0);

  const lastBlock = await web3.eth.getBlockNumber();
  const details = await getLastRewardAddedDetails(lastBlock);

  const transferTopic = getTopicFromSignature('Transfer(address,address,uint256)');
  const toTopic = getTopicFromAddress(REWARD_POOL);

  let fromBlock = details.blockNumber;

  while (fromBlock < lastBlock) {
    let toBlock = fromBlock + RPC_QUERY_LIMIT;
    if (toBlock > lastBlock) {
      toBlock = lastBlock;
    }

    const logs = await web3.eth.getPastLogs({
      fromBlock: fromBlock,
      toBlock: toBlock - 1,
      address: WBNB,
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

    await sleep(RPC_QUERY_INTERVAL);

    fromBlock = toBlock;
  }

  return result;
};

const getLastRewardAddedDetails = async lastBlock => {
  const topic = getTopicFromSignature('RewardAdded(uint256)');

  let fromBlock = lastBlock - RPC_QUERY_LIMIT;
  let toBlock = lastBlock;

  let details = { blockNumber: 0, transactionIndex: 0 };

  while (fromBlock > FIRST_REWARD_BLOCK) {
    const logs = await web3.eth.getPastLogs({
      fromBlock: fromBlock,
      toBlock: toBlock - 1,
      address: REWARD_POOL,
      topics: [topic],
    });

    if (logs.length) {
      const last = logs[logs.length - 1];
      details.blockNumber = last.blockNumber;
      details.transactionIndex = last.transactionIndex;
      break;
    }

    await sleep(RPC_QUERY_INTERVAL);

    toBlock = fromBlock;
    fromBlock -= RPC_QUERY_LIMIT;
  }

  return details;
};

module.exports = getRewardsReceived;
