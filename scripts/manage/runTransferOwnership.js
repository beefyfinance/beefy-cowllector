const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const { sleep } = require('../../utils/harvestHelpers');
const chains = require('../../data/chains');
const transferOwnership = require('./transferOwnership');
const chainIdFromName = require('../../utils/chainIdFromName');

const chainName = 'avax';

const config = {
  chainId: chainIdFromName(chainName),
  owner: addressBook[chainName].platforms.beefyfinance.strategyOwner,
  pk: process.env.REWARDER_PK,
  addresses: [],
  delay: 500,
};

const main = async () => {
  for (address of config.addresses) {
    const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
    const signer = new ethers.Wallet(config.pk, provider);

    await transferOwnership({ address, owner: config.owner, signer });

    await sleep(config.delay);
  }
};

main();
