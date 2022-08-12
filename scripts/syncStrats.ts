/******
Script synchronizes which vaults should be operated on for harvesting based upon the 
list of voults currently in play at Beefy. In doing so, the script differentiates between 
which of the vaults should be harvested by Beefy's homegrown bot ("Cowllector") and 
on-chain servicers Beefy also employs to do this task (e.g. Gelato). The script also does 
any preparatory work required prior to any on-chain operations, like updating expected 
gas-limits to harvest vaults managed by Cowllector.

At the end of a run, a JSON log of the significant changes made by the sync is written to 
`data\stratsSync.json`.

** AllTrades' Proposed Hungarian Notation ** (i.e. prefixes to token names)
Capitalization denotes "constant," i.e. its reference is intended not to be changed within 
the scope of its use. *Intended* is the operative word here; whether the compiler or 
runtime enforces the intent is irrelevant.

m, at the start of a prefix = module scope; omitted if preceded by the "function" keyword
f = function
p = Promise, followed by the type of the value of a fulfilled Promise
o = object
I = interface if not set off from the token name by an underscore
i = integer
b = boolean
s = string
_ = private member if the first character (class, interface)
e = set, followed by the type of each element of the set
a = array, followed by the type of each element of the array
x = any or unknown (using TypeScript terminology)
v = void
********/

import mFPo_fetch, {type Response} from 'node-fetch'; //pull in of type Response needed due
                                                      //  to clash with WebWorker's version
import {ethers as mO_ETHERS} from 'ethers';
import mO_FS from 'fs';
import mO_PTH from 'path';
import type {IVault, IStratToHrvst, IChain, IChains} from '../interfaces';
import {estimateGas as mFPO_estimateGas} from '../utils/harvestHelpers';

const mI_NOT_FND = -1;

const mFb_SettledPromiseRjctd = (O: PromiseSettledResult< unknown>) : 
                                    O is PromiseRejectedResult => 'rejected' === O.status;
const mFb_SettledPromiseFilld = <T> (O: PromiseSettledResult< T>) : 
                              O is PromiseFulfilledResult< T> => 'fulfilled' === O.status;

type HitType = 'added' | 'removed, inactive' | 'removed, decomissioned' | 
                'on-chain-harvest switch' | 'strategy update';
interface  Hit  {
  readonly id: string;
  type: HitType | HitType[];
}
class Hits  {
  readonly O_hits: Record< string, Hit> = {};
  add( S_ID: string, 
        S_TYP: Readonly< HitType>) : void {
    if (!S_ID)
      return;
    const O = this.O_hits[ S_ID];
    if (!O)
      this.O_hits[ S_ID] = {id: S_ID, type: S_TYP};
    else if (!Array.isArray( O.type))
      O.type = [O.type, S_TYP];
    else
      O.type.push( S_TYP);
  } //add(
} //class Hits


class ChainStratsMgr  {
  private _i_added: number = 0;
  private _i_rmvd: number = 0;

  readonly ES_DENY_OCH: ReadonlySet< string> | null = null; 
  readonly Ao_notOch: IStratToHrvst[] = [];


  constructor( private readonly _O_CHN: IChain, 
                private readonly _AO_VLTS: readonly IVault[], 
                private readonly _Es_encountered: Set< string>, 
                private readonly _O_hits: Hits) {
    //if this is a chain on which we use an on-chain harvesting (OCH) service, load up for 
    //  downstream use the list of vaults on the chain for which no on-chain harvesting 
    //  should be done
    if (this._O_CHN.hasOnChainHarvesting)
      this.ES_DENY_OCH = <ReadonlySet< string>> require( `../gelato/${this._O_CHN.id
                                                        }VaultDenyList.ts`).vaultDenyList;
  } //constructor(


  b_SyncVaults( Ao_stratsToHrvst: IStratToHrvst[]) : boolean  {
    //for each current vault...
    let b_dirty = false;
    this._AO_VLTS.forEach( (O_VLT: IVault) => {
      //if the vault does not reside on the target chain, loop for the next vault
      if (this._O_CHN.id !== O_VLT.chain)
        return; 

      //if this vault was unknown at the time of our last run...
      const I_IDX = Ao_stratsToHrvst.findIndex( (O: IStratToHrvst) => O_VLT.strategy === 
                                                        O?.strategy && O_VLT.id === O.id) 
      let o_strt = mI_NOT_FND != I_IDX ? Ao_stratsToHrvst[ I_IDX] : null;
      if (!o_strt)  {
        //if the vault is inactive (paused or ended), loop for the next vault
        if (['eol', 'paused'].includes( O_VLT.status))
           return;

        //add it to our list of active vaults, and note the addition in our log of changes 
        //  made
        Ao_stratsToHrvst.push( o_strt = { id: O_VLT.id,
                                          chain: O_VLT.chain, 
                                          earnContractAddress: O_VLT.earnContractAddress,
                                          earnedToken: O_VLT.earnedToken,
                                          strategy: O_VLT.strategy,
                                          lastHarvest: O_VLT.lastHarvest});
        this._i_added++;
        b_dirty = true;
        this._Es_encountered.add( O_VLT.id);
        this._O_hits.add( O_VLT.id, 'added');
      //else if the vault has gone inactive...
      }else if (['eol', 'paused'].includes( O_VLT.status))  {
        //remove it from our list of active vaults, note this in our log of changes made, 
        //  and loop for the next vault
        delete Ao_stratsToHrvst[ I_IDX];
        this._i_rmvd++;
        b_dirty = true;
        this._O_hits.add( O_VLT.id, 'removed, inactive');
        return;
      //else add this vault to a list of still-present vaults encountered
      }else
        this._Es_encountered.add( O_VLT.id);

      //if this is a chain on which we use an on-chain harvesting (OCH) service, determine 
      //  whether the vault is excluded from being handled that way
      const B_OCH = this._O_CHN.hasOnChainHarvesting && !this.ES_DENY_OCH?.has( 
                                                                        O_VLT.earnedToken);

      //if the operative OCH status is not reflected on our current vault descriptor...
      if (B_OCH ? o_strt?.noOnChainHrvst : this._O_CHN.hasOnChainHarvesting && 
                                                                !o_strt?.noOnChainHrvst)  {
        //if the vault is not new...
        if (mI_NOT_FND != I_IDX)  {
          //reflect the OCH status onto the current strat descriptor and note the switch in 
          //  our log of changes made
          o_strt.noOnChainHrvst = !B_OCH;
          b_dirty = true;
          this._O_hits.add( O_VLT.id, 'on-chain-harvest switch');
        //else relect the OCH status onto the new strat descriptor
        }else
          o_strt.noOnChainHrvst = !B_OCH;
      } //if (B_OCH ? o_strt?.noOnChainHrvst :
 
      //if the vault is not handled by an OCH, add the vault to a list of non-OCH vaults 
      //  active on this chain (as our consumer  may be interested downstream)
      if (!B_OCH)
        this.Ao_notOch.push( o_strt);

      //if the vault is new, loop for the next vault
      if (mI_NOT_FND == I_IDX)
        return;
   
      //if the strategy contract changed, note the change in our log of changes made and 
      //  reflect the strategy contract onto our vault descriptor
      if (o_strt.strategy !== O_VLT.strategy) { 
        o_strt.strategy = O_VLT.strategy;
        b_dirty = true;
        this._O_hits.add( O_VLT.id, 'strategy update');
        console.log( `    Strategy upgrade applied to vault: ${o_strt.id}`);
      }

      //if the last-harvest timestamp has updated, reflect that onto our vault descriptor
      if (o_strt.lastHarvest < O_VLT.lastHarvest) {
        o_strt.lastHarvest = O_VLT.lastHarvest;
        b_dirty = true;
      }
    }); //AO_VLTS.forEach( (O_VLT: IVault) =

    return b_dirty;
  } //SyncVaults(


  o_stratsChanged() : Readonly< {added: number, removed: number}> {
    return {added: this._i_added, removed: this._i_rmvd};
  }


  async Pb_AddGasLimits( Ao_strats: IStratToHrvst[]) : Promise< boolean>  {
    const O_PROVIDR = new mO_ETHERS.providers.JsonRpcProvider( this._O_CHN.rpc), 
          APR = <readonly PromiseSettledResult< unknown>[]> await Promise.allSettled( 
                                    Ao_strats.map( (O: IStratToHrvst) => 
                                    mFPO_estimateGas( O, this._O_CHN.chainId, O_PROVIDR)));

    return !!APR.find( mFb_SettledPromiseFilld);
  } //async Pb_AddGasLimits( Ao_strats:
} //class ChainStratsMgr


async function mFPv_main() : Promise< void> {
  let AO_VLTS: ReadonlyArray< IVault> = [], 
      Ao_stratsToHrvst: IStratToHrvst[] = [];

  //load up current vaults from Beefy's online source
  const S_URL_VLTS = `https://api.beefy.finance/vaults`;
  try {
    const O_RESP = await <Promise< Response>> mFPo_fetch( S_URL_VLTS);
    if (!( O_RESP.ok && O_RESP.body)) {
      console.log( 'Fetching vaults failed');
      return;
    }
    AO_VLTS = await <Promise< ReadonlyArray< IVault>>> O_RESP.json();
  } catch (X: unknown)  {
    console.log( X);
    return;
  }

  //load the list of active vaults at the time of our last run (and now possibly 
  //  out-of-date) which should be present (TODO, convert to a map-like object for 
  //  efficient downstream lookups and removal handling)
  try {
    Ao_stratsToHrvst = <IStratToHrvst[]> require( '../data/stratsToHrvst.json');
  } catch (X: unknown)  {
    if (!( (( X_: unknown): X_ is NodeJS.ErrnoException => 
                                              !!(<NodeJS.ErrnoException> X_).code)( X) && 
                                              'MODULE_NOT_FOUND' === X.code)) {
      console.log( X);
      return;
    }
  } //try

  const O_hits = new Hits(), 
        Es_encountered: Set< string> = new Set();
  let b_dirty = false;

  //running in parallel for efficiency, for each chain we support...
/*Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (O_CHN: IChain) =>  {*/  await Promise.all( Object.values( <Readonly< IChains>> require( 
                                      '../data/chains.js')).map( async (O_CHN: IChain) => {
    //synchronize our configuration of strategies on this chain to match up with the 
    //  current actual state of vaults and strategies at Beefy
    const O_STRT_MGR = new ChainStratsMgr( O_CHN, AO_VLTS, Es_encountered, O_hits);
    if (O_STRT_MGR.b_SyncVaults( Ao_stratsToHrvst))
      b_dirty = true;
    const {added: I_ADDED, removed: I_RMVD} = O_STRT_MGR.o_stratsChanged();
    if (I_ADDED || I_RMVD)
      console.log( `Strats on ${O_CHN.id.toUpperCase()}: ${I_ADDED } added, ${I_RMVD
                                                                              } removed`);
    else
      console.log( `No strats added or removed from ${O_CHN.id.toUpperCase()}`);

    //if any vault on the chain is to be handled by our homegrown bot, estimate the gas 
    //  required to execute a harvest on each vault to be handled by our homegrown bot, 
    //  reflecting the result onto each's vault descriptor
/*if(false)*/   if (O_STRT_MGR.Ao_notOch.length)  {
      console.log( `  Updating gas-limit values on Cowllector-managed ${
                                                      O_CHN.id.toUpperCase()} strats...`);
/**/  if (await O_STRT_MGR.Pb_AddGasLimits( O_STRT_MGR.Ao_notOch))
/**/    b_dirty = true;
      console.log( `    Finished gas-limit updates on ${O_CHN.id.toUpperCase()}`);
    }
  })); //await Promise.all( Object.values( <Readonly< IChains>>
//debugger;
  //for each active vault at the time of the last run which remains in that list...
  Ao_stratsToHrvst.forEach( (O_STRT, I) => {
    //if the vault was noted upstream as new or still active, loop for the next vault
    if (Es_encountered.has( O_STRT.id))
      return;

    //remove the vault from our running active-vault list, and note the removal in our log 
    //  of changes made
    delete Ao_stratsToHrvst[ I];
    O_hits.add( O_STRT.id, 'removed, decomissioned');
  }); //Ao_stratsToHrvst.forEach( O_STRT

  //if any significant changes occurred during this sync, persist our log of them to help 
  //  our overseers keep an eye on things
  const I = Object.keys( O_hits.O_hits).length;
  if (I)  {
    mO_FS.writeFileSync( mO_PTH.join( __dirname, '../data/stratsSync.json'),
                                  JSON.stringify( Object.values( O_hits.O_hits), null, 2));
    console.log( `\nLog of ${I} significant changes written to data/stratsSync.json`);
  }
  
  //if any changes occurred over this sync, persist our running list of active vaults, 
  //  including their properties of downstream interest
  if (b_dirty)
    mO_FS.writeFileSync( mO_PTH.join( __dirname, '../data/stratsToHrvst.json'),
                              JSON.stringify( Ao_stratsToHrvst.filter( X => X), null, 2));
} //function async mFPv_main(


mFPv_main();
