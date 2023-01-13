import FETCH from 'node-fetch';
import type {Task} from '@gelatonetwork/ops-sdk';
import {NonceManage} from '../utility/NonceManage';
import {logger} from '../utility/Logger';
import {getKey, redisDisconnect} from '../utility/redisHelper';
import {sendMessage as postToDiscord} from '../utils/discordPost';
import type {IChainHarvester, IStratToHarvest} from './interfaces';
import type {GelatoClient} from './gelatoClient';

export type VaultRecord = Record< IStratToHarvest[ 'earnedToken'], 
																	IStratToHarvest[ 'earnContractAddress']>;

type HitType = 'created OCH task' | 'deleted OCH task' | 'renamed OCH task';
interface  Hit  {
  readonly id: string;
  type: HitType | {type: HitType, detail: string} | (HitType |  
                                            {type: HitType, detail: string})[];
}
class Hits  {
  readonly hits: Record< string, Hit> = {};
  add( id: string, 
        type: Readonly< HitType>, 
        detail?: any) : void {
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


type _Task = {
	located: boolean | string;
	name: string;
}
export class TaskSyncer {
	//at the very start, pull in all we've gathered about the strategies targeted 
	//	for harvest
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
												_logger.warn( `${strat.chain.toUpperCase()
																									} -  Duplicate vault-token: ${
																									strat.earnedToken}`);
                    }else
                      map[ strat.earnedToken] = strat;
                    return map;
                  }, {} as Record< string, IStratToHarvest>), 
            vaultsActive: Readonly< VaultRecord> = 
																					this._filterToOnChainHarvestedVaults( 
																					vaultsOnChain);

		//Get the list of eligible vaults which have no Gelato-task counterpart, 
		//	noting alongside the list of vaults with active Gelato tasks.
    const [vaultsMissingTask, existingTasks]: [Readonly< VaultRecord | null>, 
																					 Readonly< Record< string, _Task>>] = 
																		await this._vaultsTaskStatus( vaultsActive);

    let promiseCreated: Promise< Record< string, string> | null> | undefined, 
        promiseDeleted: typeof promiseCreated, 
				promiseRenamed: typeof promiseDeleted;

    //create a Gelato task for any eligible vault not yet covered
    if (vaultsMissingTask)
      promiseCreated = this._gelatoClient.createTasks( vaultsMissingTask);

    //if any Gelato task has either become superfluous (probably because the 
		//	corresponding vault was decomissioned) or needs renaming, delete it 
		//	("cancel" it, in Gelato parlance) or rename it, respectively
    if (existingTasks)  {
      const [tasksToDelete, tasksToRename]: [ReadonlySet< Task>, 
										ReadonlySet< Task>] = Object.entries( existingTasks).reduce(
										(sets, task: Readonly< [string, _Task]>) => {
											if (!task[ 1].located)
												sets[ 0].add( {taskId: task[ 0], name: task[ 1].name});
											else if ('string' === typeof task[ 1].located)
												sets[ 1].add( {taskId: task[ 0], name: task[ 
																																	1].located});
											return sets;
										}, [new Set< Task>(), new Set< Task>()]);
      if (tasksToDelete.size)
        promiseDeleted = this._gelatoClient.deleteTasks( tasksToDelete);
			if (tasksToRename.size)
				promiseRenamed = this._gelatoClient.renameTasks( tasksToRename);
    } //if (existingTasks)

    const report = {created: 0, deleted: 0, renamed: 0};
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
		const tasksRenamed = await promiseRenamed; 
    if (tasksRenamed) {
      const names = Object.keys( tasksRenamed);
			names.forEach( name => {
							const prior = existingTasks[ tasksRenamed[ name]].name;
							return this._hits.add( name, 'renamed OCH task', 
											{taskId: tasksRenamed[ name], 
												from: !(prior.startsWith( '0x') && prior.length == 
															tasksRenamed[ name].length) ? prior : 'default'});
						});
      report.renamed = names.length;
    }

		_logger.info( `${this._chain.id.toUpperCase()} - Tasks created: ${
																report.created}  Tasks deleted: ${report.deleted
																}  Tasks renamed: ${report.renamed}`);
    try {
      await postToDiscord( {type: 'info',
            title: `On-chain-harvester sync on ${this._chain.id.toUpperCase()}`,
            message: `+ Tasks created: ${report.created}\n+ Tasks deleted: ${
													report.deleted}\n+ Tasks renamed: ${report.renamed}` + 
													(tasksCreated || tasksDeleted || tasksRenamed ? 
													`\n\`\`\`json\n${JSON.stringify( Object.values( 
													this._hits.hits), null, 2)}\n\`\`\`` : '')});
    } catch (error: unknown) {
//TODO; figure out TS to get rid of the 'any' cast, probably type-guard
      _logger.error( `Error broadcasting report : ${(<any> error).message
																	}\n* Intended Content **\n${JSON.stringify( 
																	Object.values( this._hits.hits), null, 2)}`);
    }
  } //public async syncVaultHarvesterTasks(

  
  private async _vaultsTaskStatus( vaults: Readonly< VaultRecord>) : 
																		Promise< [VaultRecord | null, 
																							Record< string, _Task>]> {
		//note the tasks currently active on Gelato on this chain
    const tasks: Record< string, _Task> = Object.entries( await 
											 this._gelatoClient.taskInfo()).reduce( (map, task) => {
																							map[ task[ 0]] = {located: false,
																																name: task[ 1]};
																							return map;
																						}, {} as Record< string, _Task>),
 					vaultsMissingTask: Record< string, string> = {}; 
    let dirty: boolean = false;

		//for each OCH-eligible vault on this chain...
/*let vaultName = Object.entries( vaults)[ 0][ 0];*//*(Object.keys( vaults).forEach( async (vaultName: string) => {*/
    await Promise.all( Object.keys( vaults).map( async vaultName => {
			//if the vault has no counterpart active Gelato task... 
      const vaultAddress: string = vaults[ vaultName];
      const taskId: string = await this._gelatoClient.computeTaskId( 
                                                                  vaultAddress);
      if (undefined == tasks[ taskId]) {
				//take note of it, and note that one such has been found
        _logger.info( `${this._chain.id.toUpperCase()
																		} - Missing Gelato task for ${vaultName}`);
				_logger.debug( `  --> computed taskId ${taskId}`);
        vaultsMissingTask[ vaultName] = vaultAddress;
        dirty = true;
			//else note that the vault is indeed being covered by Gelato, marking its 
			//	corresponding task for possible renaming if it's off
      }else
        tasks[ taskId].located = vaultName !== tasks[ taskId].name ? vaultName :
																																					true;
     })); //await Promise.all( Object.keys( vaults).map(

    if (dirty)
      _logger.info( `\n${this._chain.id.toUpperCase()} - Missing task for ${
														Object.keys( vaultsMissingTask).length} vaults.\n`);
    return [dirty ? vaultsMissingTask : null, tasks];
  } //private async _vaultsTaskStatus(


  private _filterToOnChainHarvestedVaults( vaults: Readonly< Record< string, 
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
  } //private _filterToOnChainHarvestedVaults( 
} //class TaskSyncer 
