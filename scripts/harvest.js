const ethers = require('ethers');

const IStrategy = require('../abis/IStrategy.json');
const { isNewHarvestPeriod, hasStakers, subsidyWant, sleep } = require('../utils/harvestHelpers');
const { sendMessage } = require('../utils/discord');
const strats = require('../data/strats.json');

const harvest = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
  const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);

  for (const strat of strats) {
    try {
      console.log(`Analizing harvest of ${strat.name}.`);

      let shouldHarvest = true;

      if (shouldHarvest) shouldHarvest = !strat.harvestPaused;
      if (shouldHarvest) shouldHarvest = await isNewHarvestPeriod(strat, '0x4641257d');
      if (shouldHarvest) shouldHarvest = await hasStakers(strat, harvester);

      if (shouldHarvest) {
        if (strat.subsidy) await subsidyWant(strat, harvester);

        const stratContract = new ethers.Contract(strat.address, IStrategy, harvester);
        let tx;

        if (strat.depositsPaused) {
          await stratContract.unpause({ gasLimit: 3500000 });
          tx = await stratContract.harvest({ gasLimit: 4000000 });
          await stratContract.pause({ gasLimit: 3500000 });
        } else {
          tx = await stratContract.harvest({ gasLimit: 4000000 });
        }

        const message = `Successfully harvested ${strat.name} with tx: ${tx.hash}`;

        sendMessage(message);
        console.log(message);
      } else {
        console.log(`Shouldn't harvest ${strat.name}`);
      }
      console.log('---');
    } catch (e) {
      const message = `Couldn't harvest strat ${strat.name}: ${e}`;
      sendMessage(message);
      console.log(message);
    }

    await sleep(10000);
  }
};

module.exports = harvest;
