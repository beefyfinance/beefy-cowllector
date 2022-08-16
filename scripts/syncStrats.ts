/******
Script synchronizes which vaults should be operated on for harvesting based upon the 
list of voults currently in play at Beefy. In doing so, the script differentiates between 
which of the vaults should be harvested by Beefy's homegrown bot ("Cowllector") and 
on-chain servicers Beefy also employs to do this task (e.g. Gelato). The script also does 
any preparatory work required prior to any on-chain operations, like updating expected 
gas-limits to harvest vaults managed by Cowllector.

At the end of a run, a JSON log of the significant changes made by the sync is written to 
`data\stratsSync.json`.
********/

import FETCH, {type Response} from 'node-fetch'; //pull in of type Response needed due
                                                      //  to clash with WebWorker's version
import {ethers as ETHERS} from 'ethers';
import FS from 'fs';
import PATH from 'path';
import type {IVault, IStratToHrvst, IChain, IChains} from '../interfaces';
import {estimateGas} from '../utils/harvestHelpers';

const NOT_FOUND = -1;

const SettledPromiseRejected = (result: PromiseSettledResult< unknown>) : 
                              result is PromiseRejectedResult => 'rejected' === result.status;
const SettledPromiseFilld = <type> (result: PromiseSettledResult< type>) : 
                      result is PromiseFulfilledResult< type> => 'fulfilled' === result.status;

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
  readonly notOnChainHarvest: IStratToHrvst[] = [];


  constructor( private readonly chain: IChain, 
                private readonly vaults: readonly IVault[], 
                private readonly encountered: Set< string>, 
                private readonly hits: Hits) {
    //if this is a chain on which we use an on-chain harvesting (OCH) service, load up for 
    //  downstream use the list of vaults on the chain for which no on-chain harvesting 
    //  should be done
    if (this.chain.hasOnChainHarvesting)
      this.denyOnChainHarvest = <ReadonlySet< string>> require( `../gelato/${this.chain.id
                                                        }VaultDenyList.ts`).vaultDenyList;
  } //constructor(


  SyncVaults( stratsToHarvest: IStratToHrvst[]) : boolean  {
    //for each current vault...
    let dirty = false;
    this.vaults.forEach( (vault: IVault) => {
      //if the vault does not reside on the target chain, loop for the next vault
      if (this.chain.id !== vault.chain)
        return; 

      //if this vault was unknown at the time of our last run...
      const index = stratsToHarvest.findIndex( (O: IStratToHrvst) => vault.strategy === 
                                                        O?.strategy && vault.id === O.id) 
      let strat = NOT_FOUND != index ? stratsToHarvest[ index] : null;
      if (!strat)  {
        //if the vault is inactive (paused or ended), loop for the next vault
        if (['eol', 'paused'].includes( vault.status))
           return;

        //add it to our list of active vaults, and note the addition in our log of changes 
        //  made
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
      //else if the vault has gone inactive...
      }else if (['eol', 'paused'].includes( vault.status))  {
        //remove it from our list of active vaults, note this in our log of changes made, 
        //  and loop for the next vault
        delete stratsToHarvest[ index];
        this.removed++;
        dirty = true;
        this.hits.add( vault.id, 'removed, inactive');
        return;
      //else add this vault to a list of still-present vaults encountered
      }else
        this.encountered.add( vault.id);

      //if this is a chain on which we use an on-chain harvesting (OCH) service, determine 
      //  whether the vault is excluded from being handled that way
      const onChainHarvest = this.chain.hasOnChainHarvesting && !this.denyOnChainHarvest?.has( 
                                                                        vault.earnedToken);

      //if the operative OCH status is not reflected on our current vault descriptor...
      if (onChainHarvest ? strat?.noOnChainHrvst : this.chain.hasOnChainHarvesting && 
                                                                !strat?.noOnChainHrvst)  {
        //if the vault is not new...
        if (NOT_FOUND != index)  {
          //reflect the OCH status onto the current strat descriptor and note the switch in 
          //  our log of changes made
          strat.noOnChainHrvst = !onChainHarvest;
          dirty = true;
          this.hits.add( vault.id, 'on-chain-harvest switch');
        //else relect the OCH status onto the new strat descriptor
        }else
          strat.noOnChainHrvst = !onChainHarvest;
      } //if (onChainHarvest ? strat?.noOnChainHrvst :
 
      //if the vault is not handled by an OCH, add the vault to a list of non-OCH vaults 
      //  active on this chain (as our consumer  may be interested downstream)
      if (!onChainHarvest)
        this.notOnChainHarvest.push( strat);

      //if the vault is new, loop for the next vault
      if (NOT_FOUND == index)
        return;
   
      //if the strategy contract changed, note the change in our log of changes made and 
      //  reflect the strategy contract onto our vault descriptor
      if (strat.strategy !== vault.strategy) { 
        strat.strategy = vault.strategy;
        dirty = true;
        this.hits.add( vault.id, 'strategy update');
        console.log( `    Strategy upgrade applied to vault: ${strat.id}`);
      }

      //if the last-harvest timestamp has updated, reflect that onto our vault descriptor
      if (strat.lastHarvest < vault.lastHarvest) {
        strat.lastHarvest = vault.lastHarvest;
        dirty = true;
      }
    }); //vaults.forEach( (vault: IVault) =

    return dirty;
  } //SyncVaults(


  stratsChanged() : Readonly< {added: number, removed: number}> {
    return {added: this.added, removed: this.removed};
  }


  async AddGasLimits( strats: IStratToHrvst[]) : Promise< boolean>  {
    const provider = new ETHERS.providers.JsonRpcProvider( this.chain.rpc), 
          results = <readonly PromiseSettledResult< unknown>[]> await Promise.allSettled( 
                                    strats.map( (O: IStratToHrvst) => 
                                    estimateGas( O, this.chain.chainId, provider)));

    return !!results.find( SettledPromiseFilld);
  } //async AddGasLimits( strats:
} //class ChainStratManager


async function main() : Promise< void> {
  let vaults: ReadonlyArray< IVault> = [], 
      stratsToHarvest: IStratToHrvst[] = [];

  //load up current vaults from Beefy's online source
  const urlVaults = `https://api.beefy.finance/vaults`;
  try {
    const response = await <Promise< Response>> FETCH( urlVaults);
    if (!( response.ok && response.body)) {
      console.log( 'Fetching vaults failed');
      return;
    }
    vaults = await <Promise< ReadonlyArray< IVault>>> response.json();
  } catch (error: unknown)  {
    console.log( error);
    return;
  }

  //load the list of active vaults at the time of our last run (and now possibly 
  //  out-of-date) which should be present (TODO, convert to a map-like object for 
  //  efficient downstream lookups and removal handling)
  try {
    stratsToHarvest = <IStratToHrvst[]> require( '../data/stratsToHrvst.json');
  } catch (error: unknown)  {
    if (!( (( testError: unknown): testError is NodeJS.ErrnoException => 
                                  !!(< NodeJS.ErrnoException> testError).code)( error) && 
                                  'MODULE_NOT_FOUND' === error.code)) {
      console.log( error);
      return;
    }
  } //try

  const hits = new Hits(), 
        encountered: Set< string> = new Set();
  let dirty = false;

  //running in parallel for efficiency, for each chain we support...
/*Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (chain: IChain) =>  {*/  await Promise.all( Object.values( <Readonly< IChains>> require( 
                                      '../data/chains.js')).map( async (chain: IChain) => {
    //synchronize our configuration of strategies on this chain to match up with the 
    //  current actual state of vaults and strategies at Beefy
    const stratManager = new ChainStratManager( chain, vaults, encountered, hits);
    if (stratManager.SyncVaults( stratsToHarvest))
      dirty = true;
    const {added, removed} = stratManager.stratsChanged();
    if (added || removed)
      console.log( `Strats on ${chain.id.toUpperCase()}: ${added } added, ${removed
                                                                              } removed`);
    else
      console.log( `No strats added or removed from ${chain.id.toUpperCase()}`);

    //if any vault on the chain is to be handled by our homegrown bot, estimate the gas 
    //  required to execute a harvest on each vault to be handled by our homegrown bot, 
    //  reflecting the result onto each's vault descriptor
/*if(false)*/   if (stratManager.notOnChainHarvest.length)  {
      console.log( `  Updating gas-limit values on Cowllector-managed ${
                                                      chain.id.toUpperCase()} strats...`);
/**/  if (await stratManager.AddGasLimits( stratManager.notOnChainHarvest))
/**/    dirty = true;
      console.log( `    Finished gas-limit updates on ${chain.id.toUpperCase()}`);
    }
  })); //await Promise.all( Object.values( <Readonly< IChains>>
//debugger;
  //for each active vault at the time of the last run which remains in that list...
  stratsToHarvest.forEach( (strat, index) => {
    //if the vault was noted upstream as new or still active, loop for the next vault
    if (encountered.has( strat.id))
      return;

    //remove the vault from our running active-vault list, and note the removal in our log 
    //  of changes made
    delete stratsToHarvest[ index];
    hits.add( strat.id, 'removed, decomissioned');
  }); //stratsToHarvest.forEach( strat

  //if any significant changes occurred during this sync, persist our log of them to help 
  //  our overseers keep an eye on things
  const index = Object.keys( hits.hits).length;
  if (index)  {
    FS.writeFileSync(PATH.join( __dirname, '../data/stratsSync.json'),
                                  JSON.stringify( Object.values( hits.hits), null, 2));
    console.log( `\nLog of ${index} significant changes written to data/stratsSync.json`);
  }
  
  //if any changes occurred over this sync, persist our running list of active vaults, 
  //  including their properties of downstream interest
  if (dirty)
    FS.writeFileSync( PATH.join( __dirname, '../data/stratsToHrvst.json'),
                      JSON.stringify( stratsToHarvest.filter( strat => strat), null, 2));
} //function async main(


main();
