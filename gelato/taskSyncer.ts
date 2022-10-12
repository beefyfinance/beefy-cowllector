import FETCH, { type Response } from 'node-fetch'; //pull in of type Response
//  needed due to clash with WebWorker's version
import { NonceManage } from '../utility/NonceManage';
import { GelatoClient } from './gelatoClient';
import type { IChainHarvester, IStratToHarvest } from './interfaces';
import { logger } from '../utility/Logger';
import BROADCAST from '../utils/broadcast';

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
  private _hits = new Hits();

  constructor(
    readonly gelatoAdmin_: NonceManage,
    private readonly _chain: Readonly<IChainHarvester>
  ) {
    this._gelatoClient = new GelatoClient(gelatoAdmin_, _chain, false);
  }

  public async syncVaultHarvesterTasks(): Promise<void> {
    let stratsToHarvest: ReadonlyArray<IStratToHarvest>;

    try {
      stratsToHarvest = <ReadonlyArray<IStratToHarvest>>require('../data/stratsToHarvest.json');
    } catch (error: unknown) {
      _logger.error(<any>error);
      return;
    }
  }

    const vaultsOnChain: Readonly<Record<string, IStratToHarvest>> = stratsToHarvest.reduce(
        (map, strat: IStratToHarvest) => {
          if (strat.chain !== this._chain.id || map[strat.earnedToken]) {
            if (strat.chain === this._chain.id)
              _logger.warn(
                `Duplicate ${strat.chain.toUpperCase()} vault-token: ${strat.earnedToken}`
              );
          } else map[strat.earnedToken] = strat;
          return map;
        },
        {} as Record<string, IStratToHarvest>
      ),
      vaultsActive: Readonly<VaultRecord> = this._filterForOchVaults(vaultsOnChain);

    const [vaultsMissingTask, taskIds]: Readonly<[VaultRecord | null, Record<string, boolean>]> =
      await this._vaultsWithMissingTask(vaultsActive);

    let promiseCreated: Promise<Record<string, string>> | undefined,
      promiseDeleted: typeof promiseCreated;

    //create an OCH task for any missing vault
    if (vaultsMissingTask) promiseCreated = this._gelatoClient.createTasks(vaultsMissingTask);

    //if any OCH task has become superfluous, delete it ("cancel" it, in
    //  Gelato parlance)
    if (taskIds) {
      const tasksToDelete: ReadonlySet<string> = Object.entries(taskIds).reduce((set, taskId) => {
        if (!taskId[1]) set.add(taskId[0]);
        return set;
      }, new Set<string>());
      if (tasksToDelete.size) promiseDeleted = this._gelatoClient.deleteTasks(tasksToDelete);
    }

    const report = { created: 0, deleted: 0 };
    if (promiseCreated) {
      const tasksCreated = await promiseCreated,
        keys = Object.keys(tasksCreated);
      keys.forEach(key => this._hits.add(key, 'created OCH task', `taskId: ${tasksCreated[key]}`));
      report.created = keys.length;
    }
    if (promiseDeleted) {
      const tasksDeleted = await promiseDeleted,
        keys = Object.keys(tasksDeleted);
      //    keys.forEach( key => this._hits.add( key, `deleted OCH task: ${
      //                                                      tasksDeleted[ key]}`));
      report.deleted = keys.length;
    }

    try {
      await BROADCAST.send({
        type: 'info',
        title: `On-chain-harvester sync on ${this._chain.id.toUpperCase()}`,
        message:
          `+ OCH tasks created: ${report.created}\n+ OCH tasks deleted: ${report.deleted}` +
          (promiseCreated || promiseDeleted
            ? `\n\`\`\`json\n${JSON.stringify(Object.values(this._hits.hits), null, 2)}\n\`\`\``
            : ''),
      });
    } catch (error: unknown) {
      //TODO; figure out TS to get rid of the 'any' cast, probably type-guard
      _logger.error(`Error broadcasting report : ${(<any>error).message}`);
    }
  } //public async syncVaultHarvesterTasks(

  private async _vaultsWithMissingTask(
    vaults: Readonly<VaultRecord>
  ): Promise<[VaultRecord | null, Record<string, boolean>]> {
    const vaultsWithMissingTask: Record<string, string> = {},
      taskIds: Record<string, boolean> = (await this._gelatoClient.getGelatoAdminTaskIds()).reduce(
        (map, taskId) => {
          map[taskId] = false;
          return map;
        },
        {} as Record<string, boolean>
      );

    let dirty: boolean = false;

    /*let vaultName = Object.entries( vaults)[ 0][ 0];*/ /*(Object.keys( vaults).forEach( async (vaultName: string) => {*/
    await Promise.all(
      Object.keys(vaults).map(async (vaultName: string) => {
        const vaultAddress: string = vaults[vaultName];
        const taskId: string = await this._gelatoClient.computeTaskId(vaultAddress);
        if (undefined == taskIds[taskId]) {
          _logger.info(`Missing Gelato task for ${vaultName}`);
          vaultsWithMissingTask[vaultName] = vaultAddress;
          dirty = true;
        } else taskIds[taskId] = true;
      })
    ); //await Promise.all( Object.keys( vaults).map(

    if (dirty)
      _logger.info(`\nMissing task for ${Object.keys(vaultsWithMissingTask).length} vaults.\n`);
    return [dirty ? vaultsWithMissingTask : null, taskIds];
  } //private async _vaultsWithMissingTask(

  private _filterForOchVaults(vaults: Readonly<Record<string, IStratToHarvest>>): VaultRecord {
    const vaultsOch: VaultRecord = {};
    for (const vault in vaults) {
      if (vaults[vault].noOnChainHarvest) continue;
      vaultsOch[vaults[vault].earnedToken] = vaults[vault].earnContractAddress;
    }

    return vaultsOch;
  } //private _filterForOchVaults(
} //class TaskSyncer
