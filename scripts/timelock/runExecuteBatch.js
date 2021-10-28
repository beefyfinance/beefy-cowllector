const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const executeBatch = require('./executeBatch');

const targets = [
  '0xad777a366D5aD4A728A03C2CC61a3c3Ea8935BBB',
  '0x31e77776b924Cd5f0E624771C9B3d2bD6B9c919E',
  '0xE5e79043eC57b12F2d15d4a230ED9C7d732Ed93A',
  '0x68c39886eA459b4a59758F1e94c3d20C93d47133',
  '0x17720F863DA01Bc9e266e4eE872E3c98fA1FeAA8',
];

const config = {
  timelockAddress: addressBook['bsc'].platforms.beefyfinance.vaultOwner,
  chainId: 56,
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
