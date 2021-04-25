const ethers = require('ethers');

const chains = require('../data/chains');

const abi = ['function harvest() public'];

const harvestBeefyFees = async () => {
  for (chain of chains) {
    if (!chain.beefyFeeRecipient) continue;

    const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
    const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);
    const batcher = new ethers.Contract(chain.beefyFeeRecipient, abi, harvester);

    let tx = await batcher.harvest();
    tx = await tx.wait();
    tx.status === 1
      ? console.log(`harvested with tx: ${tx.transactionHash}`)
      : console.log(`Could not harvest with tx: ${tx.transactionHash}`);
  }
};

module.exports = harvestBeefyFees;
