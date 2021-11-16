const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const scheduleBatch = require('./scheduleBatch');

const targets = [];

const config = {
  timelockAddress: addressBook['polygon'].platforms.beefyfinance.strategyOwner,
  chainId: 137,
  pk: process.env.UPGRADER_PK,
  values: Array.from({ length: targets.length }, () => 0),
  data: Array.from(
    { length: targets.length },
    () => '0xf2fde38b000000000000000000000000847298ac8c28a9d66859e750456b92c2a67b876d'
  ),
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
  const signer = new ethers.Wallet(config.pk, provider);

  await scheduleBatch({
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
