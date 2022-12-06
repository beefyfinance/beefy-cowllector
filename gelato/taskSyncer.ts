import FETCH, {type Response} from 'node-fetch'; //pull in of type Response 
                                //  needed due to clash with WebWorker's version
import {NonceManage} from '../utility/NonceManage';
import type {GelatoClient} from './gelatoClient';
import type {IChainHarvester, IStratToHarvest} from './interfaces';
import {getKey, redisDisconnect} from '../utility/redisHelper';
import {logger} from '../utility/Logger';
import {sendMessage as postToDiscord} from '../utils/discordPost';

export type VaultRecord = Record< IStratToHarvest[ 'earnedToken'], 
																	IStratToHarvest[ 'earnContractAddress']>;

type HitType = 'created OCH task' | 'deleted OCH task' | 'named OCH task';
interface  Hit  {
  readonly id: string;
  type: HitType | {type: HitType, detail: string} | (HitType |  
                                            {type: HitType, detail: string})[];
}
class Hits  {
  readonly hits: Record< string, Hit> = {};
  add( id: string, 
        type: Readonly< HitType>, 
        detail?: string) : void {
    if (!id)
      return;
    const hit = this.hits[ id];
    if (!hit)
      this.hits[ id] = {id: id, type: !detail ? type : {type, detail}};
    else if (!Array.isArray( hit.type))
      hit.type = [hit.type, !detail ? type : {type, detail}];
    else
      hit.type.push( !detail ? type : {type, detail});
  } //add(
} //class Hits


const REDIS_KEY = 'STRATS_TO_HARVEST';
const _logger = logger.getLogger( 'TaskSync');


export class TaskSyncer {
	private static _stratsToHarvest: ReadonlyArray< IStratToHarvest>;
	static	{
    try {
			getKey( REDIS_KEY).then( (value: Readonly< Record< string, 
																													IStratToHarvest>>) : 
																ReadonlyArray< IStratToHarvest> => {
													redisDisconnect();
													return this._stratsToHarvest = Object.values( value);
												});
    } catch (error: unknown)  {
      _logger.error( <any> error);
			redisDisconnect();
      throw error;
    }
	} //static

  private _hits = new Hits();

  constructor( readonly gelatoAdmin_: NonceManage, 
                private readonly _chain: Readonly< IChainHarvester>,
						 		private readonly _gelatoClient: GelatoClient) {}


  public async syncVaultHarvesterTasks() : Promise< void> {
    const vaultsOnChain: Readonly< Record< string, IStratToHarvest>> = 
													TaskSyncer._stratsToHarvest.reduce( (map, strat) => {
										if (strat.chain !== this._chain.id || map[ 
                                                          strat.earnedToken])  {
											if (strat.chain === this._chain.id)
												_logger.warn( `Duplicate ${strat.chain.toUpperCase()
                                          } vault-token: ${strat.earnedToken}`);
                    }else
                      map[ strat.earnedToken] = strat;
                    return map;
                  }, {} as Record< string, IStratToHarvest>), 
            vaultsActive: Readonly< VaultRecord> = this._filterForOchVaults( 
                                                                vaultsOnChain);

		//Get the list of eligible vaults which have no Gelato-task counterpart, 
		//	noting alongside the list of vaults with active Gelato tasks.
    const [vaultsMissingTask, existingTaskIds]: Readonly< [VaultRecord | null, 
                                                   Record< string, boolean>]> = 
                              await this._vaultsWithMissingTask( vaultsActive);

    let promiseCreated: Promise< Record< string, string> | null> | undefined, 
        promiseDeleted: typeof promiseCreated;

    //create a Gelato task for any eligible vault not yet covered
    if (vaultsMissingTask)
      promiseCreated = this._gelatoClient.createTasks( vaultsMissingTask);

    //if any Gelato task has become superfluous, delete it ("cancel" it, in 
    //  Gelato parlance)
    if (existingTaskIds)  {
      const tasksToDelete: ReadonlySet< string> = Object.entries( 
																		existingTaskIds).reduce( (set, taskId) => {
                                                  if (!taskId[ 1])
                                                    set.add( taskId[ 0]);
                                                  return set;
                                                }, new Set< string>());
      if (tasksToDelete.size)
        promiseDeleted = this._gelatoClient.deleteTasks( tasksToDelete);
    }

    const report = {created: 0, deleted: 0};
		const tasksCreated = await promiseCreated; 
    if (tasksCreated) {
      const names = Object.keys( tasksCreated);
      names.forEach( name => this._hits.add( name, 'created OCH task', 
                                             `taskId: ${tasksCreated[ name]}`));
      report.created = names.length;
    }
		const tasksDeleted = await promiseDeleted; 
    if (tasksDeleted) {
      const names = Object.keys( tasksDeleted);
			names.forEach( name => this._hits.add( name, 'deleted OCH task', 
                                             `taskId: ${tasksDeleted[ name]}`));
      report.deleted = names.length;
    }

		_logger.info( `Tasks created: ${report.created}  Tasks deleted: ${
																															report.deleted}`);
    try {
      await postToDiscord( {type: 'info',
            title: `On-chain-harvester sync on ${this._chain.id.toUpperCase()}`,
            message: `+ OCH tasks created: ${report.created
													}\n+ OCH tasks deleted: ${report.deleted}` + 
													(tasksCreated || tasksDeleted ? `\n\`\`\`json\n${
													JSON.stringify( Object.values( this._hits.hits), 
													null, 2)}\n\`\`\`` : '')});
    } catch (error: unknown) {
//TODO; figure out TS to get rid of the 'any' cast, probably type-guard
      _logger.error( `Error broadcasting report : ${(<any> error).message
																	}\n* Intended Content **\n${JSON.stringify( 
																	Object.values( this._hits.hits), null, 2)}`);
    }
  } //public async syncVaultHarvesterTasks(

  
  private async _vaultsWithMissingTask( vaults: Readonly< VaultRecord>) : 
                                        Promise< [VaultRecord | null, 
                                                  Record< string, boolean>]> {
		//note the tasks currently active on Gelato
    const taskIds: Record< string, boolean> = 
                    (await this._gelatoClient.getGelatoAdminTaskIds()).reduce( 
                                                            (map, taskId) =>  {
                                              map[ taskId] = false;
                                              return map;
                                            }, {} as Record< string, boolean>),
 					vaultsWithMissingTask: Record< string, string> = {}; 
    let dirty: boolean = false;

		//for each OCH-eligible vault on this chain...
/*let vaultName = Object.entries( vaults)[ 0][ 0];*//*(Object.keys( vaults).forEach( async (vaultName: string) => {*/
    await Promise.all( Object.keys( vaults).map( async (vaultName: string) => {
			//if the vault has no counterpart active Gelato task... 
      const vaultAddress: string = vaults[ vaultName];
      const taskId: string = await this._gelatoClient.computeTaskId( 
                                                                  vaultAddress);
      if (undefined == taskIds[ taskId]) {
				//take note of it, and note that one such has been found
        _logger.info( `Missing Gelato task for ${vaultName}`);
				_logger.debug( `  --> computed taskId ${taskId}`);
        vaultsWithMissingTask[ vaultName] = vaultAddress;
        dirty = true;
			//else note that the vault is indeed being covered by Gelato
      }else
        taskIds[ taskId] = true;
     })); //await Promise.all( Object.keys( vaults).map(

    if (dirty)
      _logger.info( `\nMissing task for ${Object.keys( 
                                   vaultsWithMissingTask).length } vaults.\n`);
    return [dirty ? vaultsWithMissingTask : null, taskIds];
  } //private async _vaultsWithMissingTask(


  private _filterForOchVaults( vaults: Readonly< Record< string, 
                                                IStratToHarvest>>) : 
																VaultRecord {
    const vaultsOch: VaultRecord = {};
    for (const vault in vaults) {
      if (vaults[ vault].noOnChainHarvest)
        continue;
      vaultsOch[ vaults[ vault].earnedToken] = vaults[ 
                                                    vault].earnContractAddress;
    }

    return vaultsOch;
  } //private _filterForOchVaults( 
} //class TaskSyncer 
