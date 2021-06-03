const ethers = require('ethers');

const chains = require('../data/chains');
const { getVaults } = require('../utils/getVaults');

const abi = [
  'function transferOwnership(address _owner) public',
  'function owner() public view returns (address)',
];

const config = {
  chainId: 137,
  owner: '0x4E2a43a0Bf6480ee8359b7eAE244A9fBe9862Cdf',
};

const main = async () => {
  const vaults = await getVaults(chains[config.chainId].appVaultsFilename);

  for (vault of vaults) {
    const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
    const signer = new ethers.Wallet(process.env.REWARDER_PK, provider);
    const contract = new ethers.Contract(vault.earnContractAddress, abi, signer);

    let owner;
    try {
      owner = await contract.owner();
    } catch (e) {
      console.log(`Contract ${vault.id} does not implement 'Ownable'. Will leave unchanged.`);
      continue;
    }

    if (owner === config.owner) {
      console.log(`Contract ${vault.id} already has the correct owner.`);
      continue;
    }

    try {
      let tx = await contract.transferOwnership(config.owner, {
        gasLimit: 100000,
      });
      tx = await tx.wait();

      const newOwner = await contract.owner();

      tx.status === 1
        ? console.log(
            `Owner updated for ${vault.name}. Old: ${owner} | New: ${newOwner}. done with tx: ${tx.transactionHash}`
          )
        : console.log(`Owner update for ${vault.name} failed with tx: ${tx.transactionHash}`);
    } catch (e) {
      console.log(`Something went wrong with ${vault.name}: ${e}`);
    }
  }
};

main();
