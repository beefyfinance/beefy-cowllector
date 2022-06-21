const cp = require('child_process');
const CHAINS = require('../data/chains');

const main = async () => {
  for (const s_CHAIN in CHAINS) {
    let child = cp.fork('./scripts/harvest_child.js', [s_CHAIN]);
    child.on('message', msg => {
      console.log(msg);
    });
  }
};

module.exports = main;
