import 'dotenv/config'

import { ethers, Wallet } from 'ethers';
import { TaskSyncer } from './taskSyncer';
import { IChain, IChainOch, IChains } from './interfaces';


const run = async (): Promise< void> => {
  const pk = process.env.GELATO_ADMIN_PK!;

  /*Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (chain: IChain) =>  {*/
  await Promise.all( Object.values( <Readonly< IChains>> require( 
                          '../data/chains.js')).map( async (chain: IChain | IChainOch) => {
    if (!chain.hasOnChainHarvesting)
      return;
    if (!((test: IChainOch | IChain) : test is IChainOch => 'string' === 
                    typeof test.ochHarvester && !!test.ochHarvester.length && 'string' === 
                    typeof test.ochOperations && !!test.ochOperations.length)( chain))  {
      console.log( `On-chain harvesting misconfigured for ${chain.id.toUpperCase()}`);
      return;
    }

    const provider = new ethers.providers.JsonRpcProvider( chain.rpc);
    const gelatoAdminWallet: Wallet = new Wallet( pk, provider);

    console.log( '>>>>> on-chain harvester sync: ', chain.id);
    new TaskSyncer( gelatoAdminWallet, chain).syncVaultHarvesterTasks();
  })); //await Promise.all( Object.values( <Readonly< IChains>>
}; //const run = async (): Promise< void>


run();
