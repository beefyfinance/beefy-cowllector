const ethers = require('ethers');

const chains = require('../../data/chains');
const strats = require('../../data/strats.json');

const abi = [
  'function setKeeper(address _keeper) public',
  'function keeper() public view returns (address)',
];

const config = {
  chainId: 56,
  keeper: '0x10aee6B5594942433e7Fc2783598c979B030eF3D',
};

const main = async () => {
  for (strat of strats) {
    if (strat.chainId !== config.chainId) continue;

    const provider = new ethers.providers.JsonRpcProvider(chains[strat.chainId].rpc);
    const signer = new ethers.Wallet(process.env.REWARDER_PK, provider);
    const stratContract = new ethers.Contract(strat.address, abi, signer);

    let keeper;
    try {
      keeper = await stratContract.keeper();
    } catch (e) {
      console.log(`Strat ${strat.name} does not implement 'keeper'. Will leave unchanged.`);
      continue;
    }

    if (keeper === config.keeper) {
      console.log(`Strat ${strat.name} already has the correct keeper.`);
      continue;
    }

    try {
      let tx = await stratContract.setKeeper(config.keeper, {
        gasLimit: 100000,
      });
      tx = await tx.wait();

      const newKeeper = await stratContract.keeper();

      tx.status === 1
        ? console.log(
            `Keeper updated for ${strat.name}. Old: ${keeper} | New: ${newKeeper}. done with tx: ${tx.transactionHash}`
          )
        : console.log(`Keepper update for ${strat.name} failed with tx: ${tx.transactionHash}`);
    } catch (e) {
      console.log(`Something went wrong with ${strat.name}: ${e}`);
    }
  }
};

main();
