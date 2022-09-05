import 'dotenv/config'

import { ethers, Wallet } from 'ethers';
import { NonceManager } from '@ethersproject/experimental';
import { TaskSyncer } from './taskSyncer';
import { IChain, IChainOch, IChains } from './interfaces';


class MyNonceMgr extends NonceManager	{
	private  _threshold: number = 1;
	_pending: number = 0;
	_waited: number = 0;

	constructor( signer: ethers.Signer) {
		super( signer);
	}


	signTransaction( txn: ethers.utils.Deferrable< 
																				ethers.providers.TransactionRequest>) : 
										Promise< string>	{
		console.log( `signTransaction, nonce: ${ethers.BigNumber.from( 
																											txn.nonce).toNumber()}`);
		return super.signTransaction( txn);
	}


	async sendTransaction( txn: ethers.utils.Deferrable< 
																				ethers.providers.TransactionRequest>) : 
													Promise< ethers.providers.TransactionResponse>	{
    console.log( `super send with ${this._pending} pending`);

		if (this._pending >= this._threshold) {
			const waiter: number = ++this._waited;
		  console.log( `  set aside as waiter ${waiter}`);
			await new Promise< void | string>( (resolve: (x?: any) => void) => {
				const monitor: () => void = () =>	{
							if (this._pending >= this._threshold)
								setTimeout( monitor, 1000);
							else	{
								++this._pending;
								console.log( `  releasing waiter ${waiter}`);
								resolve( `waiter ${waiter} resolved`);
							}
						}
				monitor();
			}); //await new Promise< 
		}else
      ++this._pending;
																					
		console.log( `sendTransaction, nonce: ${txn.nonce}`);
		return super.sendTransaction( txn).then( (txnResponse: 
																		ethers.providers.TransactionResponse) =>	{
											console.log( `txn ${txn.nonce
																	} sent to node --> decrementing pending to ${
																	this._pending - 1}`);
											--this._pending;
											return txnResponse;});
	} //async sendTransaction(


	signMessage( message: ethers.Bytes | string) : Promise< string> {
		console.log( `signMessage`);
		return super.signMessage( message);
	}

	getTransactionCount( blockTag?: ethers.providers.BlockTag) : 
												Promise< number> {
		console.log( `getTransactionCount, blockTag = ${blockTag}`);
		const PI = super.getTransactionCount( blockTag);
		console.log( `  got txn-count, , deltaCount = ${this._deltaCount}`);
		return PI;
	}

	incrementTransactionCount( count?: number) : void {
		console.log( `incrementTransactionCount, count = ${count}, deltaCount = ${
																													this._deltaCount}`);
		super.incrementTransactionCount( count);
	}
} //class MyNonceMgr 


const run = async () : Promise< void> => {
  const pk = process.env.GELATO_ADMIN_PK!;

  /*Object.values( <Readonly< IChains>> require( '../data/chains.js')).forEach( (chain: IChain) =>  {*/
  await Promise.all( Object.values( <Readonly< IChains>> require( 
																					'../data/chains.js')).map( 
																					async (chain: IChain | IChainOch) => {
    if (!chain.hasOnChainHarvesting)
      return;
    if (!( (test: IChainOch | IChain) : test is IChainOch => 'string' === 
											typeof test.ochHarvester && !!test.ochHarvester.length && 
											'string' === typeof test.ochOperations && 
											!!test.ochOperations.length)( chain))  {
      console.log( `On-chain harvesting misconfigured for ${
																											chain.id.toUpperCase()}`);
      return;
    }

//  const gelatoAdminWallet: NonceManager = new NonceManager( new Wallet( pk, 
    const gelatoAdminWallet: NonceManager = new MyNonceMgr( new Wallet( pk, 
																					new ethers.providers.JsonRpcProvider( 
																					chain.rpc)));
/*const O = {};
console.log( `getTxnCount = ${await gelatoAdminWallet.getTransactionCount( 
														'pending')}, initialPromise = ${await Promise.race( 
														[gelatoAdminWallet._initialPromise, O]).then( 
														v => v === O ? "pending" : "fulfilled")
														}, ${await gelatoAdminWallet._initialPromise.then( 
														n => n)}`);
*///  const provider = new ethers.providers.JsonRpcProvider( chain.rpc);
//  const gelatoAdminWallet: Wallet = new Wallet( pk, provider);
//  const gelatoAdminWallet: NonceManager = new NonceManager( pk, provider);

    console.log( '>>>>> on-chain harvester sync: ', chain.id);
    new TaskSyncer( gelatoAdminWallet, chain).syncVaultHarvesterTasks();
  })); //await Promise.all( Object.values( <Readonly< IChains>>
}; //const run = async (): Promise< void>


run();
