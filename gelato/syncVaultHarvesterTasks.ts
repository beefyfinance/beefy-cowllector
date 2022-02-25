import dotenv from "dotenv";
dotenv.config();
const fetch = require('node-fetch');
import { ethers, Wallet } from 'ethers';
import { GelatoClient } from './gelatoClient';
import { VaultConfig } from './interfaces/VaultConfig';

export const syncVaultHarvesterTasks = async (chainName: string) => {
  const response = await fetch(
    "https://api.beefy.finance/vaults"
  );
  if (response.ok && response.body) {
    const data: VaultConfig[] = await response.json();

    const chainVaults = data.filter(vault => vault.chain === chainName)
    const activeVaultMap = getActiveVaults(chainVaults);

    const provider = new ethers.providers.JsonRpcProvider("https://rpc.ftm.tools");
    const pk = process.env.GELATO_ADMIN_PK!
    const gelatoAdminWallet: Wallet = new Wallet(pk, provider);
    const harvesterAddress = "0x5e7F411EE92838275c96438B6A1A93acCC16364C";
    const opsAddress = "0x6EDe1597c05A0ca77031cBA43Ab887ccf24cd7e8"
    const gelatoClient = new GelatoClient(gelatoAdminWallet, harvesterAddress, opsAddress);
    await gelatoClient.createTasks(activeVaultMap);
  } else {
    console.log('Fetching vaults failed');
  }
};

const getActiveVaults = (vaultList: VaultConfig[]): Record<string, string> => {
  const vaults: Record<string, string> = {};
  for (const vault of vaultList) {
    if (vault.id.endsWith('eol')) {
      continue;
    } else {
      vaults[vault.earnedToken] = vault.earnedTokenAddress;
    }
  }
  return vaults;
};
