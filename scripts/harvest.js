const ethers = require('ethers');

const IStrategy = require('../abis/IStrategy.json');
const {
  isNewHarvestPeriod,
  isNewHarvestPeriodBscscan,
  hasStakers,
  subsidyWant,
  sleep,
} = require('../utils/harvestHelpers');
const chains = require('../data/chains');
const strats = require('../data/strats.json');

const harvest = async () => {
  for (const strat of strats) {
    try {
      console.log(`Analizing harvest of ${strat.name}.`);

      const provider = new ethers.providers.JsonRpcProvider(chains[strat.chainId].rpc);
      const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);

      let shouldHarvest = true;

      if (shouldHarvest) shouldHarvest = !strat.harvestPaused;
      if (shouldHarvest) shouldHarvest = await hasStakers(strat, harvester);
      if (shouldHarvest) {
        if (strat.harvestEvent) {
          shouldHarvest = await isNewHarvestPeriod(strat, harvester);
        } else {
          shouldHarvest = await isNewHarvestPeriodBscscan(strat);
        }
      }

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

        console.log(`Successfully harvested ${strat.name} with tx: ${tx.hash}`);
      } else {
        console.log(`Shouldn't harvest ${strat.name}`);
      }
      console.log('---');
    } catch (e) {
      console.log(`Couldn't harvest strat ${strat.name}: ${e}`);
    }

    await sleep(10000);
  }
};

module.exports = harvest;
