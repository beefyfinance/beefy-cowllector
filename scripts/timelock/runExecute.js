const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const { sleep } = require('../../utils/harvestHelpers');
const execute = require('./execute');

const UPGRADE_STRAT = '0xe6685244';

const config = {
  timelockAddress: addressBook['bsc'].platforms.beefyfinance.vaultOwner,
  chainId: 56,
  pk: process.env.REWARDER_PK,
  value: 0,
  data: UPGRADE_STRAT,
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
  delay: 21600,
  addresses: ['0xb26642B6690E4c4c9A6dAd6115ac149c700C7dfE'],
};

const main = async () => {
  for (address of config.addresses) {
    const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
    const signer = new ethers.Wallet(config.pk, provider);

    await execute({
      timelockAddr: config.timelockAddress,
      target: address,
      value: config.value,
      data: config.data,
      predecessor: config.predecessor,
      salt: config.salt,
      signer,
    });

    await sleep(config.delay);
  }
};

main();
