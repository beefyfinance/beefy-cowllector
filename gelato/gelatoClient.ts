import {ethers, Contract, BigNumber, type ContractTransaction} from 'ethers';
import type {JsonFragment} from '@ethersproject/abi';
//import {keccak256, toUtf8Bytes} from '@ethersproject/utils';
import {GelatoOpsSDK, type Task} from '@gelatonetwork/ops-sdk';
import {settledPromiseFilled} from '../utility/baseNode';
import {NonceManage} from '../utility/NonceManage';
import {logger} from '../utility/Logger';
import type {VaultRecord} from './taskSyncer';
import {type IChainHarvester} from './interfaces';
import OPS_ABI from './abis/Ops.json';

const _logger = logger.getLogger( 'GelatoClient');


function encodeAddressAndBytes( resolverAddress: string,
																resolverData: string) : string	{
  return ethers.utils.keccak256( ethers.utils.defaultAbiCoder.encode( 
												["address", "bytes"], [resolverAddress, resolverData]));
}


export class GelatoClient {
  //when task is not prepaid, the contract uses the null address, signifying to 
  //  use any funds in the treasury
  private static readonly _feeTokenWhenNotPrepaidTask = 
                                  '0x0000000000000000000000000000000000000000';
	private static readonly _legacyCreateTask: JsonFragment = 
																			{"inputs": [{"internalType": "address",
																										"name": "_execAddress",
																										"type": "address"},
																									{"internalType": "bytes4",
																										"name": "_execSelector",
																										"type": "bytes4"},
																									{"internalType": "address",
																										"name": "_resolverAddress",
																										"type": "address"},
																									{"internalType": "bytes",
																										"name": "_resolverData",
																										"type": "bytes"}],
																			"name": "createTask",
																			"outputs": [{"internalType": "bytes32",
																											"name": "task",
																											"type": "bytes32"}],
																			"stateMutability": "nonpayable",
																			"type": "function"};

  private readonly _gelato: GelatoOpsSDK;
  private readonly _opsContract: Contract;
	private _selectorPerform: string = ''; 
	private _selectorChecker: string = ''; 
  private _gasPrice: BigNumber = BigNumber.from( 0);

  constructor( private readonly _gelatoAdmin: NonceManage, 
                private readonly _chain: Readonly< IChainHarvester>, 
                private readonly _shouldLog: boolean = false) {
    this._gelato = new GelatoOpsSDK( _chain.chainId, _gelatoAdmin);
    this._opsContract = new Contract( _chain.addressHarvesterOperations, 
																								[...<JsonFragment[]> OPS_ABI, 
																								GelatoClient._legacyCreateTask], 
																								_gelatoAdmin);
		this._selectorPerform = ethers.utils.id( 
					'performUpkeep(address,uint256,uint256,uint256,uint256,bool)').slice( 
					0, 10);	 
		this._selectorChecker = ethers.utils.id( 'checker(address)').slice( 0, 10);
		return <GelatoClient> <unknown> (async () : Promise< GelatoClient> => {
						if (_gelatoAdmin.provider)	{
							const price = await _gelatoAdmin.provider.getGasPrice();
							_logger.info( `  ${this._chain.id.toUpperCase()} - gas price = ${
														price.div( 1e9)}`);
							this._gasPrice = price;
						}
						return this;
					})();
  } //constructor(


  public async taskInfo() : Promise< Readonly< Record< string, string>>> {
		const tasks: ReadonlyArray< Task> = await this._gelato.getActiveTasks();
    _logger.info( `${this._chain.id.toUpperCase()} - Retrieved ${ tasks.length
																													} Task IDs.`);
    return tasks.reduce( (map, task) => {
															map[ task.taskId] = task.name;
															return map;
														}, {} as Record< string, string>);
  }


  public async computeTaskId( vault_: string) : Promise< string> {
    const replaced0x = `000000000000000000000000${vault_.toLowerCase().slice( 
                                                                          2)}`;
    const resolverData = `${this._selectorChecker}${replaced0x}`;
    const useTaskTreasuryFunds = true;
  
    if (this._shouldLog)  {
      _logger.trace( `Getting resolver hash for ${vault_}`);
      _logger.trace( `resolver: ${this._chain.addressHarvester}`);
      _logger.trace( `resolverData: ${resolverData}`);
    }
  
    const resolverHash = encodeAddressAndBytes( this._chain.addressHarvester, 
																																	resolverData);
  
    if (this._shouldLog)  {
      _logger.trace( `Getting taskId for vault: ${vault_}`);
      _logger.trace( "getTaskId data:");
      _logger.trace( `taskCreator: ${this._gelatoAdmin.getAddress()}`)
      _logger.trace( `execAddress: ${this._chain.addressHarvester}`);
      _logger.trace( `selector: ${this._selectorPerform}`);
      _logger.trace( `useTaskTreasuryFunds: ${useTaskTreasuryFunds}`);
      _logger.trace( `feeToken: ${GelatoClient._feeTokenWhenNotPrepaidTask}`);
      _logger.trace( `resolverHash: ${resolverHash}`);
    }
  
    const id = await this._opsContract[ 
											'getTaskId(address,address,bytes4,bool,address,bytes32)']( 
																		this._gelatoAdmin.getAddress(),
																		this._chain.addressHarvester, 
																		this._selectorPerform, useTaskTreasuryFunds, 
																		GelatoClient._feeTokenWhenNotPrepaidTask, 
																		resolverHash);
  
    _logger.trace( `Task id: ${id}`);
    return id;
  } //public async computeTaskId(


  public async createTasks( vaults: Readonly< VaultRecord>) : 
                            Promise< Record< string, string> | null>	{
//const max = 2; let count: number = 0;
//  for (const key in vaults) {
    const results: PromiseSettledResult< [string, string]>[] = 
                                        await Promise.allSettled( Object.keys( 
                                        vaults).map( async name => {
          const vault: string = vaults[ name];
//if (++count > max) throw new Error( `won't create task for ${vault}`);
/*_logger.info( */_logger.debug(/* */`Creating task for ${name} on ${
                                this._chain.id.toUpperCase()}\n  --> ${vault}`);
          try {
            const taskId: string = await this._createTask( vault);
            _logger.info( `${this._chain.id.toUpperCase()
													} - task created for ${name}\n  taskId = ${taskId}`);
            await this._gelato.renameTask( taskId, name);
            return [name, taskId];
          } catch (error: unknown) {
            _logger.error( `Failed to fully form task for ${name} on ${
																							this._chain.id.toUpperCase()}\n${
																							(<any> error).toString()}`);
            throw error;
          }
        })); //await Promise.allSettled(
		_logger.debug( '-> All createTask attempts settled.');

		const filled = results.reduce( (map,  
                          result: PromiseSettledResult< [string, string]>) => {
																		if (settledPromiseFilled( result))
																			map[ result.value[ 0]] = result.value[ 1];
																		return map;
																	}, {} as Record< string, string>);
    return Object.keys( filled).length ? filled : null;
  } //public async createTasks(


  private async _createTask( vault: string) : Promise< string> {
    const replaced0x = `000000000000000000000000${vault.toLowerCase().slice( 
																																					2)}`;
    const resolverData = `${this._selectorChecker}${replaced0x}`;

    if (this._shouldLog)  {
      _logger.trace( 'Create task data:');
      _logger.trace( `execAddress: ${this._chain.addressHarvester}`);
      _logger.trace( `execSelector: ${this._selectorPerform}`);
      _logger.trace( `resolverAddress: ${this._chain.addressHarvester}`);
      _logger.trace( `resolverData: ${resolverData}`);
    }
//	const moduleData = {modules: [0], args: [encodeAddressAndBytes( 
//																this._chain.addressHarvester, resolverData)]};
    _logger.debug( `About to callStatic for ${vault}`);
//  const taskId: string = (await this._opsContract.callStatic.createTask(
		const taskId: string = (await this._opsContract.callStatic[ 
																		'createTask(address,bytes4,address,bytes)']( 
														this._chain.addressHarvester, this._selectorPerform,
														this._chain.addressHarvester, resolverData, 
//													moduleData, ethers.constants.AddressZero, 
														{gasPrice: this._gasPrice})).toString();
    _logger.debug( `About to createTask for ${vault}\n  --> taskId ${taskId}`);
//  const txn: ContractTransaction = await this._opsContract.createTask(
    const txn: ContractTransaction = await this._opsContract[
																		'createTask(address,bytes4,address,bytes)']( 
														this._chain.addressHarvester, this._selectorPerform,
														this._chain.addressHarvester, resolverData, 
//													moduleData, ethers.constants.AddressZero, 
														{gasPrice: this._gasPrice});
    _logger.debug( `About to wait on createTask for ${vault}`);
    await txn.wait();
    return taskId;
  } //private async _createTask(


  public async deleteTasks( tasks: ReadonlySet< Task>) : 
                            Promise< Record< string, string> | null>	{
		//for each task to be deleted...
//  for (const task of tasks)
    const results: PromiseSettledResult< [string, string]>[] = 
																			await Promise.allSettled( Array.from( 
																			tasks).map( async (task: Task, index) => {
						try {
							//delete the task
							_logger.debug( `Deleting taskId ${task.name}`);
							const {tx: txn}: {tx: ContractTransaction} = 
																			await this._gelato.cancelTask( 
																			task.taskId, {gasPrice: this._gasPrice});
							_logger.debug( `About to wait on deleteTask for ${task.name}`);
							await txn.wait();
							_logger.info( `${this._chain.id.toUpperCase()
															} - task deleted: ${task.name}`);
						} catch (error: unknown) {
							_logger.error( `Failed to delete task on ${
																			this._chain.id.toUpperCase()}: ${task.name
																			}\n -> ERROR: ${<any> error}`);
							throw error;
						}

						//note the deletion
						return [task.name, task.taskId];
					})); //await Promise.allSettled( Array.from( tasks
		_logger.debug( '-> All deleteTask attempts settled.');

		const filled = results.reduce( (map, 
                          result: PromiseSettledResult< [string, string]>) => {
																		if (settledPromiseFilled( result))
																			map[ result.value[ 0]] = result.value[ 1];
																		return map;
																	}, {} as Record< string, string>);
    return Object.keys( filled).length ? filled : null;
  } //public async deleteTasks( 


  public async renameTasks( tasks: ReadonlySet< Task>) : 
                            Promise< Record< string, string> | null>	{
		//for each task to be renamed...
//  for (const task of tasks)
    const results: PromiseSettledResult< [string, string]>[] = 
																			await Promise.allSettled( Array.from( 
																			tasks).map( async (task: Task, index) => {
						try {
							//rename the task
							_logger.debug( `Renaming taskId ${task.name}`);
							await this._gelato.renameTask( task.taskId, task.name);
							_logger.info( `${this._chain.id.toUpperCase() } - task renamed: ${
														task.name}`);
						} catch (error: unknown) {
							_logger.error( `Failed to rename task on ${
																			this._chain.id.toUpperCase()}: ${task.name
																			}\n -> ERROR: ${<any> error}`);
							throw error;
						}

						//note the renaming
						return [task.name, task.taskId];
					})); //await Promise.allSettled( Array.from( tasks
		_logger.debug( '-> All renameTask attempts settled.');

		const filled = results.reduce( (map, 
                          result: PromiseSettledResult< [string, string]>) => {
																		if (settledPromiseFilled( result))
																			map[ result.value[ 0]] = result.value[ 1];
																		return map;
																	}, {} as Record< string, string>);
    return Object.keys( filled).length ? filled : null;
	} //public async renameTasks(
} //class GelatoClient
