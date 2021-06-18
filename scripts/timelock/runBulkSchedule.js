const ethers = require('ethers');

const chains = require('../../data/chains');
const { sleep } = require('../../utils/harvestHelpers');
const schedule = require('./schedule');

const config = {
  timelockAddress: '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F',
  chainId: 250,
  pk: process.env.UPGRADER_PK,
  value: 0,
  data: '0xa68833e5000000000000000000000000b66ca5319efc42fd1462693bab51ee0c9e452745',
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
  delay: 3000,
  addresses: [
    '0x8F35521cf1B9145E2C5231B8B3E1c3AEadDc4027',
    '0xa6914AbA898D613152DB7D338381d53b5Eae0C1d',
    '0x3464ab12F2c2fe3DAa90Aa7D90DDe6BA470422BD',
    '0x3C180c415332999Fa7e5a65E8490A57fe8Fd7fdb',
  ],
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
