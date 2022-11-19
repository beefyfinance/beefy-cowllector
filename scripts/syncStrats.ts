/******
Script synchronizes which vaults should be operated on for harvesting, based 
upon the list of voults currently in play at Beefy. In doing so, the script 
differentiates between which of the vaults should be harvested by Beefy's 
homegrown bot ("Cowllector") or by on-chain servicers Beefy also employs to do 
the task (e.g. Gelato). The script also does any preparatory work required 
prior to any bot operations, like updating expected gas-limits to harvest 
vaults managed by Cowllector.

At the end of a run, a JSON log of the significant changes made by the sync is 
written to `data\stratsSync.json`.

Run command: yarn ts-node --transpile-only scripts/syncStrats.ts
********/

import 'dotenv/config';
import FETCH, { type Response } from 'node-fetch'; //pull in of type Response
//  needed due to clash with WebWorker's version
import { ethers as ETHERS } from 'ethers';
import FS from 'fs';
import PATH from 'path';
import { settledPromiseFilled, nodeJsError, type OptionalMutable } from '../utility/baseNode';
import type {
  IVault,
  IStratExtendedProperties,
  IStratToHarvest,
  IChain,
  IChains,
} from './interfaces';
import { setKey, getKey, redisDisconnect } from '../utility/redisHelper';
import { logger } from '../utility/Logger';
import { estimateGas } from '../utils/harvestHelpers';
import BROADCAST from '../utils/broadcast';

const NOT_FOUND = -1;
const REDIS_KEY = 'STRATS_TO_HARVEST';

type HitType =
  | 'added'
  | 'removed, inactive'
  | 'removed, decomissioned'
  | 'on-chain-harvest switch'
  | 'strategy update'
  | 'extended-properties update';
interface Hit {
  readonly id: string;
  type: HitType | HitType[];
}
class Hits {
  readonly hits: Record<string, Hit> = {};
  add(id: string, type: Readonly<HitType>): void {
    if (!id) return;
    const hit = this.hits[id];
    if (!hit) this.hits[id] = { id: id, type: type };
    else if (!Array.isArray(hit.type)) hit.type = [hit.type, type];
    else hit.type.push(type);
  } //add(
} //class Hits

logger.initializeSentry({
  dsn: process.env.SENTRY_DSN_STRAT_SYNC,
  tracesSampleRate: 1.0 /*, debug: true*/,
});
//logger.setLevel( Logger.levels.DEBUG);

class ChainStratManager {
  private static _extendedStratProperties: Readonly<
    Record<string, Omit<IStratExtendedProperties, 'id'>>
  >;
  static {
    try {
      //load up current individual-strategy harvest-configuration data
      //	(possibly changed since our last run)
      this._extendedStratProperties = (<OptionalMutable<IStratExtendedProperties, 'id'>[]>(
        require('../data/stratsExtendedProperties.json')
      )).reduce((map, strat) => {
        const id = (<Required<Pick<typeof strat, 'id'>>>strat).id;
        delete strat.id;
        map[id] = strat;
        return map;
      }, {} as Record<string, Omit<IStratExtendedProperties, 'id'>>);
    } catch (error: unknown) {
      throw new Error(
        `${
          nodeJsError(error) && 'MODULE_NOT_FOUND' === error.code
            ? 'stratsExtendedProperties.json not found'
            : 'unexpected error'
        }: ${error}`
      );
    }
  } //static

  private _added: number = 0;
  private _removed: number = 0;

  readonly denyOnChainHarvest: ReadonlySet<string> | null = null;
  readonly notOnChainHarvest: IStratToHarvest[] = [];

  constructor(
    private readonly chain: IChain,
    private readonly vaults: readonly IVault[],
    private readonly encountered: Set<string>,
    private readonly hits: Hits
  ) {
    if (this.chain.hasOnChainHarvesting)
      this.denyOnChainHarvest = <ReadonlySet<string>>(
        require(`../gelato/${this.chain.id}VaultDenyList.ts`).vaultDenyList
      );
  }

  syncVaults(stratsToHarvest: Record<string, IStratToHarvest>): boolean {
    let dirty = false;
    this.vaults.forEach((vault: IVault) => {
      if (this.chain.id !== vault.chain) return;

      //if this vault was unknown at the time of our last run...
      let strat = stratsToHarvest[vault.id];
      const newStrat = !strat;
      if (newStrat) {
        if (['eol', 'paused'].includes(vault.status)) return;

        stratsToHarvest[vault.id] = strat = {
          id: vault.id,
          chain: vault.chain,
          earnContractAddress: vault.earnContractAddress,
          earnedToken: vault.earnedToken,
          strategy: vault.strategy,
          lastHarvest: vault.lastHarvest,
        }; //);
        this._added++;
        dirty = true;
        this.encountered.add(vault.id);
        this.hits.add(vault.id, 'added');
      } else if (['eol', 'paused'].includes(vault.status)) {
        delete stratsToHarvest[vault.id];
        this._removed++;
        dirty = true;
        this.hits.add(vault.id, 'removed, inactive');
        return;
      } else {
        this.encountered.add(vault.id);

        if (vault.strategy !== strat.strategy) {
          strat.strategy = vault.strategy;
          dirty = true;
          this.hits.add(vault.id, 'strategy update');
          logger.info(`    Strategy upgrade applied to vault: ${strat.id}`);
        }

        if (strat.lastHarvest < vault.lastHarvest) {
          strat.lastHarvest = vault.lastHarvest;
          dirty = true;
        }
      } //if (newStrat)

      const onChainHarvest =
        this.chain.hasOnChainHarvesting && !this.denyOnChainHarvest?.has(vault.earnedToken);

      if (
        onChainHarvest
          ? strat?.noOnChainHarvest
          : this.chain.hasOnChainHarvesting && !strat?.noOnChainHarvest
      ) {
        strat.noOnChainHarvest = !onChainHarvest;
        if (!newStrat) {
          dirty = true;
          logger.info(`  OCH flag toggled on ${vault.id}`);
          this.hits.add(vault.id, 'on-chain-harvest switch');
        }
      } //if (onChainHarvest ? strat?.noOnChainHarvest :

      if (!onChainHarvest) this.notOnChainHarvest.push(strat);

      //if the strategy has been tagged with extended properties not yet
      //	reflected on the main descriptor of the strategy, do it now and note
      //	that change has occurred
      const extendedProperties = ChainStratManager._extendedStratProperties[vault.id];
      if (
        extendedProperties &&
        (newStrat ||
          Object.entries(extendedProperties).some(([key, value]) => (<any>strat)[key] !== value))
      ) {
        Object.assign(strat, extendedProperties);
        dirty = true;
        if (!newStrat) {
          logger.info(`  Updated extended properties of strat ${vault.id}`);
          this.hits.add(vault.id, 'extended-properties update');
        }
      }
    }); //vaults.forEach( (vault: IVault) =

    return dirty;
  } //syncVaults(

  stratsChanged(): Readonly<{ added: number; removed: number }> {
    return { added: this._added, removed: this._removed };
  }

  async addGasLimits(strats: IStratToHarvest[]): Promise<boolean> {
    const provider = new ETHERS.providers.JsonRpcProvider(this.chain.rpc),
      results: Readonly<PromiseSettledResult<unknown>[]> = await Promise.allSettled(
        strats.map(
          (strat): Readonly<Promise<unknown>> => estimateGas(strat, this.chain.chainId, provider)
        )
      );

    return !!results.find(settledPromiseFilled);
  } //async addGasLimits( strats:
} //class ChainStratManager

async function main(): Promise<void> {
  const interval = process.env.INTERVAL_SYNC_STRATS
    ? parseInt(process.env.INTERVAL_SYNC_STRATS)
    : 12;
  if ((new Date().getUTCHours() - 1) % interval) {
    logger.info(`Not yet time to synchronize stategy info. [interval = ${interval} hours]`);
    await redisDisconnect();
    return;
  }
  logger.info('Synchronizing strategy info to current state.');

  let vaults: ReadonlyArray<IVault> = [],
    stratsExtendedProperties: Record<string, IStratExtendedProperties>,
    stratsToHarvest: Record<string, IStratToHarvest>;

  //load up current vaults from Beefy's online source
  const urlVaults = `https://api.beefy.finance/vaults`;
  try {
    const response = await (<Promise<Response>>FETCH(urlVaults));
    if (!(response.ok && response.body)) {
      logger.error('Fetching vaults failed');
      await redisDisconnect();
      return;
    }
    vaults = await (<Promise<typeof vaults>>response.json());
  } catch (error: unknown) {
    logger.error(<any>error);
    await redisDisconnect();
    return;
  }

  //load up the list of strategies to be harvested as of our last run (and now
  //	possibly out of date), indexed by vault-ID
  stratsToHarvest = (await (<Record<string, IStratToHarvest>>(<unknown>getKey(REDIS_KEY)))) || {};

  const hits = new Hits(),
    encountered: Set<string> = new Set();
  let dirty = false;

  //running in parallel for efficiency, for each chain we support...
  //Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (chain: IChain) =>  {
  await Promise.all(
    Object.values(<Readonly<IChains>>require('../data/chains.js')).map(async (chain: IChain) => {
      //update our configuration of strategies on this chain to match up with the
      //	latest actual state of vaults and strategies deployed at Beefy
      const stratManager = new ChainStratManager(chain, vaults, encountered, hits);
      if (stratManager.syncVaults(stratsToHarvest)) dirty = true;
      const { added, removed } = stratManager.stratsChanged();
      if (added || removed)
        logger.info(`Strats on ${chain.id.toUpperCase()}: ${added} added, ${removed} removed`);
      else logger.info(`No strats added or removed from ${chain.id.toUpperCase()}`);
      //if (false)
      if (stratManager.notOnChainHarvest.length) {
        logger.info(
          `  Updating gas-limit values on Cowllector-managed ${chain.id.toUpperCase()} strats...`
        );
        if (await stratManager.addGasLimits(stratManager.notOnChainHarvest)) dirty = true;
        logger.info(`    Finished gas-limit updates on ${chain.id.toUpperCase()}`);
      }
    })
  ); //await Promise.all( Object.values( <Readonly< IChains>>
  //debugger;
  //for each active vault at the time of the last run...
  for (const stratId in stratsToHarvest) {
    //if the vault was noted upstream as new or still active, loop for the next
    //	vault
    if (encountered.has(stratId)) continue;

    //remove the vault from our running active-vault list, and note the removal
    //	in our log of changes made
    delete stratsToHarvest[stratId];
    hits.add(stratId, 'removed, decomissioned');
  } //for (const stratId in stratsToHarvest)

  //if any changes occurred over this sync, persist our running list of active
  //	vaults, including their properties of downstream interest
  if (dirty) setKey(REDIS_KEY, stratsToHarvest);

  //if any significant changes occurred during this sync, persist our log of
  //	them to help our overseers keep an eye on things
  const count = Object.keys(hits.hits).length;
  if (count) {
    try {
      await BROADCAST.send({
        type: 'info',
        title: `Strat-harvest sync`,
        message: `${
          count < 50
            ? `\n\`\`\`json\n${JSON.stringify(Object.values(hits.hits), null, 2)}\n\`\`\``
            : '50+ changes: see link'
        }`,
      });
      logger.info(`\nLog of ${count} significant changes written to logging channel`);
    } catch (error: unknown) {
      logger.info(
        `\n${count} significant changes registered, but error\n  encountered with looging channel.`
      );
      logger.error('Discord broadcast failed: ' + (<any>error).message);
      logger.error(`* Intended Content **\n${JSON.stringify(Object.values(hits.hits), null, 2)}`);
    } //try
  } else logger.info('\nNo significant changes discovered.');

  await redisDisconnect();
} //function async main(
main();
