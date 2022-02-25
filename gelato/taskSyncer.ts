const fetch = require("node-fetch")
import { Wallet } from 'ethers';
import { BeefyAppClient } from './beefyAppClient';
import { GelatoClient } from './gelatoClient';
import { VaultConfig } from './interfaces/VaultConfig';
export class TaskSyncer {
  private readonly _gelatoClient: GelatoClient
  private readonly _beefyAppClient: BeefyAppClient;
  private readonly _chainName: string;
  private readonly _vaultDenylist: Set<string>;

  constructor(gelatoAdmin_: Wallet, chainName: string, harvesterAddress_: string, opsAddress_: string, vaultDenylist_: Set<string>) {
    this._gelatoClient = new GelatoClient(gelatoAdmin_, harvesterAddress_, opsAddress_, false);
    this._chainName = chainName;
    this._beefyAppClient = new BeefyAppClient();
    this._vaultDenylist = vaultDenylist_;
  }

  public async syncVaultHarvesterTasks() {
      // Get all prod vaults from <chainName>_pools.js
      const prodVaults = await this._beefyAppClient.fetchVaultsForChain(this._chainName);
  
      // Filter for only the vaults gelato should harvest.
      const activeVaultMap = this._filterForActiveVaults(prodVaults);
  
      // Get all vaults with missing tasks.
      const vaultMapOfVaultsWithMissingTasks = await this._findVaultsWithMissingTask(activeVaultMap);

      // Create tasks for all missing vaults.
      this._gelatoClient.createTasks(vaultMapOfVaultsWithMissingTasks);
  }
  
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
  }
}
