import { Contract, ethers, Wallet } from 'ethers';
import OPS_ABI from '../abis/Ops.json';
export class GelatoClient {
  private static readonly _feeTokenWhenNotPrepaidTask = "0x0000000000000000000000000000000000000000"; // When task is not prepaid, the contract just uses 0 address, since it uses any funds in the treasury.

  private readonly _gelatoAdmin: Wallet;
  private readonly _harvesterAddress: string;
  private readonly _opsContract: Contract;
  private readonly _shouldLog: boolean;

  constructor(gelatoAdmin_: Wallet, harvesterAddress_: string, opsAddress_: string, shouldLog: boolean) {
    this._gelatoAdmin = gelatoAdmin_;
    this._harvesterAddress = harvesterAddress_;
    this._opsContract = new Contract(opsAddress_, OPS_ABI, this._gelatoAdmin);
    this._shouldLog = shouldLog;
  }

  public async getGelatoAdminTaskIds(): Promise<string[]> {
    const taskIds = await this._opsContract.getTaskIdsByUser(this._gelatoAdmin.address);
    this._log(`Retrieved ${taskIds.length} task ids.`)
    return taskIds;
  }

  public async computeTaskId(vault_: string): Promise<string> {
    const performSelector = await this._opsContract.getSelector("performUpkeep(address,uint256,uint256,uint256,uint256,bool)");
    const checkerSelector = (await this._opsContract.getSelector("checker(address)"));
    const replaced0x = `000000000000000000000000${vault_.toLowerCase().slice(2)}`
    const resolverData = `${checkerSelector}${replaced0x}`
    const useTaskTreasuryFunds = true;
  
    this._log(`Getting resolver hash for ${vault_}`);
  
    this._log("getResolverHash data:");
    this._log(`resolver: ${this._harvesterAddress}`);
    this._log(`resolverData: ${resolverData}`);
  
    const resolverHash = await this._opsContract.getResolverHash(
      this._harvesterAddress,
      resolverData
    )
  
    this._log(`Getting taskId for vault: ${vault_}`);
  
    this._log("getTaskId data:");
    this._log(`taskCreator: ${this._gelatoAdmin.address}`)
    this._log(`execAddress: ${this._harvesterAddress}`);
    this._log(`selector: ${performSelector}`);
    this._log(`useTaskTreasuryFunds: ${useTaskTreasuryFunds}`);
    this._log(`feeToken: ${GelatoClient._feeTokenWhenNotPrepaidTask}`);
    this._log(`resolverHash: ${resolverHash}`);
  
    const id = await this._opsContract.getTaskId(
      this._gelatoAdmin.address,
      this._harvesterAddress,
      performSelector,
      useTaskTreasuryFunds,
      GelatoClient._feeTokenWhenNotPrepaidTask,
      resolverHash
    );
  
    this._log(`Task id: ${id}`);
    return id;
  }

  public async createTasks(vaultMap_: Record<string, string>): Promise<void> {
    for (const key in vaultMap_) {
      const vault = vaultMap_[key];
      this._log(`Creating task for ${key}`);
      try {
        await this._createTask(vault);
        this._log('Task created');
      } catch (e) {
        this._log(e as string);
        this._log(`Failed for ${key}`);
      }
    }
  }

  private async _createTask(vault_: string) {

    const performSelector = await this._opsContract.getSelector(
      'performUpkeep(address,uint256,uint256,uint256,uint256,bool)'
    );
    const checkerSelector = await this._opsContract.getSelector('checker(address)');
    const replaced0x = `000000000000000000000000${vault_.toLowerCase().slice(2)}`;
    const resolverData = `${checkerSelector}${replaced0x}`;

    this._log('Create task data:');
    this._log(`execAddress: ${this._harvesterAddress}`);
    this._log(`execSelector: ${performSelector}`);
    this._log(`resolverAddress: ${this._harvesterAddress}`);
    this._log(`resolverData: ${resolverData}`);

    const txn = await this._opsContract.createTask(
      this._harvesterAddress,
      performSelector,
      this._harvesterAddress,
      resolverData
    );

    await txn.wait();
  }

  private _log(log_: string) {
    if (this._shouldLog) {
      console.log(log_);
    }
  }
}
