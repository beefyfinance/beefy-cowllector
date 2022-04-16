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
      let executeDataList = [];
      let scheduleDataList = [];

      // Check correct proposers.
      [executeDataList, scheduleDataList] = await checkRole(
        timelockContract,
        proposers,
        proposerRole,
        true,
        executeDataList,
        scheduleDataList
      );

      // Check correct executors.
      [executeDataList, scheduleDataList] = await checkRole(
        timelockContract,
        executors,
        executorRole,
        true,
        executeDataList,
        scheduleDataList
      );

      // Check outdated proposers.
      [executeDataList, scheduleDataList] = await checkRole(
        timelockContract,
        outdatedAdmins,
        proposerRole,
        false,
        executeDataList,
        scheduleDataList
      );

      // Check outdated executors.
      [executeDataList, scheduleDataList] = await checkRole(
        timelockContract,
        outdatedAdmins,
        executorRole,
        false,
        executeDataList,
        scheduleDataList
      );

      console.log(executeDataList);
      console.log(scheduleDataList);
    }

    console.log(`Chain ${chainName} done. \n`);
  }
};

const checkRole = async (timelock, admins, role, shouldHave, executeDataList, scheduleDataList) => {
  for (const admin of admins) {
    let hasRole = await timelock.hasRole(role, admin);
    if (hasRole !== shouldHave) {
      const timelockInterface = new ethers.utils.Interface(TimelockAbi);
      let data = timelockInterface.encodeFunctionData(shouldHave ? 'grantRole' : 'revokeRole', [
        role,
        admin,
      ]);

      // Check if a tx is scheduled:
      const operationHash = await timelock.hashOperation(
        timelock.address,
        0,
        data,
        ethers.constants.HashZero,
        ethers.constants.HashZero
      );

      const isOperation = await timelock.isOperation(operationHash);
      if (isOperation) {
        const isOperationReady = await timelock.isOperationReady(operationHash);
        if (isOperationReady) {
          return [[...executeDataList, data], scheduleDataList];
        }
      } else {
        return [executeDataList, [...scheduleDataList, data]];
      }
    }
  }

  return [executeDataList, scheduleDataList];
};

main();
