import { ethers, Wallet } from 'ethers';
import OPS_ABI from './abis/Ops.json';

export class GelatoClient {
  readonly gelatoAdmin: Wallet;
  readonly harvesterAddress: string;
  readonly opsAddress: string;

  constructor(gelatoAdmin_: Wallet, harvesterAddress_: string, opsAddress_: string) {
    this.gelatoAdmin = gelatoAdmin_;
    this.harvesterAddress = harvesterAddress_;
    this.opsAddress = opsAddress_;
  }

  async createTasks(vaultMap: Record<string, string>) {
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
    const ops = new ethers.Contract(this.opsAddress, OPS_ABI, this.gelatoAdmin);

    const performSelector = await ops.getSelector(
      'performUpkeep(address,uint256,uint256,uint256,uint256,bool)'
    );
    const checkerSelector = await ops.getSelector('checker(address)');
    const replaced0x = `000000000000000000000000${vault.toLowerCase().slice(2)}`;
    const resolverData = `${checkerSelector}${replaced0x}`;

    console.log('Create task data:');
    console.log(`execAddress: ${this.harvesterAddress}`);
    console.log(`execSelector: ${performSelector}`);
    console.log(`resolverAddress: ${this.harvesterAddress}`);
    console.log(`resolverData: ${resolverData}`);

    const txn = await ops.createTask(
      this.harvesterAddress,
      performSelector,
      this.harvesterAddress,
      resolverData
    );

    await txn.wait();
  }
}
