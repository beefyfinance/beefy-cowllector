import { Contract, ethers, Overrides, Wallet } from 'ethers';
import { BeefyAppClient } from './beefyAppClient';
import HARVESTER_ABI from './abis/Harvester.json';
import { BeefySingleHarvesterGelato } from './typechain/BeefySingleHarvesterGelato';

export class Harvester {
  private readonly _cowllector: Wallet;
  private readonly _beefyAppClient: BeefyAppClient;
  private readonly _chainName: string;
  private readonly _vaultHarvestList: Set<string>; // Should be the opposite of the gelatoDenyList.
  private readonly _harvesterContract: Contract;

  constructor(
    cowllector_: Wallet,
    chainName_: string,
    harvesterAddress_: string,
    vaultHarvestList_: Set<string>
  ) {
    this._cowllector = cowllector_;
    this._beefyAppClient = new BeefyAppClient();
    this._chainName = chainName_;
    this._vaultHarvestList = vaultHarvestList_;
    this._harvesterContract = new Contract(
      harvesterAddress_,
      HARVESTER_ABI,
      this._cowllector
    );
  }

  public async runHarvest() {
    const vaultMap = await this.buildVaultMap();
    for (const vaultName in vaultMap) {
      const vaultAddress = vaultMap[vaultName];
      try {
        await this.tryHarvest(vaultName, vaultAddress);
      } catch (e) {
        console.log(`Error for vault: ${vaultName}`);
        console.log(e);
      }
    }
  }

  private async tryHarvest(vaultName: string, vaultAddress_: string) {
    const gasPrice = await this._cowllector.provider.getGasPrice();
    const overrides: Overrides = {
      gasPrice
    }

    console.log(`Checking to harvest ${vaultName}: ${vaultAddress_}`)
    const {
      willHarvestVault_,
      estimatedTxCost_,
      estimatedCallRewards_,
      estimatedProfit_,
      isDailyHarvest_,
    } = await this._harvesterContract.callStatic.checkUpkeep(gasPrice, vaultAddress_);

    console.log(`willHarvestVault: ${willHarvestVault_}`);
    console.log(`estimatedTxCost: ${estimatedTxCost_}`);
    console.log(`estimatedCallRewards: ${estimatedCallRewards_}`);
    console.log(`estimatedProfit: ${estimatedProfit_}`);
    console.log(`isDailyHarvest: ${isDailyHarvest_}`);

    if (willHarvestVault_) {
    //   const txn = await this._harvesterContract.performUpkeep(
    //     vaultAddress_,
    //     gasPrice,
    //     estimatedTxCost_,
    //     estimatedCallRewards_,
    //     estimatedProfit_,
    //     isDailyHarvest_,
    //     overrides
    //   );

    //   await txn.wait();
    }
  }

  private async buildVaultMap(): Promise<Record<string, string>> {
    const vaults = await this._beefyAppClient.fetchVaultsForChain(this._chainName);
    const vaultMap: Record<string, string> = {};
    for (const vaultConfig of vaults) {
      if (this._vaultHarvestList.has(vaultConfig.earnedToken)) {
        vaultMap[vaultConfig.earnedToken] = vaultConfig.earnedTokenAddress;
      }
    }

    return vaultMap;
  }
}
