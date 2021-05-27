const ethers = require('ethers');

const strats = require('../data/strats.json');
const chains = require('../data/chains');

const abi = [
  'function setCallFee(uint256 _callFee) public',
  'function callFee() public view returns (uint256)',
];

const config = {
  chainToUpdate: 137,
  newCallFee: 11,
};

async function main() {
  for (const strat of strats) {
    // Not the chain we're interested. Skip.
    if (strat.chainId !== config.chainToUpdate) continue;

    const provider = new ethers.providers.JsonRpcProvider(chains[strat.chainId].rpc);
    const signer = new ethers.Wallet(process.env.REWARDER_PRIVATE_KEY, provider);
    const stratContract = new ethers.Contract(strat.address, abi, signer);

    const callFee = await stratContract.callFee();

    // The call fee is already the target value.
    if (callFee.eq(config.newCallFee)) continue;

    // Update the call fee.
    let tx = await stratContract.setCallFee(config.newCallFee);
    tx = await tx.wait();

    const newCallFee = await stratContract.callFee();

    tx.status === 1
      ? console.log(
          `Call fee updated for ${strat.name}. Old: ${callFee} | New: ${newCallFee}. done with tx: ${tx.transactionHash}`
        )
      : console.log(`Call fee update for ${strat.name} failed with tx: ${tx.transactionHash}`);
  }
}

main();
