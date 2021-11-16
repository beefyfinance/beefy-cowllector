const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const executeBatch = require('./executeBatch');
const chainIdFromName = require('../../utils/chainIdFromName');

const chainName = 'bsc';
const targets = [];

const config = {
  timelockAddress: addressBook[chainName].platforms.beefyfinance.vaultOwner,
  chainId: chainIdFromName(chainName),
  pk: process.env.REWARDER_PK,
  values: Array.from({ length: targets.length }, () => 0),
  data: Array.from({ length: targets.length }, () => '0xe6685244'),
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
  const signer = new ethers.Wallet(config.pk, provider);

  await executeBatch({
    timelockAddr: config.timelockAddress,
    targets: targets,
    values: config.values,
    data: config.data,
    predecessor: config.predecessor,
    salt: config.salt,
    signer,
  });
};

main();
