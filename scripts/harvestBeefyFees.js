const ethers = require('ethers');

const chains = require('../data/chains');

const abi = ['function harvest() public'];

const harvestBeefyFees = async () => {
  for (chain of Object.values(chains)) {
    if (!chain.beefyFeeBatcher) continue;

    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
      const harvester = new ethers.Wallet(process.env.HARVESTER_PK, provider);
      const batcher = new ethers.Contract(chain.beefyFeeBatcher, abi, harvester);

      let tx = await batcher.harvest();
      tx = await tx.wait();
      tx.status === 1
        ? console.log(`Chain ${chain.chainId} harvested with tx: ${tx.transactionHash}`)
        : console.log(`Tx failed to harvest chain ${chain.chainId}: ${tx.transactionHash}`);
    } catch (e) {
      console.log(`harvestBeefyFees failed ${chain.chainId}: ${e}`);
    }
  }
};

module.exports = harvestBeefyFees;
