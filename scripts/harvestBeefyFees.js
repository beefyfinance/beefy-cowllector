const cp = require('child_process');
const CHAINS = require('../data/chains');

const main = async () => {
  for (const CHAIN in CHAINS) {
    let child = cp.fork('./scripts/harvestBeefyFees_child.js', [CHAIN]);
    child.on('message', msg => {
      console.log(msg);
    });
  }
};

module.exports = main;
