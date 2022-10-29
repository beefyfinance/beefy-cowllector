import {ethers, Contract, BigNumber, type ContractTransaction} from 'ethers';
//import {keccak256, toUtf8Bytes} from '@ethersproject/utils';
import {GelatoOpsSDK} from '@gelatonetwork/ops-sdk';
import {settledPromiseFilled} from '../utility/baseNode';
import {NonceManage} from '../utility/NonceManage';
import {logger} from '../utility/Logger';
import {type IChainHarvester} from './interfaces';
import OPS_ABI from './abis/Ops.json';


const _logger = logger.getLogger( 'GelatoClient');

export class GelatoClient {
  //when task is not prepaid, the contract uses the null address, signifying to 
  //  use any funds in the treasury
  private static readonly _feeTokenWhenNotPrepaidTask = 
                                  '0x0000000000000000000000000000000000000000';

  private readonly _gelato: GelatoOpsSDK;
  private readonly _opsContract: Contract;
	private _selectorPerform: string = ''; 
	private _selectorChecker: string = ''; 
  private _gasPrice: BigNumber = BigNumber.from( 0);

  constructor( private readonly _gelatoAdmin: NonceManage, 
                private readonly _chain: Readonly< IChainHarvester>, 
                private readonly _shouldLog: boolean = false) {
    this._gelato = new GelatoOpsSDK( _chain.chainId, _gelatoAdmin);
    const operations = new Contract( _chain.addressHarvesterOperations, 
																												 OPS_ABI, _gelatoAdmin);
		this._opsContract = operations;
//	this._selectorPerform = keccak256( toUtf8Bytes( 
		this._selectorPerform = ethers.utils.id( 
					'performUpkeep(address,uint256,uint256,uint256,uint256,bool)').slice( 
					0, 10);	 
//	this._selectorChecker = keccak256( toUtf8Bytes( 'checker(address)')).slice( 
//																																			0, 10);
		this._selectorChecker = ethers.utils.id( 'checker(address)').slice( 0, 10);
		return <GelatoClient> <unknown> (async () : Promise< GelatoClient> => {
//					this._selectorPerform = await operations.getSelector( 
//							'performUpkeep(address,uint256,uint256,uint256,uint256,bool)');
//					this._selectorChecker = await operations.getSelector( 
//																												 'checker(address)');
						if (_gelatoAdmin.provider)	{
							const price = await _gelatoAdmin.provider.getGasPrice();
							_logger.info( `  gas price = ${price.div( 1e9)}`);
							this._gasPrice = price;
						}
						return this;
					})();
  } //constructor(


  public async getGelatoAdminTaskIds() : Promise< ReadonlyArray< string>> {
    const taskIds = <ReadonlyArray< string>> 
                                      await this._opsContract.getTaskIdsByUser( 
                                      this._gelatoAdmin.getAddress());
    _logger.info( `Retrieved ${taskIds.length} Gelato task ids.`)
    return taskIds;
  }


  public async computeTaskId( vault_: string) : Promise< string> {
    const replaced0x = `000000000000000000000000${vault_.toLowerCase().slice( 
                                                                          2)}`;
    const resolverData = `${this._selectorChecker}${replaced0x}`;
    const useTaskTreasuryFunds = true;
  
    if (this._shouldLog)  {
      _logger.trace(`Getting resolver hash for ${vault_}`);
      _logger.trace("getResolverHash data:");
      _logger.trace(`resolver: ${this._chain.addressHarvester}`);
      _logger.trace(`resolverData: ${resolverData}`);
    }
  
//  const resolverHash = await this._opsContract.getResolverHash( 
//																 this._chain.addressHarvester, resolverData);
    const resolverHash = ethers.utils.keccak256( 
																ethers.utils.defaultAbiCoder.encode(
																["address", "bytes"],
																[this._chain.addressHarvester, resolverData]));
  
    if (this._shouldLog)  {
      _logger.trace(`Getting taskId for vault: ${vault_}`);
      _logger.trace("getTaskId data:");
      _logger.trace(`taskCreator: ${this._gelatoAdmin.getAddress()}`)
      _logger.trace(`execAddress: ${this._chain.addressHarvester}`);
      _logger.trace(`selector: ${this._selectorPerform}`);
      _logger.trace(`useTaskTreasuryFunds: ${useTaskTreasuryFunds}`);
      _logger.trace(`feeToken: ${GelatoClient._feeTokenWhenNotPrepaidTask}`);
      _logger.trace(`resolverHash: ${resolverHash}`);
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


  public async createTasks( vaults: Readonly< Record< string, string>>) : 
                            Promise< Record< string, string>> {
//  for (const key in vaults) {
    const results: PromiseSettledResult< [string, string]>[] = 
                                        await Promise.allSettled( Object.keys( 
                                        vaults).map( async key => {
          const vault: string = vaults[ key];
          _logger.debug( `Creating task for ${key} on ${
                                this._chain.id.toUpperCase()}\n  --> ${vault}`);
          try {
            const taskId: string = await this._createTask( vault);
            _logger.info( `Gelato ${this._chain.id.toUpperCase()
                              } task created for ${key}\n  taskId = ${taskId}`);
            await this._gelato.renameTask( taskId, key);
            return [key, taskId];
          } catch (e: unknown) {
            _logger.error( `Failed to fully form Gelato task for ${key} on ${
                                                this._chain.id.toUpperCase()}`);
            _logger.error( <any> e);
            throw( e);
          }
        })); //await Promise.allSettled(

    return results.reduce( (map,  
                          result: PromiseSettledResult< [string, string]>) => {
            if (settledPromiseFilled( result))
              map[ result.value[ 0]] = result.value[ 1];
            return map;
          }, {} as Record< string, string>);
  } //public async createTasks(


  private async _createTask( vault: string) : Promise< string> {
    const replaced0x: string = `000000000000000000000000${
                                                vault.toLowerCase().slice(2)}`;
    const resolverData: string = `${this._selectorChecker}${replaced0x}`;

    if (this._shouldLog)  {
      _logger.trace( 'Create task data:');
      _logger.trace( `execAddress: ${this._chain.addressHarvester}`);
      _logger.trace( `execSelector: ${this._selectorPerform}`);
      _logger.trace( `resolverAddress: ${this._chain.addressHarvester}`);
      _logger.trace( `resolverData: ${resolverData}`);
    }
    _logger.debug( `About to callStatic for ${vault}, checkerSelector ${
																											this._selectorChecker}`);
    const taskId: string = (await this._opsContract.callStatic.createTask(
														this._chain.addressHarvester, this._selectorPerform,
														this._chain.addressHarvester, resolverData, 
														{gasPrice: this._gasPrice})).toString();
    _logger.debug( `About to createTask for ${vault}\n  --> taskId ${taskId}`);
    const txn: ContractTransaction = await this._opsContract.createTask(
														this._chain.addressHarvester, this._selectorPerform,
														this._chain.addressHarvester, resolverData, 
														{gasPrice: this._gasPrice});
    _logger.debug( `About to wait on createTask for ${vault}`);
    await txn.wait();
    return taskId;
  } //private async _createTask(


  public async deleteTasks( taskIds: ReadonlySet< string>) : 
                            Promise< Record< string, string>> {
let i = 0;
//  for (const taskId of taskIds)
    const results: PromiseSettledResult< [string, string]>[] = 
                                      await Promise.allSettled( Array.from( 
                                      taskIds).map( async (taskId: string) => {
          try {
						_logger.debug( `Deleting taskId ${taskId}`);
            const {tx: txn}: {tx: ContractTransaction} = 
                                            await this._gelato.cancelTask( 
                                            taskId, {gasPrice: this._gasPrice});
            _logger.debug( `About to wait on deleteTask for ${taskId}`);
            await txn.wait();
            _logger.info( `Gelato task deleted on ${
                        this._chain.id.toUpperCase() }\n  taskId = ${ taskId}`);
          } catch (e: unknown) {
            _logger.error( <any> e);
            _logger.error( `Failed to delete Gelato task on ${
                        this._chain.id.toUpperCase()}\n  taskId = ${ taskId}`);
            throw( e);
          }
const key: string = 'mooTokenTODO_' + i++;
          return [key, taskId];
        })); //await Promise.allSettled(

    return results.reduce( (map, 
                          result: PromiseSettledResult< [string, string]>) => {
          if (settledPromiseFilled( result))
            map[ result.value[ 0]] = result.value[ 1];
          return map;
        }, {} as Record< string, string>);
  } //public async deleteTasks( 
} //class GelatoClient
