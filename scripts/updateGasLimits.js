require('dotenv').config();
const fs = require('fs');
const path = require('path');
const ethers = require('ethers');
const chains = require('../data/chains');
const strats = require('../data/strats.json');
const harvestHelpers = require('../utils/harvestHelpers');

const addGasLimitToStrats = async (strats, provider, chainId) => {
  let responses = await Promise.allSettled(
    strats.map(strat => harvestHelpers.estimateGas(strat, chainId, provider))
  );
  fullfilled = responses.filter(s => s.status === 'fulfilled').map(s => s.value);
  return fullfilled;
};

const main = async () => {
  let gasLimits = [];
  for (const CHAIN_ID in chains) {
    if (Object.hasOwnProperty.call(chains, CHAIN_ID)) {
      const CHAIN = chains[CHAIN_ID];
      console.log(
        `Adding Gas Limit for strats on ${CHAIN.id.toUpperCase()} [id=${CHAIN_ID}] [rpc=${
          CHAIN.rpc
        }] [explorer=${CHAIN.blockExplorer}]`
      );
      const provider = new ethers.providers.JsonRpcProvider(CHAIN.rpc);

      let filtered = strats.filter(s => s.chainId === Number(CHAIN_ID));

      console.log(`total strats ${filtered.length}`);
      let added = await addGasLimitToStrats(filtered, provider, CHAIN_ID);
      console.log(`after add gas limit: ${added.length} strat with gas limit`);
      gasLimits.push(...added);
      console.table(added);
    }
  }
  fs.writeFileSync(path.join(__dirname, '../data/gasLimits.json'), '');
  fs.writeFileSync(
    path.join(__dirname, '../data/gasLimits.json'),
    JSON.stringify(gasLimits, null, 2)
  );
};

main();
