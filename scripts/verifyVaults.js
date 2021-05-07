const { Contract, Provider } = require('ethers-multicall');
const ethers = require('ethers');

const { getVaults } = require('../utils/getVaults');
let strats = require('../data/strats.json');

strats = strats.filter(strat => strat.chainId == 56);

const abi = ['function strategy() view public returns(address)'];

const main = async () => {
  let vaults = await getVaults();

  const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
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

  for (strat of strats) {
    const match = vaults.find(vault => vault.strategy == strat.address);

    if (match == undefined || match.status == 'eol' || match.status === 'refund') {
      console.log(`The strat ${strat.name} should be removed.`);
    }
  }

  // Check if something is in panic and should be paused?

  // Make it remove the strats...?
};

main();
