const Web3 = require('web3');
const ethers = require('ethers');
const { MultiCall } = require('eth-multicall');
const IStrategy = require('../abis/IStrategy.json');
const chains = require('../data/chains.js');

const between = (min, max) => Math.floor(Math.random() * (max - min) + min);

const sleep = ms => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

const isNewPeriodNaive = interval => {
  const now = new Date();
  const hour = now.getHours();
  return hour % interval === 0;
};

/**
 * Check if is new harvest period
 * @param {Object} strat
 * @param {signer} harvester ethers signer harvester
 * @param {Number} harvesInterval seconds interval between harvest
 * @returns boolean
 */
const isNewHarvestPeriod = async (strat, harvester, harvestInterval, chainId) => {
  const strategy = new ethers.Contract(strat.strategy || strat.address, IStrategy, harvester);
  const filter = strategy.filters.StratHarvest(null);
  const currentBlock = await harvester.provider.getBlockNumber();
  const blockTime = chains[chainId || strat.chainId].blockTime;
  const oldestPeriodBlock = currentBlock - harvestInterval / blockTime;

  let logs = [];
  let interval = chains[chainId || strat.chainId].queryLimit;
  let from = currentBlock - interval;
  let to = currentBlock;

  while (!logs.length) {
    if (from <= oldestPeriodBlock) return true;

    logs = await strategy.queryFilter(filter, from, to);

    from -= interval;
    to -= interval;
  }

  return false;
}; //const isNewHarvestPeriod = async (

/**
 * Multicall contract methods
 * @description Works with only view methods. Function will return the same array of
 *      contracts passed in with an extra property giving the results of the method called.
 * @param {object} chain object, see chains.js
 * @param {array} strategy descriptors
 * @param {string} method to call
 * @param {json} the ABI (Aplication Binary Interface)
 * @returns {array} ehters contracts
 */
const multicall = async (chain, contracts, method = 'balanceOf', ABI = IStrategy) => {
  const web3 = new Web3(chain.rpc);
  const multicall = new MultiCall(web3, chain.multicall);

  const calls = contracts.map(c => {
    const contract = new web3.eth.Contract(ABI, c.strategy || c.address);
    return {
      [method]: contract.methods[method](),
    };
  });
  const [callResults] = await multicall.all([calls]);
  for (let i = 0; i < contracts.length; i++) {
    contracts[i][method] = callResults[i][method] || contracts[i][method] || 0;
  }
  return contracts;
}; //const multicall = async (

const hasStakers = async strategy => {
  const balance = await strategy.balanceOf();
  return balance.gt(0) ? true : false;
};

/**
 * Estimate Gas Limit
 * @description This function returns gasLimit with higher of this three strategies
 * 1. Get Average of gas used on the last 10.000 blocks
 * 2. Estimate gas using eth_estimateGas jsonrpc method
 * 3. Set default gasLimit preset on every chain in chains.js
 * @param {object} strat - Object with strat key struct - see strats.json
 * @param {number} chainId - Chain Id - see chains.js
 * @param {object} provider - Ethers Provider Instance
 * @param {string} [topic='StratHarvest(address)'] - Log Event topic to estimate gas
 *    average - default is 'StratHarvest(address)'
 * @returns Promise object whose value is the strat object with added gasLimit property
 */
const estimateGas = async (strat, chainId, provider, topic = null) => {
  topic = topic || ethers.utils.id('StratHarvest(address)'); // 0x577a37fdb49a88d66684922c6f913df5239b4f214b2b97c53ef8e3bbb2034cb5

  strat.gasLimit = 0;

  // Estimate Gas using gas used in event logs
  try {
    let filter = {
      address: strat.strategy || strat.address,
      toBlock: 'latest',
      fromBlock: -1e5,
      topics: [topic],
    };
    let logs = await provider.getLogs(filter);
    if (logs.length) {
      let responses = await Promise.allSettled(
        logs.map(log => provider.getTransaction(log.transactionHash))
      );

      let txs = responses.filter(res => res.status === 'fulfilled');
      if (txs.length === 0) throw new Error('no txs to get average of gas');

      let gasLimitWithLog = txs.reduce((reduce, tx) => {
        let gas = Number(tx.value.limit);
        if (!Number.isNaN(gas)) return reduce + gas;
      }, 0);
      gasLimitWithLog = parseInt(gasLimitWithLog / txs.length);
      if (Number.isNaN(gasLimitWithLog)) throw new Error('no txs to get average of gas');

      //0xww: Add on an extra 30% of estimated gas
      strat.gasLimit = parseInt((gasLimitWithLog * 130) / 100);
      strat.gasLimitStrategy = 'average of last logged events';
    }
  } catch (error) {
    //  console.error( error);
  }

  // Estimage Gas using eth_estimateGas
  try {
    let limit = await provider.estimateGas({
      to: strat.strategy || strat.address,
      data: strat.harvestSignature || '0x4641257d',
    });

    //0xww: Add on an extra 30% of estimated gas
    let gasLimitWithEstimateGas = parseInt((limit * 130) / 100);
    if (gasLimitWithEstimateGas > strat.gasLimit) {
      strat.gasLimit = gasLimitWithEstimateGas;
      strat.gasLimitStrategy = 'eth_estimateGas';
    }
  } catch (error) {
    // console.error(error);
  }

  // Estimage Gas setting chain default gas
  try {
    if (chains[chainId] && chains[chainId].gas && chains[chainId].gas.limit) {
      let gasLimitDefaultConfig = parseInt(chains[chainId].gas.limit);
      if (gasLimitDefaultConfig > strat.gasLimit) {
        strat.gasLimit = gasLimitDefaultConfig;
        strat.gasLimitStrategy = 'default chain config';
      }
    }
  } catch (error) {
    // console.error(error)
  }
  if (strat.gasLimit) return strat;

  throw new Error(`Cannot estimate gas of contract ${strat.strategy || strat.address}`);
};

module.exports = {
  multicall,
  isNewHarvestPeriod,
  isNewPeriodNaive,
  hasStakers,
  sleep,
  between,
  estimateGas,
};
