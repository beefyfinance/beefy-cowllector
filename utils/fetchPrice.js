const ethers = require('ethers');
const axios = require('axios');
const BeefyVaultABI = require('../abis/BeefyVault.json');

const endpoints = {
  coingecko: 'https://api.coingecko.com/api/v3/simple/price',
  tokens: 'https://api.beefy.finance/prices',
  lps: 'https://api.beefy.finance/lps',
};

const CACHE_TIMEOUT = 30 * 60 * 1000;
const cache = {};
let isCacheReady = false;

const setCachePrices = async ({ oracle }) => {
  if (oracle === 'coingecko') return true;
  try {
    const response = await axios.get(endpoints[oracle]);
    const ids = Object.keys(response.data);
    ids.map(id => addToCache({ oracle, id, price: response.data[id] }));
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
};

const refreshCache = async () => {
  let retry = 0;
  do {
    retry++;
    isCacheReady = false;
    const oracles = Object.keys(endpoints);
    const responses = await Promise.allSettled(oracles.map(oracle => setCachePrices({ oracle })));
    isCacheReady = responses.every(r => r.value);
    if (isCacheReady) return isCacheReady;
  } while (retry <= 5);
  return false;
};

function isCached({ oracle, id }) {
  if (`${oracle}-${id}` in cache) {
    return cache[`${oracle}-${id}`].t + CACHE_TIMEOUT > Date.now();
  }
  return false;
}

function getCachedPrice({ oracle, id }) {
  return cache[`${oracle}-${id}`].price;
}

function addToCache({ oracle, id, price }) {
  cache[`${oracle}-${id}`] = { price: price, t: Date.now() };
  return true;
}

const fetchCoingecko = async id => {
  try {
    const response = await axios.get(endpoints.coingecko, {
      params: { ids: id, vs_currencies: 'usd' },
    });
    return response.data[id].usd;
  } catch (err) {
    console.error(err);
    return 0;
  }
};

const fetchToken = async id => {
  try {
    const response = await axios.get(endpoints.tokens);
    return response.data[id];
  } catch (err) {
    console.error(err);
    return 0;
  }
};

const fetchLP = async (id, endpoint) => {
  try {
    const response = await axios.get(endpoint);
    return response.data[id];
  } catch (err) {
    console.error(err);
    return 0;
  }
};

const fetchPrice = async ({ oracle, id }) => {
  if (oracle === undefined) {
    console.error('Undefined oracle');
    return 0;
  }
  if (id === undefined) {
    console.error('Undefined pair');
    return 0;
  }

  if (isCached({ oracle, id })) {
    return getCachedPrice({ oracle, id });
  }

  let price = 0;
  switch (oracle) {
    case 'coingecko':
      price = await fetchCoingecko(id);
      break;

    case 'tokens':
      price = await fetchToken(id);
      break;

    case 'lps':
      price = await fetchLP(id, endpoints.lps);
      break;

    default:
      price = 0;
  }

  addToCache({ oracle, id, price });
  return price;
};

const fetchVaultTvl = async (vault, provider) => {
  try {
    let vaultAddress = vault.contract || vault.earnContractAddress;
    const vaultContract = new ethers.Contract(vaultAddress, BeefyVaultABI, provider);
    const vaultBalance = await vaultContract.balance();

    const price = await fetchPrice({ oracle: vault.oracle, id: vault.oracleId });
    const normalizationFactor = 1e6;
    const normalizedPrice = ethers.BigNumber.from(String(Math.round(price * normalizationFactor)));
    const vaultBalanceInUsd = vaultBalance.mul(normalizedPrice.toString());
    const result = vaultBalanceInUsd.div(normalizationFactor);

    const vaultObjTvl = ethers.utils.formatEther(result);
    vault.tvl = Number(vaultObjTvl).toFixed(0);

    return vault;
  } catch (error) {
    console.log('error fetching price tvl:', vault.oracleId);
    vault.tvl = 0;
    return vault;
  }
};

module.exports = {
  fetchPrice,
  fetchVaultTvl,
  refreshCache,
  isCacheReady,
};
