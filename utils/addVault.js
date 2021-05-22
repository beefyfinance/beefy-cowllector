const ethers = require('ethers');

const { getChainRpc } = require('../utils/getChainData');
const BeefyVault = require('../abis/BeefyVault.json');

const addVault = async ({ vault, chainId, interval, vaults, strats }) => {
  let newVault = {
    id: null,
    name: null,
    contract: vault,
    oracle: null,
    oracleId: null,
    tvl: 0,
  };

  const newStrat = {
    name: null,
    address: null,
    interval: interval,
    harvestSignature: '0x4641257d',
    depositsPaused: false,
    harvestPaused: false,
    harvestEvent: true,
    chainId: chainId,
  };

  const provider = new ethers.providers.JsonRpcProvider(getChainRpc(chainId));
  const vaultContract = new ethers.Contract(vault, BeefyVault, provider);

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

  return {
    newVaults: chainId === 56 ? [newVault, ...vaults] : vaults,
    newStrats: [newStrat, ...strats],
  };
};

module.exports = addVault;
