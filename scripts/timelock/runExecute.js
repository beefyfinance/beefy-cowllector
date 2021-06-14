const ethers = require('ethers');

const chains = require('../../data/chains');
const execute = require('./execute');

const config = {
  timelockAddress: '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F',
  chainId: 137,
  target: '0x9B14a16609b0Bf5DA858115b4537e2CD01B3133C',
  value: 0,
  data: '0xa68833e5000000000000000000000000b66ca5319efc42fd1462693bab51ee0c9e452745',
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
  const signer = new ethers.Wallet(process.env.UPGRADER_PK, provider);

  await execute({
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
