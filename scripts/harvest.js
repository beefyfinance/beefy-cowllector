const cp = require('child_process');
const CHAINS = require('../data/chains');
const harvestHelpers = require('../utils/harvestHelpers');

const main = async () => {
  const MINUTE = 60 * 1000;
  for (const chain in CHAINS) {
    let child = cp.fork('./scripts/harvest_child.js', [chain]);
    child.on('message', msg => {
      console.log(msg);
    });
    await harvestHelpers.sleep(MINUTE); //enforce a stagger to reduce memory load
  }
};

module.exports = main;
