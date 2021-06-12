const fs = require('fs');
const path = require('path');

const addVault = require('../utils/addVault');
const strats = require('../data/strats.json');
const vaults = require('../data/defistation.json');

const args = process.argv.slice(2);

if (!args.length) {
  console.log('Usage: Need to pass a vault address as argument.');
  return;
}

const main = async () => {
  try {
    const { newVaults, newStrats } = await addVault({
      vault: args[0],
      chainId: Number(args[1]) || 56,
      interval: Number(args[2]) || 6,
      vaults,
      strats,
    });

    fs.writeFileSync(
      path.resolve(__dirname, '..', 'data', 'defistation.json'),
      JSON.stringify(newVaults, null, 2)
    );

    fs.writeFileSync(
      path.resolve(__dirname, '..', 'data', 'strats.json'),
      JSON.stringify(newStrats, null, 2)
    );
  }
  catch (e) {
    console.error(e);
  }
};

main();
