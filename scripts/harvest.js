const cp = require('child_process');
const _ = require('lodash');

const strats = require('../data/strats.json');
const groups = _.groupBy(strats, 'chainId');
let children = {};
// let chainId = 56;
for (const chainId in groups) {
  if (Object.hasOwnProperty.call(groups, chainId)) {
    let child = cp.fork('./scripts/harvestChild.js', [chainId]);
    child.on('message', msg => {
      console.log(msg);
    });
    children[chainId] = child;
  }
}
