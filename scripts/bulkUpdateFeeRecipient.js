const ethers = require('ethers');

const chains = require('../data/chains');
const strats = require('../data/strats.json');

const abi = [
  'function setBeefyFeeRecipient(address _beefyFeeRecipient) public',
  'function beefyFeeRecipient() public view returns (address)',
];

const config = {
  chainId: 43114,
  beefyFeeRecipient: '0x85517F37d1e2ab145094A74C4E1DfE87E4D3f631',
};

const main = async () => {
  for (strat of strats) {
    if (strat.chainId !== config.chainId) continue;

    const provider = new ethers.providers.JsonRpcProvider(chains[strat.chainId].rpc);
    const signer = new ethers.Wallet(process.env.UPGRADER_PK, provider);
    const stratContract = new ethers.Contract(strat.address, abi, signer);

    let beefyFeeRecipient;
    try {
      beefyFeeRecipient = await stratContract.beefyFeeRecipient();
    } catch (e) {
      console.log(
        `Strat ${strat.name} does not implement 'beefyFeeRecipient'. Will leave unchanged.`
      );
      continue;
    }

    if (beefyFeeRecipient === ethers.constants.AddressZero) {
      console.log(`Strat ${strat.name} is burning the fee. Will leave unchanged.`);
      continue;
    }

    if (beefyFeeRecipient === config.beefyFeeRecipient) {
      console.log(`Strat ${strat.name} already has the correct beefy fee recipient.`);
      continue;
    }

    try {
      let tx = await stratContract.setBeefyFeeRecipient(config.beefyFeeRecipient, {
        gasLimit: 100000,
      });
      tx = await tx.wait();

      const newBeefyFeeRecipient = await stratContract.beefyFeeRecipient();

      tx.status === 1
        ? console.log(
            `Beefy fee recipient updated for ${strat.name}. Old: ${beefyFeeRecipient} | New: ${newBeefyFeeRecipient}. done with tx: ${tx.transactionHash}`
          )
        : console.log(
            `Beefy fee recipent update for ${strat.name} failed with tx: ${tx.transactionHash}`
          );
    } catch (e) {
      console.log(`Something went wrong with ${strat.name}: ${e}`);
    }
  }
};

main();
