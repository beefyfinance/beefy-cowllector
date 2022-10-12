export interface IVault {
  readonly id: string;
  readonly name: string;
  readonly token: string;
  readonly tokenAddress: string;
  readonly tokenDecimals: number;
  readonly earnedToken: string;
  readonly earnedTokenAddress: string;
  readonly earnContractAddress: string;
  readonly oracle: string;
  readonly oracleId: string;
  readonly platformId: string;
  readonly chain: string;
  readonly assets: string[];
  readonly pricePerFullShare: number;
  readonly status: 'active' | 'paused' | 'eol';
  readonly retireReason?: 'upgrade' | 'rewards';
  readonly strategyTypeId: string;
  readonly strategy: string;
  readonly lastHarvest: number;
} //interface IVault

export interface IStratToHarvest {
  id: string;
  chain: string;
  earnContractAddress: string; //i.e. the vault's contract address
  earnedToken: string;
  strategy: string;
  lastHarvest: number;
  noOnChainHarvest?: boolean;
  gasLimit?: number;
  gasLimitStrategy?: string;
  suppressCallRewardCheck?: boolean;
  interval?: number;
} //interface IStratToHarvest 

export interface IChain {
  readonly id: string;
  readonly chainId: number;
  readonly rpc: string;
  readonly hasOnChainHarvesting?: boolean;
} //interface IChain

export interface IChains {
  readonly [chain: number]: IChain;
} //interface IChains
