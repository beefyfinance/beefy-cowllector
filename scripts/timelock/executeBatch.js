const ethers = require('ethers');

const TimelockAbi = require('../../abis/TimelockController.json');

const executeBatch = async ({ timelockAddr, targets, values, data, predecessor, salt, signer }) => {
  const timelock = new ethers.Contract(timelockAddr, TimelockAbi, signer);

  try {
    const operationHash = await timelock.hashOperationBatch(
      targets,
      values,
      data,
      predecessor,
      salt
    );

    const isOperationReady = await timelock.isOperationReady(operationHash);
    if (!isOperationReady) {
      console.log(`${operationHash} is not an operation or not ready, skipping.`);
      return;
    } else {
      console.log(`Operation ${operationHash} should be executed.`);
    }

    let tx = await timelock.executeBatch(targets, values, data, predecessor, salt, {
      gasLimit: 5000000,
    });
    tx = await tx.wait();

    tx.status === 1
      ? console.log(`Executed with tx: ${tx.transactionHash}`)
      : console.log(`Failed with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong with ${targets}: ${e}`);
  }
};

module.exports = executeBatch;
