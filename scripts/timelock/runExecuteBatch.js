const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const { sleep } = require('../../utils/harvestHelpers');
const executeBatch = require('./executeBatch');

const UPGRADE_STRAT = '0xe6685244';

const config = {
  timelockAddress: addressBook['polygon'].platforms.beefyfinance.vaultOwner,
  chainId: 137,
  pk: process.env.KEEPER_PK,
  values: [0, 0, 0, 0],
  data: [UPGRADE_STRAT, UPGRADE_STRAT, UPGRADE_STRAT, UPGRADE_STRAT],
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
  targets: [
    '0x7c0E28652523e36f0dF89C5A895cF59D493cb04c',
    '0xC4FABD1E2A99c84b7fd152a41426B77c217c5764',
    '0x764B2aAcfDE7e33888566a6d44005Dc982F02031',
    '0xba1548b3f673950094dc00eDc1eB71683f371696',
  ],
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
  const signer = new ethers.Wallet(config.pk, provider);

  await executeBatch({
    timelockAddr: config.timelockAddress,
    targets: config.targets,
    values: config.values,
    data: config.data,
    predecessor: config.predecessor,
    salt: config.salt,
    signer,
  });
};

main();
