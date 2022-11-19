import 'dotenv/config';
import { ethers, Wallet } from 'ethers';
import { NonceManage } from '../utility/NonceManage';
import { GelatoClient } from './gelatoClient';
import { TaskSyncer } from './taskSyncer';
import type { IChain, IChainHarvester, IChains } from './interfaces';
import { logger, Logger } from '../utility/Logger';

logger.initializeSentry({ dsn: process.env.SENTRY_DSN_GELATO_SYNC, tracesSampleRate: 1.0 });
//logger.setLevel( 'NonceManage', Logger.levels.DEBUG);
//logger.setLevel( 'GelatoClient', Logger.levels.DEBUG);
//logger.setLevel( 'TaskSync', Logger.levels.DEBUG);

function chainIsOnChainHarvestingType(test: IChainHarvester | IChain): test is IChainHarvester {
  return (
    'string' === typeof test.addressHarvester &&
    !!test.addressHarvester.length &&
    'string' === typeof test.addressHarvesterOperations &&
    !!test.addressHarvesterOperations.length
  );
}

const run = async (): Promise<void> => {
  const interval = process.env.INTERVAL_SYNC_GELATO
    ? parseInt(process.env.INTERVAL_SYNC_GELATO)
    : 12;
  if ((new Date().getUTCHours() - 2) % interval) {
    logger.info(`Not yet time to synchronize Gelato tasks. [interval = ${interval} hours]`);
    return;
  }
  logger.info('Synchronizing Gelato tasks');

  const pk = process.env.GELATO_ADMIN_PK!;

  //Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (chain: IChain | IChainHarvester) =>  {
  await Promise.all(
    Object.values(<Readonly<IChains>>require('../data/chains.js')).map(
      async (chain: IChain | IChainHarvester) => {
        if (!chain.hasOnChainHarvesting) return;
        if (!chainIsOnChainHarvestingType(chain)) {
          logger.error(`On-chain harvesting misconfigured for ${chain.id.toUpperCase()}`);
          return;
        }

        const gelatoAdminWallet: NonceManage = new NonceManage(
          new Wallet(pk, new ethers.providers.JsonRpcProvider(chain.rpc))
        );

        logger.info(`>>> on-chain harvester sync: ${chain.id.toUpperCase()}`);
        new TaskSyncer(
          gelatoAdminWallet,
          chain,
          await new GelatoClient(gelatoAdminWallet, chain)
        ).syncVaultHarvesterTasks();
      }
    )
  ); //await Promise.all( Object.values( <Readonly< IChains>>
}; //const run = async (): Promise< void>
run();
