const ethers = require('ethers');

const chains = require('../data/chains');
const BeefyVault = require('../abis/BeefyVault.json');

const addVault = async ({ vault, chainId, interval, vaults, strats }) => {
  let newVault = {
    id: null,
    name: null,
    contract: vault.earnedTokenAddress,
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
    chainId: chainId,
  };

  const provider = new ethers.providers.JsonRpcProvider(chains[chainId].rpc);
  const vaultContract = new ethers.Contract(vault.earnedTokenAddress, BeefyVault, provider);

  const mooName = await vaultContract.name();
  newVault.name = mooName;

  newVault.oracle = vault.oracle;
  newVault.oracleId = vault.oracleId;

  const strategyAddress = await vaultContract.strategy();
  newStrat.address = strategyAddress;
  newStrat.name = newVault.oracle === 'lps' ? vault.oracleId : vault.id;

  return {
    newVaults: chainId === 56 ? [newVault, ...vaults] : vaults,
    newStrats: [newStrat, ...strats],
  };
};

module.exports = addVault;
