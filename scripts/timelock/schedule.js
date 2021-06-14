const ethers = require('ethers');

const TimelockAbi = require('../../abis/TimelockController.json');

const schedule = async ({ timelockAddr, target, value, data, predecessor, salt, signer }) => {
  const timelock = new ethers.Contract(timelockAddr, TimelockAbi, signer);

  try {
    const operationHash = await timelock.hashOperation(target, value, data, predecessor, salt);

    const isOperation = await timelock.isOperation(operationHash);
    if (isOperation) {
      console.log(`${target} is scheduled already, skipping.`);
      return;
    }

    const minDelay = await timelock.getMinDelay();

    let tx = await timelock.schedule(target, value, data, predecessor, salt, minDelay, {
      gasLimit: 1000000,
    });
    tx = await tx.wait();

    tx.status === 1
      ? console.log(`Scheduled ${target} with tx: ${tx.transactionHash}`)
      : console.log(`Failed ${target} with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong: ${e}`);
  }
};

module.exports = schedule;
