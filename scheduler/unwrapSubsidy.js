const unwrapSubsidy = require('../scripts/unwrapSubsidy');

const run = async () => {
  console.log('>>>>>', 'harvestSubsidyRewarder()');
  await unwrapSubsidy();
};

run();
