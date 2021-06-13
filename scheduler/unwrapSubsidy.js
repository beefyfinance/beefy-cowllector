const unwrapSubsidy = require('../scripts/unwrapSubsidy');

const run = async () => {
  console.log('>>>>>', 'unwrapSubsidy()');
  await unwrapSubsidy();
};

run();
