import { Injectable } from '@angular/core';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { catchError, map, mergeMap, reduce, tap } from 'rxjs/operators';
import BestPricePathABI from '../abi/BestPricePathABI.json';
import { ethers } from 'ethers';
import { fromPromise } from 'rxjs/internal-compatibility';
import { Web3Service } from './web3.service';
import { environment } from '../../environments/environment';

export type MultiCallResponse = {
  result: any | null,
  success: boolean,
  id: string
};

function parseResults(
  abiList: any[][],
  idList: string[]
): (results: MultiCallResponse[]) => MultiCallResponse[] {

  return (results: MultiCallResponse[]) => {

    return results.map((res, i) => {

      if (!res.success) {

        return {
          id: idList ? idList[i] : undefined,
          result: null,
          success: false
        };
      }

      try {

        return {
          id: idList ? idList[i] : undefined,
          result: ethers.utils.defaultAbiCoder.decode(abiList[i], res.result),
          success: true
        };
      } catch (e) {

        return {
          id: idList ? idList[i] : undefined,
          result: null,
          success: false
        };
      }
    });
  };
}

@Injectable({
  providedIn: 'root'
})
export class MultiCallService {

  constructor(
    private web3Service: Web3Service,
  ) {
  }

  public shardedMultiCall(
    shardSize: number,
    targetAddressList: string[],
    callDataList: string[],
    abiList: any[][],
    idList?: string[],
    instantResponse = true,
  ): Observable<MultiCallResponse[]> {

    const shardedCalls$: Observable<any>[] = [];
    for (let i = 0; i < targetAddressList.length; i += shardSize) {

      const targetsShard = targetAddressList.slice(
        i,
        Math.min(i + shardSize, targetAddressList.length)
      );

      const callDataShard = callDataList.slice(
        i,
        Math.min(i + shardSize, targetAddressList.length)
      );

      const call$ = this.multiCall(targetsShard, callDataShard);
      shardedCalls$.push(call$);
    }

    if (instantResponse) {

      return this.shardedCallInstantResponse(shardedCalls$, abiList, idList);
    }

    return this.shardedCallCombinedResponse(shardedCalls$, abiList, idList);
  }

  private shardedCallCombinedResponse(
    shardedCalls$: Observable<any>[],
    abiList: any[][],
    idList?: string[]
  ): Observable<MultiCallResponse[]> {

    return combineLatest(shardedCalls$).pipe(
      map((results: any) => {

        return results.map((val) => {

          return val.results.map((res, i) => ({
              result: res,
              success: val.successes[i]
            })
          );
        });
      }),
      reduce((acc: MultiCallResponse[], val: MultiCallResponse[]) => {

        return acc.concat(...val);
      }, []),
      map(parseResults(abiList, idList))
    );
  }

  private shardedCallInstantResponse(
    shardedCalls$: Observable<any>[],
    abiList: any[][],
    idList?: string[]
  ): Observable<MultiCallResponse[]> {

    return merge(...shardedCalls$).pipe(
      map((val: any) => {

        return val.results.map((res, i) => {

          return {
            result: res,
            success: val.successes[i]
          };

        });
      }),
      map(parseResults(abiList, idList))
    );
  }

  private multiCall(
    targetAddressList: string[],
    callDataList: string[]
  ): Observable<any> {

    return this.getBestPriceInstance(
      environment.BEST_PRICE_PATH_SMART_CONTRACT_ADDRESS
    ).pipe(
      mergeMap((instance) => {

        const call$ = instance.methods.multicall(
          targetAddressList,
          callDataList
        ).call(null, 'latest');

        return fromPromise(call$);
      }),
      tap((res) => {

        if (!res) {
          throw new Error('no response');
        }
      }),
      catchError((e) => {

        console.log(e);
        return of({ results: [] }, { successes: [] });
      })
    );
  }

  private getBestPriceInstance(tokenAddress: string): Observable<any> {

    return this.web3Service.getInstance(
      BestPricePathABI,
      tokenAddress
    );
  }

}
