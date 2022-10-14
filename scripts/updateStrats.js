require('dotenv').config();

const Web3 = require('web3');
const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const { MultiCall } = require('eth-multicall');

const { getVaults } = require('../utils/getVaults');
const fetchPrice = require('../utils/fetchPrice');
const CHAINS = require('../data/chains');
const strats = require('../data/strats.json');
const defistationVaults = require('../data/defistation.json');
const BeefyVaultABI = require('../abis/BeefyVault.json');


const main = async () => {
  let latestStrats = [];
  let latestDefistationVaults = [];

  for (const CHAIN of Object.values(CHAINS)) {
    console.log(`** Processing chain: ${CHAIN.id}`);
    if (!CHAIN.rpc) {
      console.warn(`No RPC for ${CHAIN.id}`);
      continue;
    }

    let vaults = await getVaults( CHAIN.appVaultsFilename);

    const web3 = new Web3(CHAIN.rpc);
    const multicall = new MultiCall(web3, CHAIN.multicall);

    const calls = vaults.map( vault => {
      const vaultContract = new web3.eth.Contract( BeefyVaultABI, 
                                                    vault.earnContractAddress);
      return {
        name: vaultContract.methods.name(),
        strategy: vaultContract.methods.strategy(),
      };
    });

    const [callResults] = await multicall.all([calls]);
    for (let i = 0; i < vaults.length; i++) {
      vaults[i].tokenName = callResults[i].name;
      vaults[i].strategy = callResults[i].strategy;
    }

    const knownStrategies = strats.filter( s => s.chainId === CHAIN.chainId).map( s => 
                                                                            s.address);

    const provider = new ethers.providers.JsonRpcProvider(CHAIN.rpc);
    const cacheIsReady = await fetchPrice.refreshCache();
    const responses = await Promise.allSettled(
      vaults.map( v => fetchPrice.fetchVaultTvl( v, provider))
    );
    vaults = responses.map( r => r.value);
    vaults = vaults.map( v => {
      v.chain = CHAIN.id;
      return v;
    });
    console.table( vaults, ['chain', 'id', 'tvl']);

    //if there are strategies that have so far gone unnoticed, take note of them now...
    for (vault of vaults) {
      const isExistingStrategy = knownStrategies.includes( vault.strategy);

      if (['eol', 'refund'].includes( vault.status)) {
        if (isExistingStrategy)
          console.log(
            `Strat ${vault.id} on ${CHAIN.id} is in ${vault.status} status. Removing from the harvest schedule...`
          );
        continue;
      }

      if (!isExistingStrategy)
        console.log(
          `Found new ${vault.id} with address ${vault.earnContractAddress} in ${CHAIN.appVaultsFilename}. Adding now...`
        );

      const stratData = strats.find(
        s => s.chainId === CHAIN.chainId && s.address === vault.strategy
      );
      if (stratData && stratData.name != vault.id)
        console.log(`Renaming ${stratData.name} to ${vault.id}...`);

      //note our strategy-contract descriptor, possibly updated, carrying over any special 
      //  handling notes from the prior version of the descriptor
      const O = {
        name: vault.id,
        address: vault.strategy,
        interval: stratData?.interval || CHAIN.harvestHourInterval,
        harvestSignature: stratData?.harvestSignature || '0x4641257d',
        depositsPaused: !!vault.depositsPaused,
        harvestPaused: stratData?.harvestPaused || false,
        chainId: CHAIN.chainId,
        tvl: vault.tvl,
      };
      if (stratData?.suppressCallRwrdCheck)
        O.suppressCallRwrdCheck = stratData.suppressCallRwrdCheck;
      latestStrats.push( O);

      if (CHAIN.id === 'bsc')
        latestDefistationVaults.push({
          id: vault.id,
          name: vault.tokenName,
          contract: vault.earnContractAddress,
          oracle: vault.oracle,
          oracleId: vault.oracleId,
          tvl: 0,
        });
    } //for (vault of vaults)
  } //for (const CHAIN of Object.values(CHAINS))

  // Surface deleted strategies
  const stratDifference = strats.filter(
    o => !latestStrats.some( n => o.address === n.address && o.chainId === n.chainId)
  );
  if (stratDifference.length)
    console.log( `Removing strats which are not represented in the beefy-app:`,
                  stratDifference.map( s => s.name).join( ', '));

  // Preserve existing defistation list
  const vaultDifference = defistationVaults.filter(
    o => !latestDefistationVaults.some(n => o.contract === n.contract)
  );
  latestDefistationVaults.push(...vaultDifference);

  fs.writeFileSync( path.join( __dirname, '../data/strats.json'), JSON.stringify( 
                                                              latestStrats, null, 2));

  fs.writeFileSync(
    path.join(__dirname, '../data/defistation.json'),
    JSON.stringify(latestDefistationVaults, null, 2)
  );
}; //const main = async () =>


main();
