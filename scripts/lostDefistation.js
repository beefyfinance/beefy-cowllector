const axios = require('axios');

const getVaults = async () => {
  const vaultsEndpoint =
    'https://raw.githubusercontent.com/beefyfinance/beefy-app/prod/src/features/configure/vault/bsc_pools.js';
  try {
    const response = await axios.get(vaultsEndpoint);
    const data = response.data;
    let vaults = '[' + data.substring(data.indexOf('\n') + 1);
    vaults = eval(vaults);
    return vaults;
  } catch (err) {
    console.error(err);
    return 0;
  }
};

const main = async () => {
  const vaults = await getVaults();
  const defi = require('../data/defistation.json');

  console.log('BSC pools in app:', vaults.length);
  console.log('Reported to defistation:', defi.length);

  const defiContracts = defi.map(value => value.contract);
  const notInDefi = vaults
    .filter(vault => vault.status === 'active')
    .map(value => ({
      id: value.id,
      vault: value.earnedTokenAddress,
    }))
    .filter(value => !defiContracts.includes(value.vault));

  console.log('ACTIVE vaults not reported to defistation:');
  console.log(notInDefi);
};

main();
