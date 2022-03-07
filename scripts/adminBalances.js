const ethers = require('ethers');
const BigNumber = require('bignumber.js');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../data/chains');

const adminBalances = async () => {
  for (chain of Object.values(chains)) {
    console.log(`Auditing balances of ${chain.id}`);

    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    const { beefyfinance } = addressBook[chain.id].platforms;
    const { keeper, strategyOwner, vaultOwner, rewarder } = beefyfinance;
    const harvester = '0xDe30AcAE712F090C0C3A255F61Bfae876d491F6E';

    const admins = [keeper, strategyOwner, vaultOwner, harvester, rewarder];
    const unique = [...new Set(admins)];

    for (admin of unique) {
      const bal = await provider.getBalance(admin);
      console.log(`${admin} has ${BigNumber(bal.toString()).div(1e18).toString()}`);
    }

    console.log('====');
  }
};

adminBalances();
