import { Chain } from './chain';

export type BeefyVault = {
    id: string;
    eol: boolean;
    chain: Chain;
    strategy_address: string;
};
