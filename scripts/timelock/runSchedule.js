const ethers = require('ethers');

const chains = require('../../data/chains');
const { sleep } = require('../../utils/harvestHelpers');
const schedule = require('./schedule');

const config = {
  timelockAddress: '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F',
  chainId: 250,
  pk: process.env.UPGRADER_PK,
  value: 0,
  data: '0xa68833e50000000000000000000000004f8865a1fce2877ccb55264600d4759d222e8feb',
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
  delay: 3000,
  addresses: [],
};

const main = async () => {
  for (address of config.addresses) {
    const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
    const signer = new ethers.Wallet(config.pk, provider);

    await schedule({
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
