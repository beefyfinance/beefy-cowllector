import FETCH, {type Response} from 'node-fetch'; //pull in of type Response 
																//	needed due to clash with WebWorker's version
//import { Wallet } from 'ethers';
import { NonceManager } from '@ethersproject/experimental'
import { GelatoClient } from './gelatoClient';
import type { IChainOch, IStratToHrvst } from './interfaces';

type VaultRecord = Record< IStratToHrvst[ 'earnedToken'], 
														IStratToHrvst[ 'earnContractAddress']>;

export class TaskSyncer {
  private readonly _gelatoClient: GelatoClient;

// constructor( gelatoAdmin_: Readonly< Wallet>, 
  constructor( readonly gelatoAdmin_: NonceManager, 
                private readonly _chain: Readonly< IChainOch >) {
    this._gelatoClient = new GelatoClient( gelatoAdmin_, _chain, false);
  }


  public async syncVaultHarvesterTasks() : Promise< void> {
    let stratsToHarvest: ReadonlyArray< IStratToHrvst>;

    try {
      stratsToHarvest = <ReadonlyArray< IStratToHrvst>> require( 
																									'../data/stratsToHrvst.json');
    } catch (error: unknown)  {
      console.log( error);
      return;
    }
  }

    const vaultsOnChain: Readonly< Record< string, IStratToHrvst>> = 
												stratsToHarvest.reduce( (map, strat: IStratToHrvst) => {
									if (strat.chain !== this._chain.id || map[ 
																													strat.earnedToken])  {
										if (strat.chain === this._chain.id)
											console.log( `Duplicate ${strat.chain.toUpperCase()
																					} vault-token: ${strat.earnedToken}`);
										}else
											map[ strat.earnedToken] = strat;
										return map;
									}, {} as Record< string, IStratToHrvst>), 
            vaultsActive: Readonly< VaultRecord> = this._filterForOchVaults( 
																																vaultsOnChain);

    const [vaultsMissingTask, taskIds]: Readonly< [VaultRecord | null, 
                                                   Record< string, boolean>]> = 
															await this._vaultsWithMissingTask( vaultsActive);

    //create a Gelato task for any missing vault
    if (vaultsMissingTask)
      this._gelatoClient.createTasks( vaultsMissingTask);

    //if any Gelato task has become superfluous, delete it ("cancel" it, in 
		//	Gelato parlance)
    if (taskIds)  {
      const tasksToDelete: ReadonlySet< string> = Object.entries( 
																						taskIds).reduce( (set, taskId) => {
																										if (!taskId[ 1])
																											set.add( taskId[ 0]);
																										return set;
																									}, new Set< string>());
      if (tasksToDelete.size)
        this._gelatoClient.deleteTasks( tasksToDelete);
    }
  } //public async syncVaultHarvesterTasks(

  
  private async _vaultsWithMissingTask( vaults: Readonly< VaultRecord>) : 
																				Promise< [VaultRecord | null, 
                                                  Record< string, boolean>]> {
    const vaultsWithMissingTask: Record< string, string> = {}, 
          taskIds: Record< string, boolean> = 
										(await this._gelatoClient.getGelatoAdminTaskIds()).reduce( 
																														(map, taskId) =>  {
																							map[ taskId] = false;
																							return map;
																						}, {} as Record< string, boolean>);
  
    let dirty: boolean = false;

/*let vaultName = Object.entries( vaults)[ 0][ 0];*//*(Object.keys( vaults).forEach( async (vaultName: string) => {*/
    await Promise.all( Object.keys( vaults).map( async (vaultName: string) => {
      const vaultAddress: string = vaults[ vaultName];
      const taskId: string = await this._gelatoClient.computeTaskId( 
																																	vaultAddress);
      if (undefined == taskIds[ taskId]) {
        console.log( `Missing task for ${vaultName}`);
        vaultsWithMissingTask[ vaultName] = vaultAddress;
        dirty = true;
      }else
        taskIds[ taskId] = true;
     })); //await Promise.all( Object.keys( vaults).map(

    if (dirty)
      console.log( `\nMissing task for ${Object.keys( 
																	 vaultsWithMissingTask).length } vaults.\n`);
    return [dirty ? vaultsWithMissingTask : null, taskIds];
  } //private async _vaultsWithMissingTask(


  private _filterForOchVaults( vaults: Readonly< Record< string, 
																								IStratToHrvst>>) : VaultRecord {
    const vaultsOch: VaultRecord = {};
    for (const vault in vaults) {
      if (vaults[ vault].noOnChainHrvst)
        continue;
      vaultsOch[ vaults[ vault].earnedToken] = vaults[ 
																										vault].earnContractAddress;
    }

    return vaultsOch;
  } //private _filterForOchVaults( 
} //class TaskSyncer 
