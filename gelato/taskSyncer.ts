const fetch = require("node-fetch")
import { Wallet } from 'ethers';
import { GelatoClient } from './gelatoClient';
import { VaultConfig } from './interfaces/VaultConfig';
export class TaskSyncer {
  private static readonly beefyVaultsApiUrl = "https://api.beefy.finance/vaults";

  private readonly _gelatoClient: GelatoClient
  private readonly _chainName: string;
  private readonly _vaultDenylist: Set<string>;

  constructor(gelatoAdmin_: Wallet, chainName_: string, harvesterAddress_: string, opsAddress_: string, vaultDenylist_: Set<string>) {
    this._gelatoClient = new GelatoClient(gelatoAdmin_, harvesterAddress_, opsAddress_, true);
    this._chainName = chainName_;
    this._vaultDenylist = vaultDenylist_;
  }

  public async syncVaultHarvesterTasks() {
    const response = await fetch(TaskSyncer.beefyVaultsApiUrl);
    if (response.ok && response.body) {
      const data: VaultConfig[] = await response.json();
  
      const chainVaults = data.filter(vault => vault.chain === this._chainName)
      const activeVaultMap = this._filterForActiveVaults(chainVaults);
  
      // Get all vaults with missing tasks.
      const vaultMapOfVaultsWithMissingTasks = await this._findVaultsWithMissingTask(activeVaultMap);

      // Create tasks for all missing vaults.
      this._gelatoClient.createTasks(vaultMapOfVaultsWithMissingTasks);
    } else {
      console.log('Fetching vaults failed');
    }
  };
  
  private async _findVaultsWithMissingTask(vaultMap: Record<string, string>): Promise<Record<string, string>> {
    const vaultMapOfVaultsWithMissingTasks: Record<string, string> = {}

    const userTaskIds = await this._gelatoClient.getGelatoAdminTaskIds();
    const userTaskIdsSet = new Set(userTaskIds);
  
    for (const vaultName in vaultMap) {
        const vaultAddress = vaultMap[vaultName];
        const taskIdForVault = await this._gelatoClient.computeTaskId(vaultAddress);
        if (!userTaskIdsSet.has(taskIdForVault)) {
            console.log(`Missing task for ${vaultName}`);
            vaultMapOfVaultsWithMissingTasks[vaultName] = vaultAddress;
        }
    }

    console.log(`Missing tasks for ${Object.keys(vaultMapOfVaultsWithMissingTasks).length} vaults.`)
    return vaultMapOfVaultsWithMissingTasks;
  }

  private _filterForActiveVaults(vaultList: VaultConfig[]): Record<string, string> {
    const vaults: Record<string, string> = {};
    for (const vault of vaultList) {
      const vaultIdHasEol = vault.id.endsWith('eol');
      const vaultNameIsInDenyList = this._vaultDenylist.has(vault.earnedToken);
      
      // Must not have -eol in name, and must not be on deny list.
      if (!vaultIdHasEol && !vaultNameIsInDenyList) {
        vaults[vault.earnedToken] = vault.earnedTokenAddress;
      }
    }
    return vaults;
  };
}
