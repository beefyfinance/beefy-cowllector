import {IStratToHarvest, IChain as _IChain, IChains} from '../scripts/interfaces';
export {IStratToHarvest, IChains};

export interface IChain extends _IChain {
  readonly addressHarvester?: string;
  readonly addressHarvesterOperations?: string;
}

export interface IChainHarvester extends IChain {
  readonly addressHarvester: string;
  readonly addressHarvesterOperations: string;
}
