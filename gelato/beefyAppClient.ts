const fetch = require("node-fetch")
import { MULTICHAIN_ENDPOINTS } from "./constants";
import { VaultConfig } from "./interfaces/VaultConfig";

export class BeefyAppClient {

    constructor() {}

    public async fetchVaultsForChain(chainName_: string): Promise<VaultConfig[]> {
        const response = await fetch((MULTICHAIN_ENDPOINTS as any)[chainName_]);
        if (response.ok && response.body) {
            const data = await response.text();
            let vaultJs = '[' + data.substring(data.indexOf('\n') + 1);
            const vaults: VaultConfig[] = eval(vaultJs);
            return vaults;
        } else {
            return [];
        }
    }
}