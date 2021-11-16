const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const { sleep } = require('../../utils/harvestHelpers');
const chains = require('../../data/chains');
const setKeeper = require('./setKeeper');

const config = {
  chainId: 56,
  pk: process.env.REWARDER_PK,
  strats: [],
  delay: 500,
};

const main = async () => {
  for (strat of config.strats) {
    const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
    const signer = new ethers.Wallet(config.pk, provider);
    const chainName = chains[config.chainId].id;
    const { keeper } = addressBook[chainName].platforms.beefyfinance;

    await setKeeper({ strat, keeper, signer });

    await sleep(config.delay);
  }
};

main();
