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

// Example timelock: https://snowtrace.io/address/0x37DC61A76113E7840d4A8F1c1B799cC9ac5Aa854

const executorRole = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';
const proposerRole = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';
const adminRole = '0x5f58e3a2316349923ce3780f8d587db2d72378aed66a8261c916544fa6846ca5';

const main = async () => {
  for (const [chainName, chain] of Object.entries(addressBook)) {
    if (chainName !== 'aurora') continue;

    console.log(`Reviewing chain ${chainName} timelock admins.`);

    const { strategyOwner, vaultOwner, devMultisig, treasuryMultisig, keeper, launchpoolOwner } =
      chain.platforms.beefyfinance;

    if (devMultisig === ethers.constants.AddressZero) {
      console.log(`Dev multisig missing on ${chainName}. Check for Gnosis Safe support.`);
    }

    if (treasuryMultisig === ethers.constants.AddressZero) {
      console.log(`Treasury multisig missing on ${chainName}. Check for Gnosis Safe support.`);
    }

    const chainId = chainIdFromName(chainName);
    const provider = new ethers.providers.JsonRpcProvider(chains[chainId].rpc);

    const vaultOwnerContract = new ethers.Contract(vaultOwner, TimelockAbi, provider);
    const strategyOwnerContract = new ethers.Contract(strategyOwner, TimelockAbi, provider);

    // 1. Review that the correct executors and proposers are active.

    const proposers = [launchpoolOwner];
    const executors = [launchpoolOwner, keeper];

    for (const member of proposers) {
      let hasRole = await vaultOwnerContract.hasRole(proposerRole, member);
      if (!hasRole) {
        console.log(
          `${member} is missing proposer role in vault owner timelock ${vaultOwner} in chain ${chainName}`
        );

        let data = timelockInterface.encodeFunctionData('grantRole', [proposerRole, member]);
        console.log('data', data);

        // Check if a tx is scheduled:
        const operationHash = await vaultOwnerContract.hashOperation(
          vaultOwner,
          0,
          data,
          ethers.constants.HashZero,
          ethers.constants.HashZero
        );
        console.log('operation hash', operationHash);

        const isOperation = await vaultOwnerContract.isOperation(operationHash);
        console.log('isOperation', isOperation);
        if (isOperation) {
          // Check if it's ready
          const isOperationReady = await vaultOwnerContract.isOperationReady(operationHash);
          if (isOperationReady) {
          } else {
            console.log(
              `Operation to add ${member} as proposer for ${vaultOwner} on chain ${chainName} is not ready.`
            );
          }
        } else {
          // Give all the params to schedule the tx:
          console.log(
            `You should schedule a transaction on timelock ${vaultOwner} on chain ${chainName}`
          );
          console.log(
            `Params are ${vaultOwner}, 0, ${data}, ${ethers.constants.HashZero}, ${ethers.constants.HashZero}, 0`
          );
        }
      }
      hasRole = await strategyOwnerContract.hasRole(proposerRole, member);
      if (!hasRole) {
        console.log(
          `${member} is missing proposer role in strategy owner timelock ${strategyOwner} in chain ${chainName}`
        );
      }
    }

    // for (const member of executors) {
    //   let hasRole = await vaultOwnerContract.hasRole(executorRole, member);
    //   if (!hasRole) {
    //     console.log(
    //       `${member} is missing executor role in vault owner timelock ${vaultOwner} in chain ${chainName}`
    //     );
    //   }
    //   hasRole = await strategyOwnerContract.hasRole(executorRole, member);
    //   if (!hasRole) {
    //     console.log(
    //       `${member} is missing executor role in strategy owner timelock ${strategyOwner} in chain ${chainName}`
    //     );
    //   }
    // }

    // // 2. Review that the outdated executors and proposers have lost access.
    // for (const member of outdatedAdmins) {
    //   let hasRole = await vaultOwnerContract.hasRole(proposerRole, member);
    //   if (hasRole) {
    //     console.log(
    //       `${member} is still proposer in vault owner timelock ${vaultOwner} in chain ${chainName}`
    //     );
    //   }
    //   hasRole = await strategyOwnerContract.hasRole(proposerRole, member);
    //   if (hasRole) {
    //     console.log(
    //       `${member} is still proposer in strategy owner timelock ${strategyOwner} in chain ${chainName}`
    //     );
    //   }
    // }

    // for (const member of outdatedAdmins) {
    //   let hasRole = await vaultOwnerContract.hasRole(executorRole, member);
    //   if (hasRole) {
    //     console.log(
    //       `${member} is still executor in vault owner timelock ${vaultOwner} in chain ${chainName}`
    //     );
    //   }
    //   hasRole = await strategyOwnerContract.hasRole(executorRole, member);
    //   if (hasRole) {
    //     console.log(
    //       `${member} is still executor in strategy owner timelock ${strategyOwner} in chain ${chainName}`
    //     );
    //   }
    // }

    // 3. Create the relevant transactions for each one.

    console.log(`Chain ${chainName} done. \n`);
  }
};

main();
