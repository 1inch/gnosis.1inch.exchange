import { BigNumber } from 'ethers/utils';

export interface GasPricePoaNetwork {
  health: boolean;
  'block_number': number;
  slow: number;
  standard: number;
  fast: number;
  instant: number;
  'block_time': number;
}

export interface GasPriceOneInch {
  health: boolean;
  'block_number': number;
  slow: number;
  standard: number;
  fast: number;
  instant: number;
  'block_time': number;
}

export interface GasPriceUpVest {
  success: boolean;
  updated: string;
  estimates: {
    fastest: number;
    fast: number;
    medium: number;
    slow: number;
  }
}

export interface GasPrice {
  success: boolean;
  fast: number;
  instant: number;
  standard: number;
  slow: number;
}

export interface GasPriceBN {
  fast: BigNumber;
  instant: BigNumber;
  standard: BigNumber;
}
