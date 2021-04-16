const notifyRewards = require('../scripts/notifyRewards');

const run = async () => {
  console.log('>>>>>', 'harvestSubsidyRewarder()');
  await notifyRewards();
};

run();
