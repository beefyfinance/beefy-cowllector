const ethers = require('ethers');

const WBNB = require('../abis/WBNB.json');

const unwrapSubsidy = async () => {
  const provider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
  const harvester = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);

  const wbnb = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c';
  const wbnbContract = new ethers.Contract(wbnb, WBNB, harvester);
  const balance = await wbnbContract.balanceOf(harvester.address);

  if (balance > 0) {
    try {
      await wbnbContract.withdraw(balance.toString());
      console.log(`Successfully unwrapped ${balance.toString()}`);
    } catch (e) {
      console.log(`Coulnt' unwrap: ${e}`);
    }
  }
};

module.exports = unwrapSubsidy;
