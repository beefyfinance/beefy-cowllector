const ethers = require('ethers');

const chains = require('../../data/chains');
const schedule = require('./schedule');

const config = {
  timelockAddress: '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F',
  chainId: 137,
  target: '0x53F816063523D9883C83863CbD5D8EAF9Ffc4641',
  value: 0,
  data: '0xa68833e5000000000000000000000000b66ca5319efc42fd1462693bab51ee0c9e452745',
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
  const signer = new ethers.Wallet(process.env.UPGRADER_PK, provider);

  await schedule({
    timelockAddr: config.timelockAddress,
    target: config.target,
    value: config.value,
    data: config.data,
    predecessor: config.predecessor,
    salt: config.salt,
    signer,
  });
};

main();
