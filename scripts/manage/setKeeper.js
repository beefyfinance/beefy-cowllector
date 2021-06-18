const ethers = require('ethers');

const IStrategy = require('../../abis/IStrategy.json');

const setKeeper = async ({ strat, keeper, signer }) => {
  const stratContract = new ethers.Contract(strat, IStrategy, signer);

  let currentKeeper;
  try {
    currentKeeper = await stratContract.keeper();
  } catch (e) {
    console.log(`Strat ${strat} does not implement 'keeper'. Will leave unchanged.`);
    return;
  }

  if (currentKeeper === keeper) {
    console.log(`Strat ${strat} already has the target keeper.`);
    return;
  }

  try {
    let tx = await stratContract.setKeeper(keeper, {
      gasLimit: 100000,
    });
    tx = await tx.wait();

    const newKeeper = await stratContract.keeper();

    tx.status === 1
      ? console.log(
          `Keeper updated for ${strat}. Old: ${currentKeeper} | New: ${newKeeper}. done with tx: ${tx.transactionHash}`
        )
      : console.log(`Keeper update for ${strat} failed with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong with ${strat}: ${e}`);
  }
};

module.exports = setKeeper;
