import { BigNumber, bigNumberify } from 'ethers/utils';

export const ethAddresses = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0x0000000000000000000000000000000000000000'
];

export function bnToNumberSafe(val: BigNumber): number {
  const hex = val.toHexString();
  return parseInt(hex, 16);
}

export const zeroValueBN = bigNumberify(0);
