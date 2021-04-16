const fs = require('fs');
const path = require('path');
const ethers = require('ethers');

const strats = require('../data/strats.json');
const vaults = require('../data/defistation.json');
const { getChainRpc } = require('../utils/getChainData');
const BeefyVault = require('../abis/BeefyVault.json');

const args = process.argv.slice(2);

if (!args.length) {
  console.log('Usage: Need to pass a vault address as argument.');
  return;
}

const config = {
  vault: args[0],
  chainId: Number(args[1]) || 56,
  interval: Number(args[2]) || 2,
};

/**
 * @dev This script expects the deployed vault's mooName to follow the following standard:
 * Moo <Platform> <Staked Tokens>
 * The staked tokens can either be a single token like ETH, or an LP like ETH-BNB
 */
const main = async () => {
  let newVault = {
    id: null,
    name: null,
    contract: config.vault,
    oracle: null,
    oracleId: null,
    tvl: 0,
  };

  const newStrat = {
    name: null,
    address: null,
    interval: config.interval,
    harvestSignature: '0x4641257d',
    depositsPaused: false,
    harvestPaused: false,
    harvestEvent: true,
    chainId: config.chainId,
  };

  const provider = new ethers.providers.JsonRpcProvider(getChainRpc(config.chainId));
  const vaultContract = new ethers.Contract(config.vault, BeefyVault, provider);

  const mooName = await vaultContract.name();
  newVault.name = mooName;

  let mooNameElements = mooName.split(' ');

  newVault.oracle = mooNameElements[2].split('-').length > 1 ? 'lps' : 'tokens';

  mooNameElements.shift();
  mooNameElements.length = 2;
  const id = mooNameElements.join('-').toLowerCase();
  newVault.id = id;

  if (newVault.oracle === 'lps') {
    newVault.oracleId = id;
  } else {
    newVault.oracleId = id.toUpperCase();
  }

  const strategyAddress = await vaultContract.strategy();
  newStrat.address = strategyAddress;
  newStrat.name = id;

  fs.writeFileSync(
    path.resolve(__dirname, '..', 'data', 'defistation.json'),
    JSON.stringify([newVault, ...vaults], null, 2)
  );
  fs.writeFileSync(
    path.resolve(__dirname, '..', 'data', 'strats.json'),
    JSON.stringify([newStrat, ...strats], null, 2)
  );
};

main();
