const ethers = require('ethers');
const IStrategy = require('../abis/IStrategy.json');
const axios = require('axios');
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

const isNewHarvestPeriod = async (strat, harvester) => {
  const strategy = new ethers.Contract(strat.address, IStrategy, harvester);
  const filter = strategy.filters.StratHarvest(null);
  const currentBlock = await harvester.provider.getBlockNumber();
  const blockTime = chains[strat.chainId].blockTime;
  const oldestPeriodBlock = currentBlock - (strat.interval * 3600) / blockTime;

  let logs = [];
  let interval = chains[strat.chainId].queryLimit;
  let from = currentBlock - interval;
  let to = currentBlock;

  while (!logs.length) {
    if (to <= oldestPeriodBlock) return true;

    logs = await strategy.queryFilter(filter, from, to);

    from -= interval;
    to -= interval;
  }

  return false;
};

const isNewHarvestPeriodBscscan = async strat => {
  let result = false;

  try {
    const url = `https://api.bscscan.com/api?module=account&action=txlist&address=${strat.address}&startblock=0&endblock=99999999&sort=asc`;
    const response = await axios.get(url);
    let txs = response.data.result.reverse();

    for (let i = 0; i < txs.length; i++) {
      const tx = txs[i];

      if (tx.input.substring(0, 10) === strat.harvestSignature && tx.isError === '0') {
        const now = parseInt(new Date().getTime() / 1000);
        const harvestPeriod = strat.interval * 3600;
        result = tx.timeStamp < now - harvestPeriod ? true : false;

        console.log(`Last harvest was: ${((now - tx.timeStamp) / 3600).toFixed(2)} hours ago.`);

        break;
      }
    }

    return result;
  } catch (e) {
    console.log('Error:', e);
    return false;
  }
};

const hasStakers = async (strat, harvester) => {
  const strategy = new ethers.Contract(strat.address, IStrategy, harvester);
  const balance = await strategy.balanceOf();
  return balance.gt(0) ? true : false;
};

module.exports = {
  isNewHarvestPeriod,
  isNewPeriodNaive,
  isNewHarvestPeriodBscscan,
  hasStakers,
  sleep,
  between,
};
