const fetch = require('node-fetch');
import fs from 'fs';
import { VaultConfig } from './interfaces/vault';

export const syncVaultHarvesterTasks = async () => {
  const response = await fetch(
    'https://raw.githubusercontent.com/beefyfinance/beefy-app/prod/src/features/configure/vault/fantom_pools.js'
  );
  if (response.ok && response.body) {
    const fantomVaultsFileName = 'vaults.ts';
    const relativePath = "./gelato/";
    const writePath = `${relativePath}${fantomVaultsFileName}`;
    const data = await response.text();
    fs.writeFileSync(writePath, data);

    const mod = await import(`./${fantomVaultsFileName}`);
    const activeVaultMap = getActiveVaults(mod.fantomPools);

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
