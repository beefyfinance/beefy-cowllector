const ethers = require('ethers');

const TimelockAbi = require('../../abis/TimelockController.json');

const execute = async ({ timelockAddr, target, value, data, predecessor, salt, signer }) => {
  const timelock = new ethers.Contract(timelockAddr, TimelockAbi, signer);

  try {
    const operationHash = await timelock.hashOperation(target, value, data, predecessor, salt);

    const isOperationReady = await timelock.isOperationReady(operationHash);
    if (!isOperationReady) {
      console.log(`${target} is not an operation or not ready, skipping.`);
      return;
    } else {
      console.log(
        `Operation ${operationHash} should be executed.`,
        target,
        value,
        data,
        predecessor,
        salt
      );
    }

    let tx = await timelock.execute(target, value, data, predecessor, salt, { gasLimit: 3000000 });
    tx = await tx.wait();

    tx.status === 1
      ? console.log(`${target} executed with tx: ${tx.transactionHash}`)
      : console.log(`${target} failed with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong with ${target}: ${e}`);
  }
};

module.exports = execute;
