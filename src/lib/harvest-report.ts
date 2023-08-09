import { BeefyVault } from '../types/vault';

export type HarvestReport = {
    startedAt: Date;
    endedAt: Date;
    items: HarvestReportItem[];
};

export type HarvestReportItem = {
    vault: BeefyVault;
    callReward: {
        amount: BigInt;
        success: boolean;
    };
    harvest: {
        success: boolean;
        multicallId: number;
        startedAt: Date;
        endedAt: Date;
    };
};
