require('dotenv').config();

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const { MultiCall } = require('eth-multicall');

const { getVaults } = require('../utils/getVaults');
const chains = require('../data/chains');

const BeefyVault = require('../abis/BeefyVault.json');

const main = async () => {
  for (chain of Object.values(chains)) {
    let vaults = await getVaults(chain.appVaultsFilename);

    const web3 = new Web3(chain.rpc);
    const multicall = new MultiCall(web3, chain.multicall);

    const calls = vaults.map(vault => {
      const vaultContract = new web3.eth.Contract(BeefyVault, vault.earnedTokenAddress);
      return {
        strategy: vaultContract.methods.strategy(),
      };
    });

    const [strategyAddresses] = await multicall.all([calls]);

    for (let i = 0; i < vaults.length; i++) {
      vaults[i].strategy = strategyAddresses[i].strategy;
      vaults[i].vault = vaults[i].earnedTokenAddress;
    }

    vaults = vaults.filter(vault => {
      if (vault.status === 'eol' || vault.status === 'refund') {
        console.log(
          `Removing the strat ${vault.id} from the bug bounty scope. Chain: ${chain.chainId}`
        );
        return false;
      } else {
        return true;
      }
    });

    vaults.forEach(vault => {
      const validKeys = ['id', 'strategy', 'vault'];
      Object.keys(vault).forEach(key => validKeys.includes(key) || delete vault[key]);
    });

    fs.writeFileSync(
      path.join(__dirname, `../data/immunefi_${chain.appVaultsFilename}.json`),
      JSON.stringify(vaults, null, 2)
    );
  }
};

main();
