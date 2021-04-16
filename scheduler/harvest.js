const harvest = require('../scripts/harvest');

const run = async () => {
  console.log('>>>>>', 'harvest()');
  await harvest();
};

run();
