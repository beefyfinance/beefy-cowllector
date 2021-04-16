const updateDefistation = require('../scripts/updateDefistation');

const run = async () => {
  console.log('>>>>>', 'updateDefistation()');
  await updateDefistation();
};

run();
