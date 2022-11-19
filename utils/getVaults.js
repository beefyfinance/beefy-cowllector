const axios = require('axios');

const uniqueByAndNonGov = (objectsArray, key) => {
  let seen = new Set();
  return objectsArray.filter(obj => {
    return seen.has(obj[key]) || obj.id.endsWith('-gov') || obj.id.endsWith('-earnings')
      ? false
      : seen.add(obj[key]);
  });
};

//return an array of the base vault objects, unique by vault-contract address
const getVaults = async fileName => {
  const vaultsEndpoint = `https://raw.githubusercontent.com/beefyfinance/beefy-v2/prod/src/config/vault/${fileName}`;
  const response = await axios.get(vaultsEndpoint);
  const data = response.data;
  return uniqueByAndNonGov(eval(data), 'earnContractAddress');
};

module.exports = { getVaults };
