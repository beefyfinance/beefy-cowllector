import 'dotenv/config'
import { ethers, Wallet } from 'ethers';
import { NonceManage } from '../utility/NonceManage';
import { TaskSyncer } from './taskSyncer';
import { IChain, IChainOch, IChains } from './interfaces';
import { logger, Logger } from '../utility/Logger';


//logger.setLevel( 'NonceManage', Logger.levels.DEBUG);
//logger.setLevel( 'GelatoClient', Logger.levels.DEBUG);

const run = async () : Promise< void> => {
  const pk = process.env.GELATO_ADMIN_PK!;

  //Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (chain: IChain | IChainOch) =>  {
  await Promise.all( Object.values( <Readonly< IChains>> require( 
                                          '../data/chains.js')).map( 
                                          async (chain: IChain | IChainOch) => {
    if (!chain.hasOnChainHarvesting)
      return;
    if (!( (test: IChainOch | IChain) : test is IChainOch => 'string' === 
                      typeof test.ochHarvester && !!test.ochHarvester.length && 
                      'string' === typeof test.ochOperations && 
                      !!test.ochOperations.length)( chain))  {
      logger.error( `On-chain harvesting misconfigured for ${
                                                      chain.id.toUpperCase()}`);
      return;
    }

    const gelatoAdminWallet: NonceManage = new NonceManage( new Wallet( pk, 
                                          new ethers.providers.JsonRpcProvider( 
                                          chain.rpc)));

    logger.info( `>>>>> on-chain harvester sync: ${chain.id.toUpperCase()}`);
    new TaskSyncer( gelatoAdminWallet, chain).syncVaultHarvesterTasks();
  })); //await Promise.all( Object.values( <Readonly< IChains>>
}; //const run = async (): Promise< void>


run();
