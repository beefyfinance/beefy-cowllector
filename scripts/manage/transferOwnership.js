const ethers = require('ethers');

const abi = [
  'function owner() public view returns (address)',
  'function transferOwnership(address newOwner) public',
];

const transferOwnership = async ({ address, owner, signer }) => {
  const contract = new ethers.Contract(address, abi, signer);

  let currentOwner;
  try {
    currentOwner = await contract.owner();
  } catch (e) {
    console.log(`${address} does not implement 'Ownable'`);
    return;
  }

  if (currentOwner === owner) {
    console.log(`${address} already has the target owner.`);
    return;
  }

  try {
    let tx = await contract.transferOwnership(owner, {
      gasLimit: 100000,
    });
    tx = await tx.wait();

    const newOwner = await contract.owner();

    tx.status === 1
      ? console.log(
          `Owner updated for ${address}. Old: ${currentOwner} | New: ${newOwner}. done with tx: ${tx.transactionHash}`
        )
      : console.log(`Owner update for ${address} failed with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong with ${address}: ${e}`);
  }
};

module.exports = transferOwnership;
