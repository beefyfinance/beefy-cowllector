const ethers = require('ethers');

const IStrategy = require('../abis/IStrategy.json');
const { isNewHarvestPeriod } = require('../utils/harvestHelpers');
const { sleep, between } = require('../utils/harvestHelpers');

const strat = {
  name: 'bifi-maxi',
  address: '0x92F347AdB3a2c3FD336DCE60242cde126711b9a3',
  interval: between(1, 2),
  harvestSignature: '0x4641257d',
};

const harvestSmart = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
  const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);

  let shouldHarvest = true;

  if (shouldHarvest) shouldHarvest = await isNewHarvestPeriod(strat, strat.harvestSignature);

  if (shouldHarvest) {
    await sleep(between(1000, 120000));

    const stratContract = new ethers.Contract(strat.address, IStrategy, harvester);
    const tx = await stratContract.harvest({ gasLimit: 1000000 });

    console.log(`Successfully harvested ${strat.name} with tx: ${tx.hash}`);
  } else {
    console.log(`Shouldn't harvest ${strat.name}`);
  }
};

module.exports = harvestSmart;
