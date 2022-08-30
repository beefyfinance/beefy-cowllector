import { Contract, ethers, type Wallet, type ContractTransaction } from 'ethers';
import { type IChain } from './interfaces';
import { GelatoOpsSDK } from '@gelatonetwork/ops-sdk';
import OPS_ABI from './abis/Ops.json';

const _logger = logger.getLogger('GelatoClient');

const _logger = logger.getLogger( 'GelatoClient');

export class GelatoClient {
  //when task is not prepaid, the contract uses the null address, signifying to use any 
  //  funds in the treasury
  private static readonly _feeTokenWhenNotPrepaidTask = 
                                            '0x0000000000000000000000000000000000000000';

  private readonly _opsContract: Contract;
  private readonly _gelato: GelatoOpsSDK;


  constructor( private readonly _gelatoAdmin: Readonly< Wallet>, 
                private readonly _chain: Readonly< IChain & 
                                  {ochHarvester: NonNullable< IChain[ 'ochHarvester']>, 
                                  ochOperations: NonNullable< IChain[ 'ochOperations']>}>, 
                private readonly _shouldLog: boolean) {
    this._opsContract = new Contract( _chain.ochOperations, OPS_ABI, _gelatoAdmin);
    this._gelato = new GelatoOpsSDK( _chain.chainId, _gelatoAdmin);
  }


  public async getGelatoAdminTaskIds() : Promise< ReadonlyArray< string>> {
    const taskIds = <ReadonlyArray< string>> await this._opsContract.getTaskIdsByUser( 
                                                                this._gelatoAdmin.address);
    this._log( `Retrieved ${taskIds.length} task ids.`)
    return taskIds;
  }


  public async computeTaskId( vault_: string) : Promise< string> {
    const performSelector = await this._opsContract.getSelector( 
                            "performUpkeep(address,uint256,uint256,uint256,uint256,bool)");
    const checkerSelector = await this._opsContract.getSelector("checker(address)");
    const replaced0x = `000000000000000000000000${vault_.toLowerCase().slice(2)}`
    const resolverData = `${checkerSelector}${replaced0x}`
    const useTaskTreasuryFunds = true;
  
    if (this._shouldLog)  {
      this._log(`Getting resolver hash for ${vault_}`);
      this._log("getResolverHash data:");
      this._log(`resolver: ${this._chain.ochHarvester}`);
      this._log(`resolverData: ${resolverData}`);
    }
  
    const resolverHash = await this._opsContract.getResolverHash( this._chain.ochHarvester,  
                                                                            resolverData);
  
    if (this._shouldLog)  {
      this._log(`Getting taskId for vault: ${vault_}`);
      this._log("getTaskId data:");
      this._log(`taskCreator: ${this._gelatoAdmin.address}`)
      this._log(`execAddress: ${this._chain.ochHarvester}`);
      this._log(`selector: ${performSelector}`);
      this._log(`useTaskTreasuryFunds: ${useTaskTreasuryFunds}`);
      this._log(`feeToken: ${GelatoClient._feeTokenWhenNotPrepaidTask}`);
      this._log(`resolverHash: ${resolverHash}`);
    }
  
    const id = await this._opsContract.getTaskId( this._gelatoAdmin.address,
                                  this._chain.ochHarvester, performSelector, 
                                  useTaskTreasuryFunds, 
                                  GelatoClient._feeTokenWhenNotPrepaidTask, resolverHash);
  
    _logger.trace(`Task id: ${id}`);
    return id;
  } //public async computeTaskId(


  public async createTasks( vaults: Readonly< Record< string, string>>) : Promise< void> {
    for (const key in vaults) {
      const vault: string = vaults[ key];
      this._log( `Creating task for ${key}`);
      try {
        const taskId: string = await this._createTask( vault);
        console.log( `Gelato task created for ${key} on ${this._chain.id.toUpperCase()
                                                                  }: taskId = ${taskId}`);
        await this._gelato.renameTask( taskId, key);
      } catch (e: unknown) {
        this._log( e as string);
        console.log( `Failed to fully form Gelato task for ${key} on ${
                                                          this._chain.id.toUpperCase()}`);
      }
    }
  } //public async createTasks(


  private async _createTask( vault: string) : Promise< string> {
    const performSelector = await this._opsContract.getSelector(
                            'performUpkeep(address,uint256,uint256,uint256,uint256,bool)');
    const checkerSelector = await this._opsContract.getSelector( 'checker(address)');
    const replaced0x = `000000000000000000000000${vault.toLowerCase().slice(2)}`;
    const resolverData = `${checkerSelector}${replaced0x}`;

    if (this._shouldLog)  {
      this._log( 'Create task data:');
      this._log( `execAddress: ${this._chain.ochHarvester}`);
      this._log( `execSelector: ${performSelector}`);
      this._log( `resolverAddress: ${this._chain.ochHarvester}`);
      this._log( `resolverData: ${resolverData}`);
    }

    const taskId: string = (await this._opsContract.callStatic.createTask(
                                      this._chain.ochHarvester, performSelector,
                                      this._chain.ochHarvester, resolverData)).toString();
    const txn: ContractTransaction = await this._opsContract.createTask(
                                                this._chain.ochHarvester, performSelector, 
                                                this._chain.ochHarvester, resolverData);
    await txn.wait();
    return taskId;
  } //private async _createTask(


  public async deleteTasks( taskIds: ReadonlySet< string>) : Promise< void> {
    for (const taskId of taskIds)
      try {
        const {tx: txn}: {tx: ContractTransaction} = await this._gelato.cancelTask( 
                                                                                  taskId);
        await txn.wait();
        console.log( `Gelato task deleted on ${this._chain.id.toUpperCase()}: taskId = ${
                                                                                taskId}`);
      } catch (e: unknown) {
        this._log( e as string);
        console.log( `Failed to delete Gelato task on ${
                                      this._chain.id.toUpperCase()}: taskId = ${ taskId}`);
      }
  } //public async deleteTasks( 


  private _log( _log: string) : void {
    if (this._shouldLog) {
      console.log( _log);
    }
  }
} //class GelatoClient 
