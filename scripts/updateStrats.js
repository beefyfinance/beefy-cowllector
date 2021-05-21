const { Contract, Provider } = require('ethers-multicall');
const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const { MultiCall } = require('eth-multicall');

const { getVaults } = require('../utils/getVaults');
const chains = require('../data/chains');
let strats = require('../data/strats.json');
const BeefyVault = require('../abis/BeefyVault.json');
const abi = ['function strategy() view public returns(address)'];

const main = async () => {
  for (chain of chains) {
    let vaults = await getVaults(chain.appVaultsFilename);

    const web3 = new Web3(chain.rpc);
    const multicall = new MultiCall(web3, chain.multicall);

    const calls = vaults.map(vault => {
      const vaultContract = new web3.eth.Contract(BeefyVault, vault.earnedTokenAddress);
      return {
        strategy: vaultContract.methods.strategy(),
      };
    });

    // const strategyAddresses = await multicallProvider.all(calls);

    // for (let i = 0; i < vaults.length; i++) {
    //   vaults[i].strategy = strategyAddresses[i];
    // }

    // strats = strats.filter(strat => {
    //   if (strat.chainId !== chain.chainId) return true;

    //   const match = vaults.find(vault => vault.strategy == strat.address);

    //   if (match === undefined || match.status == 'eol' || match.status === 'refund') {
    //     console.log(
    //       `Removing the strat ${strat.name} from the harvest schedule. Chain: ${strat.chainId}`
    //     );
    //     return false;
    //   } else {
    //     return true;
    //   }
    // });

    // fs.writeFileSync(path.join(__dirname, '../data/strats.json'), JSON.stringify(strats, null, 2));
  }
};

main();
