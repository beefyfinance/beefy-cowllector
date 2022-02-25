import { Contract, ethers, Wallet } from 'ethers';

export class Harvester {

    private readonly _cowllector: Wallet;
    private readonly _harvesterAddress: string;
    private readonly _vaultsArrayJsEndpoint: string;
    private readonly _vaultDenylist: Set<string>;

    constructor(cowllector_: Wallet, vaultsArrayJsEndpoint_: string, harvesterAddress_: string, opsAddress_: string, vaultDenylist_: Set<string>) {
        this._cowllector = cowllector_;
        this._vaultsArrayJsEndpoint = vaultsArrayJsEndpoint_;
        this._harvesterAddress = harvesterAddress_;
        this._vaultDenylist = vaultDenylist_;
    }

    
}