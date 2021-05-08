import { Observable, of } from 'rxjs';
import { catchError, map, mergeMap, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { BigNumber } from 'ethers/utils';
import ERC20ABI from '../abi/ERC20ABI.json';
import { Web3Service } from './web3.service';
import { ethAddresses, zeroValueBN } from '../utils';

export const TokenBalanceABI = [{
  internalType: 'uint256',
  name: 'balanceOf',
  type: 'uint256'
}];

export class Erc20Helper {

  private erc20InstanceWithoutNetwork = this.web3Service.getInstanceWithoutNetwork(ERC20ABI);

  constructor(
    protected web3Service: Web3Service
  ) {
  }

  public isTokenApproved(
    tokenAddress: string,
    walletAddress: string,
    spender: string,
    amount: BigNumber
  ): Observable<boolean> {

    if (ethAddresses.indexOf(tokenAddress) !== -1) {

      return of(true);
    }

    return this.getApprovedAmount(
      tokenAddress,
      walletAddress,
      spender
    ).pipe(
      map((approvedAmount) => approvedAmount.gte(amount)),
      take(1)
    );
  }

  public getApprovedAmount(
    contractAddress: string,
    walletAddress: string,
    spender: string,
    blockNumber?: number
  ): Observable<BigNumber> {

    return this.getERC20Instance(contractAddress).pipe(
      mergeMap((instance) => {

        const call$ = instance.methods.allowance(
          walletAddress,
          spender
        ).call(null, blockNumber || 'pending')
          .then((x) => {

            return x !== null ? x : zeroValueBN;
          });

        return fromPromise(call$) as Observable<BigNumber>;
      }),
      catchError(() => {

        return of(zeroValueBN);
      }),
      take(1)
    );
  }

  protected getErc20Balance(
    contractAddress: string,
    walletAddress: string,
    blockNumber?: number
  ): Observable<BigNumber> {

    return this.getERC20Instance(contractAddress).pipe(
      mergeMap((instance) => {

        const call$ = instance.methods.balanceOf(walletAddress).call(null, blockNumber || 'latest')
          .then((x) => {

            return x !== null ? x : zeroValueBN;
          });

        return fromPromise(call$) as Observable<BigNumber>;
      }),
      catchError(() => {

        return of(zeroValueBN);
      }),
      take(1)
    );
  }

  public getTokenBalanceCallData(walletAddress: string): string {

    return this.erc20InstanceWithoutNetwork.methods.balanceOf(walletAddress).encodeABI();
  }

  public getApproveCallData(spender: string, amount: BigNumber): string {

    return this.erc20InstanceWithoutNetwork.methods.approve(spender, amount).encodeABI();
  }

  public getERC20Instance(tokenAddress: string): Observable<any> {

    return this.web3Service.getInstance(
      ERC20ABI,
      tokenAddress
    );
  }
}

const numerators = {};
export function getNumerator(exp: number): BigNumber {
    if (!numerators[exp.toString()]) {
        numerators[exp.toString()] = new BigNumber(10).pow(exp);
    }
    return numerators[exp.toString()];
}
