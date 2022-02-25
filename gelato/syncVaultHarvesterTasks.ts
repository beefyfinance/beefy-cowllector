import fetch from 'node-fetch';
import fs from 'fs';
import { VaultConfig } from './interfaces/vault';

const syncVaultHarvesterTasks = async () => {
  const response = await fetch(
    'https://raw.githubusercontent.com/beefyfinance/beefy-app/prod/src/features/configure/vault/fantom_pools.js'
  );
  if (response.ok && response.body) {
    const fantomVaultsFileName = './vaults.js';
    fs.writeFileSync(fantomVaultsFileName, response.body.read());

    const vaults = await import(fantomVaultsFileName);
    const activeVaultMap = getActiveVaults(vaults);

    
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
