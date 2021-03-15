const axios = require('axios');

const endpoints = {
  bakery: 'https://api.beefy.finance/bakery/price',
  coingecko: 'https://api.coingecko.com/api/v3/simple/price',
  pancake: 'https://api.beefy.finance/pancake/price',
  lps: 'https://api.beefy.finance/lps',
};

const CACHE_TIMEOUT = 30 * 60 * 1000;
const cache = {};

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

const fetchPancake = async id => {
  try {
    const response = await axios.get(endpoints.pancake);
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
    case 'bakery':
      price = await fetchLP(id, endpoints.bakery);
      break;

    case 'coingecko':
      price = await fetchCoingecko(id);
      break;

    case 'pancake':
      price = await fetchPancake(id);
      break;

    case 'thugs':
      price = await fetchThugs(id);
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

module.exports = fetchPrice;
