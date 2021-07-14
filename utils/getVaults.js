const axios = require('axios');

const getVaults = async fileName => {
  const vaultsEndpoint = `https://raw.githubusercontent.com/beefyfinance/beefy-app/prod/src/features/configure/vault/${fileName}`;
  const response = await axios.get(vaultsEndpoint);
  const data = response.data;
  let vaults = '[' + data.substring(data.indexOf('\n') + 1);
  vaults = uniqueBy(eval(vaults), 'earnedTokenAddress');
  return vaults;
};

const uniqueBy = (objectsArray, key) => {
  let seen = new Set();
  return objectsArray.filter(obj => {
    return seen.has(obj[key]) ? false : seen.add(obj[key]);
  });
}

module.exports = { getVaults };
