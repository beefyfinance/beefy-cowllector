const harvestSmart = require('../scripts/harvestSmart');

const run = async () => {
  console.log('>>>>>', 'harvestSmart()');
  await harvestSmart();
};

run();
