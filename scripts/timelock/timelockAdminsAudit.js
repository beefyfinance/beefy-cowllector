const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const chainIdFromName = require('../../utils/chainIdFromName');
const TimelockAbi = require('../../abis/TimelockController.json');

const oldKeeper = '0x10aee6B5594942433e7Fc2783598c979B030eF3D';
const oldNotifier = '0xd529b1894491a0a26B18939274ae8ede93E81dbA';
const oldUpgrader = '0x4E2a43a0Bf6480ee8359b7eAE244A9fBe9862Cdf';

const outdatedAdmins = [oldKeeper, oldNotifier, oldUpgrader];

const timelockInterface = new ethers.utils.Interface(TimelockAbi);

const executorRole = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';
const proposerRole = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';

const main = async () => {
  for (const [chainName, chain] of Object.entries(addressBook)) {
    console.log(`Reviewing chain ${chainName} timelock admins.`);

    const chainId = chainIdFromName(chainName);
    const provider = new ethers.providers.JsonRpcProvider(chains[chainId].rpc);
    const { strategyOwner, vaultOwner, devMultisig, treasuryMultisig, keeper, launchpoolOwner } =
      chain.platforms.beefyfinance;

    // Review if multisigs are missing.
    if (devMultisig === ethers.constants.AddressZero) {
      console.log(`Dev multisig missing on ${chainName}. Check for Gnosis Safe support.`);
    }

    if (treasuryMultisig === ethers.constants.AddressZero) {
      console.log(`Treasury multisig missing on ${chainName}. Check for Gnosis Safe support.`);
    }

    // Review that the required executors and proposers are active.
    const proposers = [launchpoolOwner];
    const executors = [launchpoolOwner, keeper];

    for (const [index, timelock] of [vaultOwner, strategyOwner].entries()) {
      const timelockContract = new ethers.Contract(timelock, TimelockAbi, provider);

      // Check correct proposers.
      for (const member of proposers) {
        let hasRole = await timelockContract.hasRole(proposerRole, member);
        if (!hasRole) {
          console.log(
            `${member} is missing proposer role in timelock ${timelock} on chain ${chainName}`
          );

          let data = timelockInterface.encodeFunctionData('grantRole', [proposerRole, member]);

          // Check if a tx is scheduled:
          const operationHash = await timelockContract.hashOperation(
            timelock,
            0,
            data,
            ethers.constants.HashZero,
            ethers.constants.HashZero
          );

          const isOperation = await timelockContract.isOperation(operationHash);
          if (isOperation) {
            const isOperationReady = await timelockContract.isOperationReady(operationHash);
            if (isOperationReady) {
              console.log(`You should execute a tx on timelock ${timelock} on chain ${chainName}.`);
              console.log('Params');
              console.log(`Target: ${timelock}`);
              console.log(`Value: 0`);
              console.log(`Data: ${data}`);
              console.log(`Predecessor: ${ethers.constants.HashZero}`);
              console.log(`Data: ${ethers.constants.HashZero}`);
            } else {
              console.log(
                `Operation to add ${member} as proposer for ${vaultOwner} on chain ${chainName} is not ready.`
              );
            }
          } else {
            // Give all the params to schedule the tx:
            console.log(`You should schedule a tx in timelock ${timelock} on chain ${chainName}`);
            console.log('Params');
            console.log(`Target: ${timelock}`);
            console.log(`Value: 0`);
            console.log(`Data: ${data}`);
            console.log(`Predecessor: ${ethers.constants.HashZero}`);
            console.log(`Data: ${ethers.constants.HashZero}`);
            console.log(`Min Delay: ${index === 0 ? 0 : 21600}`);
          }
          console.log('\n');
        }
      }

      // Check correct executors.
      for (const member of executors) {
        let hasRole = await timelockContract.hasRole(executorRole, member);
        if (!hasRole) {
          console.log(
            `${member} is missing executor role in timelock ${timelock} on chain ${chainName}`
          );

          let data = timelockInterface.encodeFunctionData('grantRole', [executorRole, member]);

          // Check if a tx is scheduled:
          const operationHash = await timelockContract.hashOperation(
            timelock,
            0,
            data,
            ethers.constants.HashZero,
            ethers.constants.HashZero
          );

          const isOperation = await timelockContract.isOperation(operationHash);
          if (isOperation) {
            const isOperationReady = await timelockContract.isOperationReady(operationHash);
            if (isOperationReady) {
              console.log(`You should execute a tx on timelock ${timelock} on chain ${chainName}.`);
              console.log('Params');
              console.log(`Target: ${timelock}`);
              console.log(`Value: 0`);
              console.log(`Data: ${data}`);
              console.log(`Predecessor: ${ethers.constants.HashZero}`);
              console.log(`Data: ${ethers.constants.HashZero}`);
            } else {
              console.log(
                `Operation to add ${member} as executor for ${vaultOwner} on chain ${chainName} is not ready.`
              );
            }
          } else {
            // Give all the params to schedule the tx:
            console.log(`You should schedule a tx in timelock ${timelock} on chain ${chainName}`);
            console.log('Params');
            console.log(`Target: ${timelock}`);
            console.log(`Value: 0`);
            console.log(`Data: ${data}`);
            console.log(`Predecessor: ${ethers.constants.HashZero}`);
            console.log(`Data: ${ethers.constants.HashZero}`);
            console.log(`Min Delay: ${index === 0 ? 0 : 21600}`);
          }
          console.log('\n');
        }
      }

      // Check outdated proposers.
      for (const member of outdatedAdmins) {
        let hasRole = await timelockContract.hasRole(proposerRole, member);
        if (hasRole) {
          console.log(`${member} is still proposer in timelock ${timelock} on chain ${chainName}`);

          let data = timelockInterface.encodeFunctionData('revokeRole', [proposerRole, member]);

          // Check if a tx is scheduled:
          const operationHash = await timelockContract.hashOperation(
            timelock,
            0,
            data,
            ethers.constants.HashZero,
            ethers.constants.HashZero
          );

          const isOperation = await timelockContract.isOperation(operationHash);
          if (isOperation) {
            const isOperationReady = await timelockContract.isOperationReady(operationHash);
            if (isOperationReady) {
              console.log(`You should execute a tx on timelock ${timelock} on chain ${chainName}.`);
              console.log('Params');
              console.log(`Target: ${timelock}`);
              console.log(`Value: 0`);
              console.log(`Data: ${data}`);
              console.log(`Predecessor: ${ethers.constants.HashZero}`);
              console.log(`Data: ${ethers.constants.HashZero}`);
            } else {
              console.log(
                `Operation to remove ${member} as proposer from ${vaultOwner} on chain ${chainName} is not ready.`
              );
            }
          } else {
            // Give all the params to schedule the tx:
            console.log(`You should schedule a tx in timelock ${timelock} on chain ${chainName}`);
            console.log('Params');
            console.log(`Target: ${timelock}`);
            console.log(`Value: 0`);
            console.log(`Data: ${data}`);
            console.log(`Predecessor: ${ethers.constants.HashZero}`);
            console.log(`Data: ${ethers.constants.HashZero}`);
            console.log(`Min Delay: ${index === 0 ? 0 : 21600}`);
          }
          console.log('\n');
        }
      }

      // Check outdated executors.
      for (const member of outdatedAdmins) {
        let hasRole = await timelockContract.hasRole(executorRole, member);
        if (hasRole) {
          console.log(`${member} is still executor in timelock ${timelock} on chain ${chainName}`);

          let data = timelockInterface.encodeFunctionData('revokeRole', [executorRole, member]);

          // Check if a tx is scheduled:
          const operationHash = await timelockContract.hashOperation(
            timelock,
            0,
            data,
            ethers.constants.HashZero,
            ethers.constants.HashZero
          );

          const isOperation = await timelockContract.isOperation(operationHash);
          if (isOperation) {
            const isOperationReady = await timelockContract.isOperationReady(operationHash);
            if (isOperationReady) {
              console.log(`You should execute a tx on timelock ${timelock} on chain ${chainName}.`);
              console.log('Params');
              console.log(`Target: ${timelock}`);
              console.log(`Value: 0`);
              console.log(`Data: ${data}`);
              console.log(`Predecessor: ${ethers.constants.HashZero}`);
              console.log(`Data: ${ethers.constants.HashZero}`);
            } else {
              console.log(
                `Operation to remove ${member} as executor from ${vaultOwner} on chain ${chainName} is not ready.`
              );
            }
          } else {
            // Give all the params to schedule the tx:
            console.log(`You should schedule a tx in timelock ${timelock} on chain ${chainName}`);
            console.log('Params');
            console.log(`Target: ${timelock}`);
            console.log(`Value: 0`);
            console.log(`Data: ${data}`);
            console.log(`Predecessor: ${ethers.constants.HashZero}`);
            console.log(`Data: ${ethers.constants.HashZero}`);
            console.log(`Min Delay: ${index === 0 ? 0 : 21600}`);
          }
          console.log('\n');
        }
      }
    }

    console.log(`Chain ${chainName} done. \n`);
  }
};

main();
