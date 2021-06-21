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

const hasStakers = async (strat, harvester) => {
  const strategy = new ethers.Contract(strat.address, IStrategy, harvester);
  const balance = await strategy.balanceOf();
  return balance.gt(0) ? true : false;
};

module.exports = {
  isNewHarvestPeriod,
  isNewPeriodNaive,
  hasStakers,
  sleep,
  between,
};
