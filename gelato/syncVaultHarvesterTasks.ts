const fetch = require('node-fetch');
import fs from 'fs';
import { VaultConfig } from './interfaces/VaultConfig';

export const syncVaultHarvesterTasks = async (chainName: string) => {
  const response = await fetch(
    "https://api.beefy.finance/vaults"
  );
  if (response.ok && response.body) {
    const data: VaultConfig[] = await response.json();

    const chainVaults = data.filter(vault => vault.chain === chainName)
    const activeVaultMap = getActiveVaults(chainVaults);

    console.log(JSON.stringify(activeVaultMap));
  } else {
    console.log('Fetching vaults failed');
  }
};

const getActiveVaults = (vaultList: VaultConfig[]) => {
  const vaults: Record<string, string> = {};
  for (const vault of vaultList) {
    if (vault.id.endsWith('eol')) {
      continue;
    } else {
      vaults[vault.earnedToken] = vault.earnedTokenAddress;
    }
  }
  console.log(JSON.stringify(vaults));
};
