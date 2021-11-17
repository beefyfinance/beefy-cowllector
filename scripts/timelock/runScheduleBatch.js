const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const scheduleBatch = require('./scheduleBatch');
const chainIdFromName = require('../../utils/chainIdFromName');

const chainName = 'fantom';
const targets = [
  '0xB2aC5329D7D78Cb208964C566c35f0eF8C6572f6',
  '0x1f71777c9db9fe5b19927dDF33Efa22191E0B354',
  '0x12F1A8C91Ffdb0aF421b703A75b8E9f57ADDF0b9',
  '0xa623c28f64A429baE0426Aa8AEbE64d307A38cC0',
  '0xd88c449c1F68480316f3e3A48bD37186e58217A8',
];

const config = {
  timelockAddress: '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F',
  chainId: chainIdFromName(chainName),
  pk: process.env.UPGRADER_PK,
  values: Array.from({ length: targets.length }, () => 0),
  data: Array.from(
    { length: targets.length },
    () => '0xa68833e5000000000000000000000000502c107ae28d300fdaede1cbd7ee8096c1ab4a3c'
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
