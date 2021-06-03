const ethers = require('ethers');

const chains = require('../data/chains');
const strats = require('../data/strats.json');

const abi = [
  'function transferOwnership(address _owner) public',
  'function owner() public view returns (address)',
];

const config = {
  chainId: 137,
  owner: '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F',
};

const main = async () => {
  for (strat of strats) {
    if (strat.chainId !== config.chainId) continue;

    const provider = new ethers.providers.JsonRpcProvider(chains[strat.chainId].rpc);
    const signer = new ethers.Wallet(process.env.REWARDER_PK, provider);
    const stratContract = new ethers.Contract(strat.address, abi, signer);

    let owner;
    try {
      owner = await stratContract.owner();
    } catch (e) {
      console.log(`Strat ${strat.name} does not implement 'Ownable'. Will leave unchanged.`);
      continue;
    }

    if (owner === config.owner) {
      console.log(`Strat ${strat.name} already has the correct owner.`);
      continue;
    }

    try {
      let tx = await stratContract.transferOwnership(config.owner, {
        gasLimit: 100000,
      });
      tx = await tx.wait();

      const newOwner = await stratContract.owner();

      tx.status === 1
        ? console.log(
            `Owner updated for ${strat.name}. Old: ${owner} | New: ${newOwner}. done with tx: ${tx.transactionHash}`
          )
        : console.log(`Owner update for ${strat.name} failed with tx: ${tx.transactionHash}`);
    } catch (e) {
      console.log(`Something went wrong with ${strat.name}: ${e}`);
    }
  }
};

main();
