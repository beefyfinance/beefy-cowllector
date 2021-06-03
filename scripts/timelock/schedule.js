const ethers = require('ethers');

const chains = require('../../data/chains');
const TimelockAbi = require('../../abis/TimelockController.json');

const config = {
  timelockAddress: '0x6d28afD25a1FBC5409B1BeFFf6AEfEEe2902D89F',
  chainId: 137,
  target: chains[137].rewardPool,
  value: 0,
  data: '0xf2fde38b000000000000000000000000d529b1894491a0a26b18939274ae8ede93e81dba',
  predecessor: ethers.constants.HashZero,
  salt: ethers.constants.HashZero,
};

const main = async () => {
  const provider = new ethers.providers.JsonRpcProvider(chains[config.chainId].rpc);
  const signer = new ethers.Wallet(process.env.UPGRADER_PK, provider);
  const timelock = new ethers.Contract(config.timelockAddress, TimelockAbi, signer);

  try {
    const minDelay = await timelock.getMinDelay();

    let tx = await timelock.schedule(
      config.target,
      config.value,
      config.data,
      config.predecessor,
      config.salt,
      minDelay,
      { gasLimit: 1000000 }
    );
    tx = await tx.wait();

    tx.status === 1
      ? console.log(`Scheduled with tx: ${tx.transactionHash}`)
      : console.log(`Failed with tx: ${tx.transactionHash}`);
  } catch (e) {
    console.log(`Something went wrong: ${e}`);
  }
};

main();
