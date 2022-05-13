const ethers = require('ethers');
const { addressBook } = require('blockchain-addressbook');

const chains = require('../../data/chains');
const chainIdFromName = require('../../utils/chainIdFromName');
const TimelockAbi = require('../../abis/TimelockController.json');

const outdatedAdmins = [
  '0x10aee6B5594942433e7Fc2783598c979B030eF3D',
  '0xd529b1894491a0a26B18939274ae8ede93E81dbA',
  '0x4E2a43a0Bf6480ee8359b7eAE244A9fBe9862Cdf',
];

const hwWhenNoMultisig = '0x3Eb7fB70C03eC4AEEC97C6C6C1B59B014600b7F7';

const EXECUTOR_ROLE = '0xd8aa0f3194971a2a116679f7c2090f6939c8d4e01a2a8d7e41d55e5351469e63';
const PROPOSER_ROLE = '0xb09aa5aeb3702cfd50b6b62bc4532604938f21248a27a1d5ca736082b6819cc1';

const main = async () => {
  for (const [chainName, chain] of Object.entries(addressBook)) {
    if (chainName !== 'aurora') continue;

    console.log(`Reviewing chain ${chainName} timelock admins.`);

    const chainId = chainIdFromName(chainName);
    const provider = new ethers.providers.JsonRpcProvider(chains[chainId].rpc);
    const { strategyOwner, vaultOwner, devMultisig, treasuryMultisig, keeper, launchpoolOwner } =
      chain.platforms.beefyfinance;
    const outdatedAccounts = outdatedAdmins;
    const proposers = [launchpoolOwner];
    const executors = [launchpoolOwner, keeper];

    // Review if multisigs are present and add trusted hw as forbidden.
    if (
      devMultisig !== ethers.constants.AddressZero &&
      treasuryMultisig !== ethers.constants.AddressZero
    ) {
      outdatedAccounts.push(hwWhenNoMultisig);
    }

    for (const [index, timelockAddress] of [vaultOwner, strategyOwner].entries()) {
      const timelock = new ethers.Contract(timelockAddress, TimelockAbi, provider);
      let dataList = [];

      dataList = await grantRole(timelock, proposers, PROPOSER_ROLE, dataList);
      dataList = await grantRole(timelock, executors, EXECUTOR_ROLE, dataList);
      dataList = await revokeRole(timelock, outdatedAccounts, PROPOSER_ROLE, dataList);
      dataList = await revokeRole(timelock, outdatedAccounts, EXECUTOR_ROLE, dataList);

      printTxs(executeDataList, scheduleDataList, timelock, chainName, index);
    }
    console.log(`Chain ${chainName} done. \n`);
  }
};

const grantRole = async (timelock, accounts, role, dataList) => {
  let newDataList = [...dataList];

  for (const account of accounts) {
    let hasRole = await timelock.hasRole(role, account);

    if (!hasRole) {
      const timelockInterface = new ethers.utils.Interface(TimelockAbi);
      let data = timelockInterface.encodeFunctionData('grantRole', [role, admin]);
      newDataList.push(data);
    }
  }

  return newDataList;
};

const revokeRole = async (timelock, accounts, role, dataList) => {
  let newDataList = [...dataList];

  for (const account of accounts) {
    let hasRole = await timelock.hasRole(role, account);

    if (hasRole) {
      const timelockInterface = new ethers.utils.Interface(TimelockAbi);
      let data = timelockInterface.encodeFunctionData('revokeRole', [role, admin]);
      newDataList.push(data);
    }
  }

  return newDataList;
};

const printTxs = (executeList, scheduleList, timelock, chainName, timelockIndex) => {
  if (executeList.length > 0) {
    let targets = JSON.stringify(Array.from({ length: executeList.length }, () => timelock));
    let values = JSON.stringify(Array.from({ length: executeList.length }, () => 0));

    console.log(`Should execute some txs in timelock ${timelock} on ${chainName}`);
    console.log(`Targets: ${targets}`);
    console.log(`Values: ${values}`);
    console.log(`Data: ${JSON.stringify(executeList)}`);
    console.log(`Predecessor: ${ethers.constants.HashZero}`);
    console.log(`Salt: ${ethers.constants.HashZero}`);
  }

  if (scheduleList.length > 0) {
    let targets = JSON.stringify(Array.from({ length: scheduleList.length }, () => timelock));
    let values = Array.from({ length: scheduleList.length }, () => 0);

    console.log(`Should schedule some txs in timelock ${timelock} on ${chainName}`);
    console.log(`Targets: ${targets}`);
    console.log(`Values: ${values}`);
    console.log(`Data: ${JSON.stringify(scheduleList)}`);
    console.log(`Predecessor: ${ethers.constants.HashZero}`);
    console.log(`Salt: ${ethers.constants.HashZero}`);
    console.log(`Min Delay: ${timelockIndex === 0 ? 0 : 21600}`);
  }
};

main();

// // Check if a tx is scheduled:
// const operationHash = await timelock.hashOperation(
//   timelock.address,
//   0,
//   data,
//   ethers.constants.HashZero,
//   ethers.constants.HashZero
// );
// const isOperation = await timelock.isOperation(operationHash);
// if (isOperation) {
//   const isOperationReady = await timelock.isOperationReady(operationHash);
//   if (isOperationReady) {
//     return [[...executeDataList, data], scheduleDataList];
//   }
// } else {
//   return [executeDataList, [...scheduleDataList, data]];
// }
