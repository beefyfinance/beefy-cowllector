/******
Script synchronizes which vaults should be operated on for harvesting based 
upon the list of voults currently in play at Beefy. In doing so, the script 
differentiates between which of the vaults should be harvested by Beefy's 
homegrown bot ("Cowllector") and on-chain servicers Beefy also employs to do 
this task (e.g. Gelato). The script also does any preparatory work required 
prior to any on-chain operations, like updating expected gas-limits to harvest 
vaults managed by Cowllector.

At the end of a run, a JSON log of the significant changes made by the sync is 
written to `data\stratsSync.json`.

Run command: yarn ts-node --transpile-only scripts/syncStrats.ts
********/

import FETCH, { type Response } from 'node-fetch'; //pull in of type Response 
                               //  needed due to clash with WebWorker's version
import { ethers as ETHERS } from 'ethers';
import FS from 'fs';
import PATH from 'path';
import { settledPromiseFilled, nodeJsError } from '../utility/baseNode';
import type { IVault, IStratToHarvest, IChain, IChains } from './interfaces';
import { setKey, getKey } from '../utility/redisHelper';
import { logger } from '../utility/Logger'
import { estimateGas } from '../utils/harvestHelpers';
import BROADCAST from '../utils/broadcast';

const NOT_FOUND = -1;
const REDIS_KEY = 'STRATS_TO_HARVEST';


type HitType = 'added' | 'removed, inactive' | 'removed, decomissioned' | 
                'on-chain-harvest switch' | 'strategy update';
interface  Hit  {
  readonly id: string;
  type: HitType | HitType[];
}
class Hits  {
  readonly hits: Record< string, Hit> = {};
  add( id: string, 
        type: Readonly< HitType>) : void {
    if (!id)
      return;
    const hit = this.hits[ id];
    if (!hit)
      this.hits[ id] = {id: id, type: type};
    else if (!Array.isArray( hit.type))
      hit.type = [hit.type, type];
    else
      hit.type.push( type);
  } //add(
} //class Hits


class ChainStratManager  {
  private added: number = 0;
  private removed: number = 0;

  readonly denyOnChainHarvest: ReadonlySet< string> | null = null; 
  readonly notOnChainHarvest: IStratToHarvest[] = [];

  constructor( private readonly chain: IChain, 
                private readonly vaults: readonly IVault[], 
                private readonly encountered: Set< string>, 
                private readonly hits: Hits) {
    if (this.chain.hasOnChainHarvesting)
      this.denyOnChainHarvest = <ReadonlySet< string>> require( 
                                             `../gelato/${this.chain.id
                                             }VaultDenyList.ts`).vaultDenyList;
  }


  syncVaults( stratsToHarvest: IStratToHarvest[]) : boolean  {
    let dirty = false;
    this.vaults.forEach( (vault: IVault) => {
      if (this.chain.id !== vault.chain)
        return; 

      //if this vault was unknown at the time of our last run...
      const index = stratsToHarvest.findIndex( (strat: IStratToHarvest) => 
                                                      vault.id === strat?.id); 
      let strat = NOT_FOUND != index ? stratsToHarvest[ index] : null;
      if (!strat)  {
        if (['eol', 'paused'].includes( vault.status))
           return;

        stratsToHarvest.push( strat = { id: vault.id,
                                chain: vault.chain, 
                                earnContractAddress: vault.earnContractAddress,
                                earnedToken: vault.earnedToken,
                                strategy: vault.strategy,
                                lastHarvest: vault.lastHarvest});
        this.added++;
        dirty = true;
        this.encountered.add( vault.id);
        this.hits.add( vault.id, 'added');
      }else if (['eol', 'paused'].includes( vault.status))  {
        delete stratsToHarvest[ index];
        this.removed++;
        dirty = true;
        this.hits.add( vault.id, 'removed, inactive');
        return;
      }else {
        this.encountered.add( vault.id);

        if (vault.strategy !== strat.strategy)  {
          strat.strategy = vault.strategy;
          dirty = true;
          this.hits.add( vault.id, 'strategy update');
          logger.info( `    Strategy upgrade applied to vault: ${strat.id}`);
        }

        if (strat.lastHarvest < vault.lastHarvest) {
          strat.lastHarvest = vault.lastHarvest;
          dirty = true;
        }
      } //if (!strat)

      const onChainHarvest = this.chain.hasOnChainHarvesting && 
                              !this.denyOnChainHarvest?.has( vault.earnedToken);

      if (onChainHarvest ? strat?.noOnChainHarvest : 
                                            this.chain.hasOnChainHarvesting && 
                                            !strat?.noOnChainHarvest)  {
        strat.noOnChainHarvest = !onChainHarvest;
        if (NOT_FOUND != index)  {
          dirty = true;
          this.hits.add( vault.id, 'on-chain-harvest switch');
        }
      } //if (onChainHarvest ? strat?.noOnChainHarvest :
 
      if (!onChainHarvest)
        this.notOnChainHarvest.push( strat);
    }); //vaults.forEach( (vault: IVault) =

    return dirty;
  } //syncVaults(


  stratsChanged() : Readonly< {added: number, removed: number}> {
    return {added: this.added, removed: this.removed};
  }


  async addGasLimits( strats: IStratToHarvest[]) : Promise< boolean>  {
    const provider = new ETHERS.providers.JsonRpcProvider( this.chain.rpc), 
          results: Readonly< PromiseSettledResult< unknown>[]> = 
                    await Promise.allSettled( strats.map( (strat) : 
                                                Readonly< Promise< unknown>> => 
                            estimateGas( strat, this.chain.chainId, provider)));

    return !!results.find( settledPromiseFilled);
  } //async addGasLimits( strats:
} //class ChainStratManager


async function main() : Promise< void> {
  let vaults: ReadonlyArray< IVault> = [], 
      stratsToHarvest: IStratToHarvest[] = [];

	//load up current vaults from Beefy's online source
  const urlVaults = `https://api.beefy.finance/vaults`;
  try {
    const response = await <Promise< Response>> FETCH( urlVaults);
    if (!( response.ok && response.body)) {
      logger.error( 'Fetching vaults failed');
      return;
    }
    vaults = await <Promise< typeof vaults>> response.json();
  } catch (error: unknown)  {
    logger.error( <any> error);
    return;
  }

	//load up current strategy-harvesting configuration data (possibly changed 
	//	since our last run)

	//load up the list of strategies to be harvested as of our last run (and now 
	//	possibly out of date)

	//reflect the current strategy-harvesting configuration data into the list of 
	//	strategies to be harvested, noting if any change resulted

  //(TODO: convert to a map-like object for efficient downstream lookups and 
  //  removal handling)
  try {
    stratsToHarvest = <IStratToHarvest[]> require( 
                                                '../data/stratsToHarvest.json');
  } catch (error: unknown)  {
		logger.error( `${(nodeJsError( error) && 'MODULE_NOT_FOUND' === error.code ? 
																						 'stratsToHarvest.json not found' : 
																						 'unexpected error')}: ${error}`);
		return;
  }

  const hits = new Hits(), 
        encountered: Set< string> = new Set();
	let dirty = false;

  //running in parallel for efficiency, for each chain we support...
//Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (chain: IChain) =>  {
	await Promise.all( Object.values( <Readonly< IChains>> require( 
													'../data/chains.js')).map( async (chain: IChain) => {
    //update our configuration of strategies on this chain to match up 
		//	with the latest actual state of vaults and strategies deployed at Beefy
    const stratManager = new ChainStratManager( chain, vaults, encountered, 
																																				 hits);
    if (stratManager.syncVaults( stratsToHarvest))
      dirty = true;
    const {added, removed} = stratManager.stratsChanged();
    if (added || removed)
      logger.info( `Strats on ${chain.id.toUpperCase()}: ${added } added, 
										${removed} removed`);
    else
      logger.info( `No strats added or removed from ${chain.id.toUpperCase()}`);
//if (false)
		if (stratManager.notOnChainHarvest.length)  {
      logger.info( `  Updating gas-limit values on Cowllector-managed ${
																						chain.id.toUpperCase()} strats...`);
		  if (await stratManager.addGasLimits( stratManager.notOnChainHarvest))
		    dirty = true;
      logger.info( `    Finished gas-limit updates on ${chain.id.toUpperCase()
																																						}`);
    }
  })); //await Promise.all( Object.values( <Readonly< IChains>>
//debugger;
  //for each active vault at the time of the last run which remains in that 
	//	list...
  stratsToHarvest.forEach( (strat, index) => {
		//if the vault was noted upstream as new or still active, loop for the next 
		//	vault
    if (encountered.has( strat.id))
      return;

    //remove the vault from our running active-vault list, and note the removal 
		//	in our log of changes made
    delete stratsToHarvest[ index];
    hits.add( strat.id, 'removed, decomissioned');
  }); //stratsToHarvest.forEach( strat

  //if any significant changes occurred during this sync, persist our log of 
	//	them to help our overseers keep an eye on things
  const index = Object.keys( hits.hits).length;
  if (index)  {
    FS.writeFileSync(PATH.join( __dirname, '../data/stratsSync.json'),
                          JSON.stringify( Object.values( hits.hits), null, 2));
    logger.info( `\nLog of ${index
                        } significant changes written to data/stratsSync.json`);
  }else
    logger.info( '\nNo significant changes discovered.');
  
  //if any changes occurred over this sync, persist our running list of active 
	//	vaults, including their properties of downstream interest
  if (dirty)
    FS.writeFileSync( PATH.join( __dirname, '../data/stratsToHarvest.json'),
											JSON.stringify( stratsToHarvest.filter( 
											(strat: IStratToHarvest) : boolean => !!strat), null, 2));
} //function async main(


main();
