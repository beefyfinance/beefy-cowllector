const ethers = require('ethers');

const WrappedNative = require('../abis/WrappedNative.json');
const chains = require('../data/chains');

const unwrapSubsidy = async () => {
  for (chain of Object.values(chains)) {
    try {
      console.log(`Unwrapping ${chain.id}`);

      const provider = new ethers.providers.JsonRpcProvider(chain.rpc);
      const harvester = new ethers.Wallet(process.env.HARVESTER_PK, provider);

      const wrappedNativeContract = new ethers.Contract(chain.wnative, WrappedNative, harvester);
      const balance = await wrappedNativeContract.balanceOf(harvester.address);

      if (balance > 0) {
        let tx = await wrappedNativeContract.withdraw(balance.toString(), { gasLimit: 300000 });
        tx = await tx.wait();

        tx.status === 1
          ? console.log(
              `Successfully unwrapped ${balance.toString()} with tx: ${tx.transactionHash}.`
            )
          : console.log(`Unwrap of ${balance.toString()} failed with tx: ${tx.transactionHash}`);
      }
    } catch (e) {
      console.log(`Something went wrong with chain ${chain.chainId}. Couldn't unwrap: ${e}`);
    }
  }
};

module.exports = unwrapSubsidy;
