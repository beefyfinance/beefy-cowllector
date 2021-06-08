const ethers = require('ethers');

const chains = require("../../data/chains");

const abi = ['function panic() public'];

const config = {
  chainId: 250,
  newKeeper: "0x10aee6B5594942433e7Fc2783598c979B030eF3D",
  contracts: [
    '0xb16ceE470632ba94b7d21d2bC56d284ff0b0C04C',
    '0xBF36AF3bfE6C4cD0286C24761060488eB1af2618',
    '0xf8B5Cb47232938f1A75546fA5182b8af312Fc380',
    '0xfA416c3b89cc2E7902F58A4bEA62Ab7E24bd5985',
    '0x45973436B06e46dc37333e65f98A190A392476a4',
    '0xB126E22F4d9EfE943c94E0Ef493FF34f98AdC9E1',
  ],
};

async function main() {
  for (const contract of config.contracts) {
    const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
    const signer = new ethers.Wallet(process.env.REWARDER_PK, provider);
    const stratContract = new ethers.Contract(contract, abi, signer);

    let keeper;
    try {
      keeper = await stratContract.keeper();
    } catch (e) {
      console.log(`Strat ${contract} does not implement 'keeper'. Will leave unchanged.`);
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
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
