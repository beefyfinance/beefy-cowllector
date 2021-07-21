require('dotenv').config();

const Web3 = require('web3');
const fs = require('fs');
const path = require('path');
const { MultiCall } = require('eth-multicall');

const { getVaults } = require('../utils/getVaults');
const chains = require('../data/chains');
const strats = require('../data/strats.json');
const defistationVaults = require('../data/defistation.json');
const BeefyVaultABI = require('../abis/BeefyVault.json');

const defaultInterval = (chain) => {
  switch (chain.id) {
    case 'bsc':
      return 4;
    case 'avax':
      return 6;
    default:
      return 1;
  }
};

const main = async () => {
  let newStrats = [];
  let newDefistationVaults = [];

  for (const chain of Object.values(chains)) {
    if (!chain.rpc) {
      console.warn(`No RPC for ${chain.id}`);
      continue;
    }

    let vaults = await getVaults(chain.appVaultsFilename);

    const web3 = new Web3(chain.rpc);
    const multicall = new MultiCall(web3, chain.multicall);

    const calls = vaults.map(vault => {
      const vaultContract = new web3.eth.Contract(BeefyVaultABI, vault.earnedTokenAddress);
      return {
        name: vaultContract.methods.name(),
        strategy: vaultContract.methods.strategy()
      };
    });

    const [callResults] = await multicall.all([calls]);
    for (let i = 0; i < vaults.length; i++) {
      vaults[i].tokenName = callResults[i].name;
      vaults[i].strategy = callResults[i].strategy;
    }

    const knownStrategies = strats
      .filter(s => s.chainId === chain.chainId)
      .map(s => s.address);

    // Find if there are vaults that we should have but don't.
    for (vault of vaults) {
      const isExistingStrategy = knownStrategies.includes(vault.strategy);

      if (['eol', 'refund'].includes(vault.status)) {
        if (isExistingStrategy) console.log(
          `Strat ${vault.id} on ${chain.id} is in ${vault.status} status. Removing from the harvest schedule...`
        );
        continue;
      }

      if (!isExistingStrategy) console.log(
        `Found new ${vault.id} with address ${vault.earnedTokenAddress} in ${chain.appVaultsFilename}. Adding now...`
      );

      const stratData = strats.find(s => s.chainId === chain.chainId && s.address === vault.strategy);
      if (stratData && stratData.name != vault.id) console.log(`Renaming ${stratData.name} to ${vault.id}...`);

      newStrats.push({
        name: vault.id,
        address: vault.strategy,
        interval: stratData?.interval || defaultInterval(chain),
        harvestSignature: stratData?.harvestSignature || '0x4641257d',
        depositsPaused: !!vault.depositsPaused,
        harvestPaused: stratData?.harvestPaused || false,
        chainId: chain.chainId
      });

      if (chain.id === 'bsc') newDefistationVaults.push({
        id: vault.id,
        name: vault.tokenName,
        contract: vault.earnedTokenAddress,
        oracle: vault.oracle,
        oracleId: vault.oracleId,
        tvl: 0
      });

    }
  }

  // Surface deleted strategies
  const stratDifference = strats.filter(o => !newStrats.some(n =>
    (o.address === n.address && o.chainId === n.chainId)
  ));
  if (stratDifference.length > 0) {
    console.log(
      `Removing strats which are not represented in the beefy-app:`,
      stratDifference.map(s => s.name).join(', ')
    );
  }

  // Preserve existing defistation list
  const vaultDifference = defistationVaults.filter(o => !newDefistationVaults.some(n =>
    (o.contract === n.contract)
  ));
  newDefistationVaults.push(...vaultDifference);

  fs.writeFileSync(
    path.join(__dirname, '../data/strats.json'),
    JSON.stringify(newStrats, null, 2));

  fs.writeFileSync(
    path.join(__dirname, '../data/defistation.json'),
    JSON.stringify(newDefistationVaults, null, 2)
  );

};

main();
