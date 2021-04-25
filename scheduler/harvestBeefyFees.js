const harvestBeefyFees = require('../scripts/harvestBeefyFees');

const run = async () => {
  console.log('>>>>>', 'harvestBeefyFees()');
  await harvestBeefyFees();
};

run();
