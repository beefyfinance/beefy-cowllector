const ethers = require('ethers');

const IStrategy = require('../../abis/IStrategy.json');

const setBeefyFeeRecipient = async ({ strat, recipient, signer }) => {
  const stratContract = new ethers.Contract(strat, IStrategy, signer);

  let currentRecipient;
  try {
    currentRecipient = await stratContract.beefyFeeRecipient();
  } catch (e) {
    console.log(`Strat ${strat} does not implement 'beefyFeeRecipient'.`);
    return;
  }

  if (currentRecipient === recipient) {
    console.log(`Strat ${strat} already has the correct recipient.`);
    return;
  }

  try {
    let tx = await stratContract.setBeefyFeeRecipient(recipient, {
      gasLimit: 100000,
    });
    tx = await tx.wait();

    const newRecipient = await stratContract.beefyFeeRecipient();

    tx.status === 1
      ? console.log(
          `Recipient updated for ${strat}. Old: ${currentRecipient} | New: ${newRecipient}. done with tx: ${tx.transactionHash}`
        )
      : console.log(`Recipient update for ${strat} failed with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong with ${strat}: ${e}`);
  }
};

module.exports = setBeefyFeeRecipient;
