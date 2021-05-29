require('dotenv').config();

const Web3 = require('web3');
const { MultiCall } = require('eth-multicall');
const BigNumber = require('bignumber.js');

const { getVaults } = require('../utils/getVaults');
const chains = require('../data/chains');
const BeefyVault = require('../abis/BeefyVault.json');

const main = async () => {
  for (const chain of Object.values(chains)) {
    const vaults = await getVaults(chain.appVaultsFilename);
    const vaultBalances = await getVaultBalances(chain, vaults);

    console.log('Empty vaults on', chain.id);
    for (let i = 0; i < vaults.length; i++) {
      const vault = vaults[i];
      const vaultBal = vaultBalances[i];
      if (vaultBal.isZero()) {
        console.log(vault.id, vault.earnedTokenAddress);
      }
    }
  }
};

const getVaultBalances = async (chain, vaults) => {
  const web3 = new Web3(chain.rpc);
  const multicall = new MultiCall(web3, chain.multicall);
  const balanceCalls = [];
  vaults.forEach(vault => {
    const vaultContract = new web3.eth.Contract(BeefyVault, vault.earnedTokenAddress);
    balanceCalls.push({
      balance: vaultContract.methods.totalSupply()
    });
  });
  const res = await multicall.all([balanceCalls]);
  return res[0].map(v => new BigNumber(v.balance));
};

main();
