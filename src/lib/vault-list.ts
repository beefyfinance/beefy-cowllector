import axios from 'axios';
import { Chain } from '../types/chain';
import { BeefyVault } from '../types/vault';
import { BEEFY_API_URL, RPC_CONFIG } from '../util/config';

type ApiBeefyVault = {
    id: string;
    name: string;
    status: 'eol' | 'active';
    strategy: string;
    chain: Chain;
    // + some other fields we don't care about
};

export async function getVaultsToMonitor(): Promise<BeefyVault[]> {
    const response = await axios.get<ApiBeefyVault[]>(`${BEEFY_API_URL}/vaults`);
    const vaults = response.data;

    // map to a simpler format
    return (
        vaults
            .map(vault => ({
                id: vault.id,
                eol: vault.status === 'eol',
                chain: vault.chain,
                strategy_address: vault.strategy,
            }))
            // remove eol vaults
            .filter(vault => !vault.eol)
            // remove eol chains
            .filter(vault => RPC_CONFIG[vault.chain].eol === false)
    );
}
