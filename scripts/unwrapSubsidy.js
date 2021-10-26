const ethers = require('ethers');

const WrappedNative = require('../abis/WrappedNative.json');
const chains = require('../data/chains');
const { isNewPeriodNaive } = require('../utils/harvestHelpers');

const unwrapSubsidy = async () => {
  for (chain of Object.values(chains)) {
    console.log(`Unwrapping ${chain.id}`);

    if (!chain.wnative) continue;

    if (!isNewPeriodNaive(chain.wnativeUnwrapInterval)) {
      console.log(`It's not time to unwrap ${chain.id}.`);
      continue;
    }

    try {
      const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
      const harvester = new ethers.Wallet(process.env.HARVESTER_PK, provider);

      const wrappedNativeContract = new ethers.Contract(chain.wnative, WrappedNative, harvester);
      const balance = await wrappedNativeContract.balanceOf(harvester.address);

      if (balance > 0) {
        let tx = await wrappedNativeContract.withdraw(balance.toString(), { gasLimit: 800000 });
        `Successfully unwrapped ${balance.toString()} on ${chain.id} with tx: ${
          tx.transactionHash
        }.`;
      } else {
        console.log(`There is no balance to unwrap on ${chain.id}.`);
      }
    } catch (e) {
      console.log(`Something went wrong with chain ${chain.chainId}. Couldn't unwrap: ${e}`);
    }
  }
};

module.exports = unwrapSubsidy;
