const { Contract, Provider } = require('ethers-multicall');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');

const { getVaults } = require('../utils/getVaults');
const chains = require('../data/chains.json');
let strats = require('../data/strats.json');

const abi = ['function strategy() view public returns(address)'];

const main = async () => {
  for (chain of chains) {
    let vaults = await getVaults(chain.appVaultsFilename);

    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    const multicallProvider = new Provider(provider);
    await multicallProvider.init();

    const calls = vaults.map(vault => {
      const vaultContract = new Contract(vault.earnContractAddress, abi);
      return vaultContract.strategy();
    });

    const strategyAddresses = await multicallProvider.all(calls);

    for (let i = 0; i < vaults.length; i++) {
      vaults[i].strategy = strategyAddresses[i];
    }

    strats = strats.filter(strat => {
      if (strat.chainId !== chain.chainId) return true;

      const match = vaults.find(vault => vault.strategy == strat.address);

      if (match === undefined || match.status == 'eol' || match.status === 'refund') {
        console.log(
          `Removing the strat ${strat.name} from the harvest schedule. Chain: ${strat.chainId}`
        );
        return false;
      } else {
        return true;
      }
    });

    // fs.writeFileSync(path.join(__dirname, '../data/strats.json'), JSON.stringify(strats, null, 2));
  }
};

main();
