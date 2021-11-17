const ethers = require('ethers');

const TimelockAbi = require('../../abis/TimelockController.json');
const findDuplicates = require('../../utils/findDuplicates');

const scheduleBatch = async ({
  timelockAddr,
  targets,
  values,
  data,
  predecessor,
  salt,
  signer,
}) => {
  const timelock = new ethers.Contract(timelockAddr, TimelockAbi, signer);

  const duplicates = findDuplicates(targets);
  if (duplicates.length) {
    console.log(`Be careful, some targets have duplicates: ${duplicates}`);
  }

  try {
    const operationHash = await timelock.hashOperationBatch(
      targets,
      values,
      data,
      predecessor,
      salt
    );

    const isOperation = await timelock.isOperation(operationHash);
    if (isOperation) {
      console.log(`Tx is scheduled already, skipping.`);
      return;
    }

    const minDelay = await timelock.getMinDelay();

    let tx = await timelock.scheduleBatch(targets, values, data, predecessor, salt, minDelay, {
      gasLimit: 3000000,
    });
    tx = await tx.wait();

    tx.status === 1
      ? console.log(`Scheduled with tx: ${tx.transactionHash}`)
      : console.log(`Failed with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong: ${e}`);
  }
};

module.exports = scheduleBatch;
