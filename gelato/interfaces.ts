import { IStratToHrvst, IChain as _IChain, IChains } from '../scripts/interfaces';
export { IStratToHrvst, IChains };

export interface IChain extends _IChain {
  readonly ochHarvester?: string;
  readonly ochOperations?: string;
}

export interface IChainOch extends IChain {
  readonly ochHarvester: string;
  readonly ochOperations: string;
}
