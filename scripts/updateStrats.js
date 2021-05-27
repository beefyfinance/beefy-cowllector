require('dotenv').config();

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const { MultiCall } = require('eth-multicall');

const { getVaults } = require('../utils/getVaults');
const chains = require('../data/chains');
let strats = require('../data/strats.json');
let defistationVaults = require('../data/defistation.json');
const BeefyVault = require('../abis/BeefyVault.json');
const addVault = require('../utils/addVault');

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
    }

    // Find if there are strats that we should remove from the harvest schedule.
    strats = strats.filter(strat => {
      if (strat.chainId !== chain.chainId) return true;

      const match = vaults.find(vault => vault.strategy == strat.address);

      if (match === undefined || match.status === 'eol' || match.status === 'refund') {
        console.log(
          `Removing the strat ${strat.name} from the harvest schedule. Chain: ${strat.chainId}`
        );
        return false;
      } else {
        return true;
      }
    });

    // Find if there are vaults that we should have but don't.
    for (vault of vaults) {
      if (vault.status === 'eol' || vault.status === 'refund') continue;

      const match = strats.find(strat => vault.strategy == strat.address);

      if (match === undefined) {
        console.log(
          `Vault ${vault.id} with address ${vault.earnedTokenAddress} is in ${chain.appVaultsFilename} but not in 'data/strats.json'. Adding now...`
        );
        const { newStrats, newVaults } = await addVault({
          vault: vault.earnedTokenAddress,
          chainId: chain.chainId,
          interval: 6,
          vaults: defistationVaults,
          strats,
        });

        defistationVaults = newVaults;
        strats = newStrats;
      }
    }
  }

  fs.writeFileSync(path.join(__dirname, '../data/strats.json'), JSON.stringify(strats, null, 2));
  fs.writeFileSync(
    path.join(__dirname, '../data/defistation.json'),
    JSON.stringify(defistationVaults, null, 2)
  );
};

main();
