import { IStratToHarvest, IChain as _IChain, IChains } from '../scripts/interfaces';
export { IStratToHarvest, IChains };

/*
export interface IStratToHarvest {
  id: string;
  chain: string;
  earnContractAddress: string; //i.e. the vault's contract address
  earnedToken: string;
  strategy: string;
  lastHarvest: number;
  noOnChainHrvst?: boolean;
  interval?: number;
} //interface IStratToHarvest 
*/
export interface IChain extends _IChain {
  readonly addressHarvester?: string;
  readonly addressHarvesterOperations?: string;
}

export interface IChainHarvester extends IChain {
  readonly addressHarvester: string;
  readonly addressHarvesterOperations: string;
}
