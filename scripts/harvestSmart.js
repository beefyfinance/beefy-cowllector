const ethers = require('ethers');

const StrategyCakeSmart = require('../abis/StrategyCakeSmart.json');
const { isNewHarvestPeriod } = require('../utils/harvestHelpers');
const { sleep, between } = require('../utils/harvestHelpers');
const { sendMessage } = require('../utils/discord');

const strat = {
  name: 'cake-smart',
  address: '0xBD8ad0F6492DA660f506fB65f049A5DA4b894a27',
  interval: between(2, 5),
};

const harvestSmart = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
  const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);

  let shouldHarvest = true;
  if (shouldHarvest) shouldHarvest = await isNewHarvestPeriod(strat, '0x15146d13');

  if (shouldHarvest) {
    try {
      await sleep(between(1000, 140000));

      const stratContract = new ethers.Contract(strat.address, StrategyCakeSmart, harvester);
      const poolId = 2; // Only harvest TWT for now.
      await stratContract.enablePool(poolId);
      const tx = await stratContract.harvest(poolId, { gasLimit: 3500000 });
      await stratContract.disablePool(poolId, { gasLimit: 1000000 });

      const message = `Successfully harvested ${strat.name} with tx: ${tx.hash}`;
      sendMessage(message);
      console.log(message);
    } catch (e) {
      const message = `Couldn't harvest strat ${strat.name}: ${e}`;
      sendMessage(message);
      console.log(message);
    }
  } else {
    console.log(`Shouldn't harvest ${strat.name}`);
  }
};
module.exports = harvestSmart;
