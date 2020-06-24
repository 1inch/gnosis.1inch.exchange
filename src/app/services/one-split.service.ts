import { Observable, of } from 'rxjs';
import { catchError, map, mergeMap, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { BigNumber, bigNumberify } from 'ethers/utils';
import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import OneSplitABI from '../abi/OneSplitABI.json';
import { Web3Service } from './web3.service';
import { zeroValueBN } from '../utils';

export type GetExpectedReturnResponse = {
  returnAmount: BigNumber,
  distribution: BigNumber[]
};

@Injectable({
  providedIn: 'root'
})
export class OneSplitService {

  constructor(
    private web3Service: Web3Service
  ) {
  }

  public getExpectedReturn(
    fromToken: string,
    toToken: string,
    amount: BigNumber,
    parts: BigNumber = bigNumberify(10),
    disableFlags: BigNumber = zeroValueBN,
    oneSplitAddress = environment.ONE_SPLIT_CONTRACT_ADDRESS,
    blockNumber?: number | 'latest'
  ): Observable<GetExpectedReturnResponse> {

    return this.getOneSplitInstance(oneSplitAddress).pipe(
      mergeMap((instance) => {

        const call$ = instance.methods.getExpectedReturn(
          fromToken,
          toToken,
          amount,
          parts,
          disableFlags
        ).call(null, blockNumber || 'latest');

        return fromPromise(call$) as Observable<any>;
      }),
      map(({ returnAmount, distribution }) => {

        return { returnAmount, distribution };
      }),
      catchError(() => {

        return of({
          returnAmount: zeroValueBN,
          distribution: []
        });
      }),
      take(1)
    );
  }

  private getOneSplitInstance(tokenAddress: string): Observable<any> {

    return this.web3Service.getInstance(
      OneSplitABI,
      tokenAddress
    );
  }
}
