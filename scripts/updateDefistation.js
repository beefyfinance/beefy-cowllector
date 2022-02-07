const ethers = require('ethers');
const fetchPrice = require('../utils/fetchPrice');
const vaults = require('../data/defistation.json');
const CHAINS = require('../data/chains');

const DEFISTATION_URL = 'https://api.defistation.io/dataProvider/tvl';

const updateDefistation = async () => {
  const provider = new ethers.providers.JsonRpcProvider(CHAINS[56].rpc);
  const isCacheReady = await fetchPrice.refreshCache();
  const values = await Promise.all(vaults.map(vault => fetchPrice.fetchVaultTvl(vault, provider)));
  const totalTvl = values.reduce((acc, curr) => Number(acc) + Number(curr.tvl), 0);

  const data = {
    tvl: totalTvl,
    bnb: 0,
    test: false,
    data: vaults,
  };

  const auth = Buffer.from(`${process.env.DEFISTATION_ID}:${process.env.DEFISTATION_KEY}`).toString(
    'base64'
  );

  axios
    .post(DEFISTATION_URL, data, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })
    .then(res => {
      console.table(res.data.data);
    })
    .catch(error => {
      console.error(error);
    });

  // DEBUG tvl
  // console.log(data);
};

module.exports = updateDefistation;
