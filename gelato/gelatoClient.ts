import { Contract, ethers, Wallet } from 'ethers';
import { IGelatoOps } from './typechain/IGelatoOps';
import OPS_ABI from './abis/Ops.json';

export class GelatoClient {
  private static readonly _feeTokenWhenNotPrepaidTask = "0x0000000000000000000000000000000000000000"; // When task is not prepaid, the contract just uses 0 address, since it uses any funds in the treasury.

  private readonly _gelatoAdmin: Wallet;
  private readonly _harvesterAddress: string;
  private readonly _opsContract: IGelatoOps;

  constructor(gelatoAdmin_: Wallet, harvesterAddress_: string, opsAddress_: string) {
    this._gelatoAdmin = gelatoAdmin_;
    this._harvesterAddress = harvesterAddress_;
    this._opsContract = new Contract(opsAddress_, OPS_ABI, this._gelatoAdmin) as IGelatoOps;
  }

  public async getGelatoAdminTaskIds(): Promise<string[]> {
    const taskIds = await this._opsContract.getTaskIdsByUser(this._gelatoAdmin.address);
    console.log(`Retrieved ${taskIds.length} task ids.`)
    return taskIds;
  }

  public async computeTaskId(vault_: string): Promise<string> {
    const performSelector = await this._opsContract.getSelector("performUpkeep(address,uint256,uint256,uint256,uint256,bool)");
    const checkerSelector = (await this._opsContract.getSelector("checker(address)"));
    const replaced0x = `000000000000000000000000${vault_.toLowerCase().slice(2)}`
    const resolverData = `${checkerSelector}${replaced0x}`
    const useTaskTreasuryFunds = true;
  
    console.log(`Getting resolver hash for ${vault_}`);
  
    console.log("getResolverHash data:");
    console.log(`resolver: ${this._harvesterAddress}`);
    console.log(`resolverData: ${resolverData}`);
  
    const resolverHash = await this._opsContract.getResolverHash(
      this._harvesterAddress,
      resolverData
    )
  
    console.log(`Getting taskId for vault: ${vault_}`);
  
    console.log("getTaskId data:");
    console.log(`taskCreator: ${this._gelatoAdmin.address}`)
    console.log(`execAddress: ${this._harvesterAddress}`);
    console.log(`selector: ${performSelector}`);
    console.log(`useTaskTreasuryFunds: ${useTaskTreasuryFunds}`);
    console.log(`feeToken: ${GelatoClient._feeTokenWhenNotPrepaidTask}`);
    console.log(`resolverHash: ${resolverHash}`);
  
    const id = await this._opsContract.getTaskId(
      this._gelatoAdmin.address,
      this._harvesterAddress,
      performSelector,
      useTaskTreasuryFunds,
      GelatoClient._feeTokenWhenNotPrepaidTask,
      resolverHash
    );
  
    console.log(`Task id: ${id}`);
    return id;
  }

  public async createTasks(vaultMap: Record<string, string>): Promise<void> {
    for (const key in vaultMap) {
      const vault = vaultMap[key];
      console.log(`Creating task for ${key}`);
      try {
        await this.createTask(vault);
        console.log('Task created');
      } catch (e) {
        console.log(e);
        console.log(`Failed for ${key}`);
      }
    }
  }

  private async createTask(vault: string) {

    const performSelector = await this._opsContract.getSelector(
      'performUpkeep(address,uint256,uint256,uint256,uint256,bool)'
    );
    const checkerSelector = await this._opsContract.getSelector('checker(address)');
    const replaced0x = `000000000000000000000000${vault.toLowerCase().slice(2)}`;
    const resolverData = `${checkerSelector}${replaced0x}`;

    console.log('Create task data:');
    console.log(`execAddress: ${this._harvesterAddress}`);
    console.log(`execSelector: ${performSelector}`);
    console.log(`resolverAddress: ${this._harvesterAddress}`);
    console.log(`resolverData: ${resolverData}`);

    const txn = await this._opsContract.createTask(
      this._harvesterAddress,
      performSelector,
      this._harvesterAddress,
      resolverData
    );

    await txn.wait();
  }
}
