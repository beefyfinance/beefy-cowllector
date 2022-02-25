import { Contract, ethers, Wallet } from 'ethers';
import { BeefyAppClient } from './beefyAppClient';

export class Harvester {
  private readonly _cowllector: Wallet;
  private readonly _beefyAppClient: BeefyAppClient;
  private readonly _chainName: string;
  private readonly _vaultDenylist: Set<string>;
  private readonly _harvesterAddress: string;

  constructor(
    cowllector_: Wallet,
    chainName_: string,
    harvesterAddress_: string,
    opsAddress_: string,
    vaultDenylist_: Set<string>
  ) {
    this._cowllector = cowllector_;
    this._beefyAppClient = new BeefyAppClient();
    this._chainName = chainName_;
    this._vaultDenylist = vaultDenylist_;
    this._harvesterAddress = harvesterAddress_;
  }

  
}
