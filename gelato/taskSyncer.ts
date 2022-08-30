import FETCH, {type Response} from 'node-fetch'; //pull in of type Response needed due to 
                                                 //  clash with WebWorker's version
import { Wallet } from 'ethers';
import { GelatoClient } from './gelatoClient';
import type { IChainOch, IStratToHrvst } from './interfaces';

type VaultRecord = Record<IStratToHarvest['earnedToken'], IStratToHarvest['earnContractAddress']>;
type HitType = 'created OCH task' | 'deleted OCH task' | 'named OCH task';
interface Hit {
  readonly id: string;
  type:
    | HitType
    | { type: HitType; detail: string }
    | (HitType | { type: HitType; detail: string })[];
}
class Hits {
  readonly hits: Record<string, Hit> = {};
  add(id: string, type: Readonly<HitType>, detail?: string): void {
    if (!id) return;
    const hit = this.hits[id];
    if (!hit) this.hits[id] = { id: id, type: !detail ? type : { type, detail } };
    else if (!Array.isArray(hit.type)) hit.type = [hit.type, !detail ? type : { type, detail }];
    else hit.type.push(!detail ? type : { type, detail });
  } //add(
} //class Hits

const _logger = logger.getLogger('TaskSync');

export class TaskSyncer {
  private readonly _gelatoClient: GelatoClient;

  constructor( gelatoAdmin_: Readonly< Wallet>, 
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
                                                  stratsToHarvest.reduce( (map, strat) => {
                        if (strat.chain !== this._chain.id || map[ strat.earnedToken])  {
                          if (strat.chain === this._chain.id)
                            console.log( `Duplicate ${strat.chain.toUpperCase()
                                                    } vault-token: ${strat.earnedToken}`);
                        }else
                          map[ strat.earnedToken] = strat;
                        return map;
                      }, {} as Record< string, IStratToHrvst>), 
            vaultsActive: Readonly< Record< IStratToHrvst[ 'earnedToken'], 
                                            IStratToHrvst[ 'earnContractAddress']>> = 
                                                  this._filterForOchVaults( vaultsOnChain);

    const [vaultsMissingTask, taskIds]: Readonly< [Record< 
                                            IStratToHrvst[ 'earnedToken'], 
                                            IStratToHrvst[ 'earnContractAddress']> | null, 
                                                    Record< string, boolean>]> = 
                                          await this._vaultsWithMissingTask( vaultsActive);

    //create a Gelato task for any missing vault
    if (vaultsMissingTask)
      this._gelatoClient.createTasks( vaultsMissingTask);

    //if any Gelato task has become superfluous, delete it
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

  
  private async _vaultsWithMissingTask( vaults: Readonly< Record< 
                                                IStratToHrvst[ 'earnedToken'], 
                                                IStratToHrvst[ 'earnContractAddress']>>) : 
                                    Promise< [Record< IStratToHrvst[ 'earnedToken'], 
                                              IStratToHrvst[ 'earnContractAddress']> | null, 
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
      const taskId: string = await this._gelatoClient.computeTaskId( vaultAddress);
      if (undefined == taskIds[ taskId]) {
        console.log( `Missing task for ${vaultName}`);
        vaultsWithMissingTask[ vaultName] = vaultAddress;
        dirty = true;
      }else
        taskIds[ taskId] = true;
     }));

    if (dirty)
      console.log( `\nMissing task for ${Object.keys( vaultsWithMissingTask).length
                                                                            } vaults.\n`);
    return [dirty ? vaultsWithMissingTask : null, taskIds];
  } //private async _vaultsWithMissingTask(


  private _filterForOchVaults( vaults: Readonly< Record< string, IStratToHrvst>>) : 
                                Record< IStratToHrvst[ 'earnedToken'], 
                                        IStratToHrvst[ 'earnContractAddress']> {
    const vaultsOch: Record< string, string> = {};
    for (const vault in vaults) {
      if (vaults[ vault].noOnChainHrvst)
        continue;
      vaultsOch[ vaults[ vault].earnedToken] = vaults[ vault].earnContractAddress;
    }

    return vaultsOch;
  } //private _filterForOchVaults( 
} //export class TaskSyncer 
