import dotenv from 'dotenv';
dotenv.config();

import { ethers, Wallet } from 'ethers';
import { TaskSyncer } from './taskSyncer';

export const syncFantomVaultHarvesterTasks = async () => {
  const pk = process.env.GELATO_ADMIN_PK!;
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.ftm.tools');
  const gelatoAdminWallet: Wallet = new Wallet(pk, provider);

  const fantomHarvesterAddress = '0x5e7F411EE92838275c96438B6A1A93acCC16364C';
  const fantomOpsAddress = '0x6EDe1597c05A0ca77031cBA43Ab887ccf24cd7e8';

  const vaultDenyList = new Set([
    'mooGeistMIM',
    'mooGeistCRV',
    'mooGeistFTM',
    'mooGeistWBTC',
    'mooGeistETH',
    'mooGeistfUSDT',
    'mooGeistUSDC',
    'mooGeistDAI',
    'mooGeistGEIST-WFTM',
  ]);

  const taskSyncer = new TaskSyncer(
    gelatoAdminWallet,
    'fantom',
    fantomHarvesterAddress,
    fantomOpsAddress,
    vaultDenyList
  );
};
