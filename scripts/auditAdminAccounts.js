const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../data/chains');
const strats = require('../data/strats.json');

const stratAbi = [
  'function keeper() public view returns (address)',
  'function owner() public view returns (address)',
  'function vault() public view returns (address)',
];

const vaultAbi = ['function owner() public view returns (address)'];

const pks = {
  '0xd529b1894491a0a26B18939274ae8ede93E81dbA': process.env.REWARDER_PK,
  '0x4E2a43a0Bf6480ee8359b7eAE244A9fBe9862Cdf': process.env.UPGRADER_PK,
  '0x10aee6B5594942433e7Fc2783598c979B030eF3D': process.env.KEEPER_PK,
  '0xDe30AcAE712F090C0C3A255F61Bfae876d491F6E': process.env.HARVESTER_PK,
};

const auditAdminAccounts = async () => {
  for (strat of strats) {
    console.log('======');
    console.log(`Analizing admin accounts of ${strat.name}`);

    const chain = chains[strat.chainId];
    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    const stratContract = new ethers.Contract(strat.address, stratAbi, provider);

    const vault = await stratContract.vault();
    const vaultContract = new ethers.Contract(vault, vaultAbi, provider);

    const { keeper, strategyOwner, vaultOwner } = addressBook[chain.id].platforms.beefyfinance;

    try {
      console.log('Analizing Keeper');
      await verifyKeeper(stratContract, keeper);
      // setKeeper

      console.log('Analizing Strat Owner');
      await verifyOwner(stratContract, strategyOwner);
      // BSC: Multisig, can't do anything. Should get a list of addresses.
      //

      console.log('Analizing Vault Owner');
      await verifyOwner(vaultContract, vaultOwner);
    } catch (e) {
      console.log(`Something went wrong with chain ${chain.chainId}: ${e}`);
    }
  }

  console.log('Final results:');
  console.log(updates);
};

const verifyKeeper = async (stratContract, targetKeeper) => {
  let keeper;
  try {
    keeper = await stratContract.keeper();
  } catch (e) {
    console.log(`Does not implement 'keeper'.`);
    return {
      keeper: ethers.constants.AddressZero,
      targetKeeper: ethers.constants.AddressZero,
    };
  }

  if (keeper === targetKeeper) {
    console.log(`Already has the correct keeper.`);
  } else {
    console.log(`Should update keeper from ${keeper} to ${targetKeeper}`);
  }
};

const verifyOwner = async (contract, target) => {
  let owner;
  try {
    owner = await contract.owner();
  } catch (e) {
    console.log(`Does not implement owner.`);
    return;
  }

  if (owner === target) {
    console.log(`Already has the correct owner.`);
  } else {
    console.log(`Should update owner from ${owner} to ${target}`);
  }
};

auditAdminAccounts();
