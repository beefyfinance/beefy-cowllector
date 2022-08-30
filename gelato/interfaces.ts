import { IStratToHrvst, IChain as _IChain, IChains } from '../scripts/interfaces';
export { IStratToHrvst, IChains };

/*
export interface IStratToHrvst {
  id: string;
  chain: string;
  earnContractAddress: string; //i.e. the vault's contract address
  earnedToken: string;
  strategy: string;
  lastHarvest: number;
  noOnChainHrvst?: boolean;
  interval?: number;
} //interface IStratToHrvst 
*/
export interface IChain extends _IChain {
  readonly ochHarvester?: string;
  readonly ochOperations?: string;
}

export interface IChainOch extends IChain {
  readonly ochHarvester: string;
  readonly ochOperations: string;
}
