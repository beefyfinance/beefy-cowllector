import dotenv from 'dotenv';
dotenv.config();

import { ethers, Wallet } from 'ethers';
import { TaskSyncer } from './taskSyncer';
import { gelatoIncompatibleVaultList } from "./fantomVaultDenyList";
import { Harvester } from './harvester';

export const syncFantomVaultHarvesterTasks = async () => {
  const pk = process.env.GELATO_ADMIN_PK!;
  const provider = new ethers.providers.JsonRpcProvider('https://rpc.ftm.tools');
  const gelatoAdminWallet: Wallet = new Wallet(pk, provider);

  const fantomHarvesterAddress = '0x5e7F411EE92838275c96438B6A1A93acCC16364C';

  const harvester = new Harvester(
    gelatoAdminWallet,
    'fantom',
    fantomHarvesterAddress,
    new Set(gelatoIncompatibleVaultList)
  );

  await harvester.runHarvest();
};
