import axios from 'axios';
import { Chain } from '../types/chain';
import { BeefyVault } from '../types/vault';
import { BEEFY_API_URL, RPC_CONFIG } from '../util/config';
import { rootLogger } from '../util/logger';
import { Hex } from 'viem';

const logger = rootLogger.child({ module: 'vault-list' });

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
    const rawVaults = response.data;

    // map to a simpler format
    const vaults = rawVaults
        .map(vault => ({
            id: vault.id,
            eol: vault.status === 'eol',
            chain: vault.chain,
            strategy_address: vault.strategy as Hex,
        }))
        // remove eol vaults
        .filter(vault => !vault.eol)
        // remove eol chains
        .filter(vault => RPC_CONFIG[vault.chain].eol === false);

    logger.trace({ msg: 'Got these vaults from beefy api', data: vaults });
    logger.info({ msg: 'Got vaults from api', data: { vaultLength: vaults.length } });
    return vaults;
}
