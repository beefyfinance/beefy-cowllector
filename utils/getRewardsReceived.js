const Web3 = require('web3');
const BigNumber = require('bignumber.js');
const { sleep } = require('./harvestHelpers');

const { getTopicFromSignature, getTopicFromAddress, getValueFromData } = require('./topicHelpers');

const getRewardsReceived = async chain => {
  const web3 = new Web3(chain.rpc);

  let result = new BigNumber(0);

  const lastBlock = await web3.eth.getBlockNumber();
  const details = await getLastRewardAddedDetails(chain, lastBlock, web3);

  const transferTopic = getTopicFromSignature('Transfer(address,address,uint256)');
  const toTopic = getTopicFromAddress(chain.rewardPool);

  let fromBlock = details.blockNumber;

  while (fromBlock < lastBlock) {
    console.log('getRewardsReceived', fromBlock);
    let toBlock = fromBlock + chain.queryLimit;
    if (toBlock > lastBlock) {
      toBlock = lastBlock;
    }

    let logs;
    try {
      logs = await web3.eth.getPastLogs({
        fromBlock: fromBlock,
        toBlock: toBlock - 1,
        address: chain.wnative,
        topics: [transferTopic, null, toTopic],
      });
    } catch (err) {
      console.error('getRewardsReceived', err);
      await sleep(30 * 1000);
      continue;
    }

    console.log('=============================');
    console.log(logs);
    console.log('=============================');

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

    await sleep(chain.queryInterval);

    fromBlock = toBlock;
  }

  return result;
};

const getLastRewardAddedDetails = async (chain, lastBlock, web3) => {
  const topic = getTopicFromSignature('RewardAdded(uint256)');

  let fromBlock = lastBlock - chain.queryLimit;
  let toBlock = lastBlock;

  let details = { blockNumber: chain.firstRewardBlock, transactionIndex: 0 };

  while (fromBlock > chain.firstRewardBlock) {
    console.log('getLastRewardAddedDetails', fromBlock);
    let logs;
    try {
      logs = await web3.eth.getPastLogs({
        fromBlock: fromBlock,
        toBlock: toBlock - 1,
        address: chain.rewardPool,
        topics: [topic],
      });
    } catch (err) {
      console.error('getLastRewardAddedDetails', err);
      await sleep(30 * 1000);
      continue;
    }

    if (logs.length) {
      const last = logs[logs.length - 1];
      details.blockNumber = last.blockNumber;
      details.transactionIndex = last.transactionIndex;
      break;
    }

    await sleep(chain.queryInterval);

    toBlock = fromBlock;
    fromBlock -= chain.queryLimit;
  }

  return details;
};

module.exports = getRewardsReceived;
