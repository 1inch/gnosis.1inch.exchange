import { Injectable } from '@angular/core';
import { combineLatest, Observable, of, throwError } from 'rxjs';
import { BigNumber, bigNumberify } from 'ethers/utils';
import { catchError, map, mergeMap, retry, shareReplay, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { OneSplitService } from './one-split.service';
import { environment } from '../../environments/environment';
import { Web3Service } from './web3.service';

import ChainLinkDaiUsdAggregatorABI from '../abi/ChainLinkDaiUsdAggregatorABI.json';
import TokenHelperABI from '../abi/TokenHelperABI.json';

const DAI_ADDRESS = '0x6B175474E89094C44Da98b954EedeAC495271d0F';
const SAI_ADDRESS = '0x89d24a6b4ccb1b6faa2625fe562bdd9a23260359';

@Injectable({
  providedIn: 'root'
})
export class TokenPriceService {

  private daiUsdPriceBN$: Observable<BigNumber> = this.getChainLinkAggregatorInstance(
    environment.DAI_USD_CHAINLINK_ORACLE_CONTRACT_ADDRESS
  ).pipe(
    mergeMap((instance) => {

      // @ts-ignore
      const call$ = instance.methods.latestAnswer().call();
      return fromPromise(call$) as Observable<BigNumber>;
    }),
    retry(5),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor(
    private oneSplitService: OneSplitService,
    private web3Service: Web3Service
  ) {
  }

  public getTokenPriceBN(
    tokenAddress: string,
    tokenDecimals: number,
    blockNumber?: number | 'latest',
    oneSplitAddress = environment.ONE_SPLIT_CONTRACT_ADDRESS
  ): Observable<BigNumber> {

    return this.getTokenPriceFromHelper(
      tokenAddress,
      tokenDecimals,
      blockNumber,
      oneSplitAddress
    ).pipe(
      mergeMap((price: BigNumber) => {

        if (price.eq(0)) {
          return throwError('try fetch price directly from OneSplit');
        }

        return of(price);
      }),
      catchError(() => {

        return this.getTokenOneSplitPrice(
          tokenAddress,
          tokenDecimals,
          blockNumber,
          oneSplitAddress
        );
      })
    );
  }

  public getTokenOneSplitPrice(
    tokenAddress: string,
    tokenDecimals: number,
    blockNumber?: number | 'latest',
    oneSplitAddress = environment.ONE_SPLIT_CONTRACT_ADDRESS
  ): Observable<BigNumber> {

    if (tokenAddress === DAI_ADDRESS || tokenAddress === SAI_ADDRESS) {
      return of(bigNumberify(10).pow(8));
    }

    const daiUsdPriceBN$ = this.daiUsdPriceBN$;

    const oneSplitReturn$ = this.oneSplitService.getExpectedReturn(
      DAI_ADDRESS,
      tokenAddress,
      bigNumberify(10).pow(18),
      bigNumberify(10),
      bigNumberify(0),
      oneSplitAddress,
      blockNumber
    );

    return combineLatest([oneSplitReturn$, daiUsdPriceBN$]).pipe(
      map(([{ returnAmount }, daiUsdPriceBN]) => {

        const nominator = bigNumberify(10).pow(tokenDecimals);
        const nominator2 = bigNumberify(10).pow(8);
        const precision = 1e8;

        return nominator.mul(precision).mul(daiUsdPriceBN).div(returnAmount).div(nominator2);
      }),
      catchError(() => {

        return of(bigNumberify(0));
      }),
      take(1)
    );
  }

  public getTokenPriceFromHelper(
    tokenAddress: string,
    tokenDecimals: number,
    blockNumber?: number | 'latest',
    oneSplitAddress = environment.ONE_SPLIT_CONTRACT_ADDRESS
  ): Observable<BigNumber> {

    const nominator = bigNumberify(10).pow(tokenDecimals);

    return this.getTokenHelperInstance().pipe(
      mergeMap((instance) => {

        const call$ = instance.methods.getTokenUSDValue(
          tokenAddress,
          nominator,
          oneSplitAddress
        ).call(null, blockNumber || 'latest');

        return fromPromise(call$) as Observable<BigNumber>;
      })
    );
  }

  private getTokenHelperInstance() {

    return this.web3Service.getInstance(
      TokenHelperABI,
      environment.ONE_SPLIT_CONTRACT_ADDRESS
    );
  }

  private getChainLinkAggregatorInstance(aggregatorAddress: string) {

    return this.web3Service.getInstance(
      ChainLinkDaiUsdAggregatorABI,
      aggregatorAddress
    );
  }
}
