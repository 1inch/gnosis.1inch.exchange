import { Injectable } from '@angular/core';
import { Web3Service } from './web3.service';
import TokenHelperABI from '../abi/TokenHelperABI.json';
import { environment } from '../../environments/environment';
import { ISymbol2Token } from './token.helper';
import { combineLatest, Observable } from 'rxjs';
import { map, mergeMap, tap } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { BigNumber } from 'ethers/utils';

export type TokenData = {
  usdBalances: BigNumber[];
  balances: BigNumber[];
}

@Injectable({
  providedIn: 'root'
})
export class TokenDataHelperService {

  constructor(
    private web3Service: Web3Service
  ) {
  }

  public getTokenBalancesAndPrices(
    userWalletAddress: string,
    tokens: ISymbol2Token
  ): Observable<TokenData> {
    const addresses = Object.keys(tokens).map(symbol => tokens[symbol].address);
    const result: TokenData = {
      usdBalances: [],
      balances: []
    };

    const step = Math.ceil(addresses.length / 4);
    let index = 0;
    const tokenHelperContract = this.getTokenHelperContract();
    const requests: Observable<any>[] = [];

    do {

      const addressesSlice = addresses.slice(index, index + step);
      const req$ = tokenHelperContract.pipe(
        mergeMap((instance) => {

          const call$ = instance.methods.balancesOfTokens(
            userWalletAddress,
            addressesSlice,
            environment.ONE_SPLIT_CONTRACT_ADDRESS
          ).call();

          return fromPromise(call$);
        }),
        tap((value: any) => {

          try {

            result.usdBalances = result.usdBalances.concat(...value.usdBalances);
            result.balances = result.balances.concat(...value.balances);
          } catch (e) {

            console.error(e);
          }
        })
      );

      requests.push(req$);
      index += step;
    } while (addresses.slice(index, index + step).length);

    return combineLatest(requests).pipe(
      map(() => result)
    );
  }

  private getTokenHelperContract() {

    return this.web3Service.getInstance(
      TokenHelperABI,
      environment.TOKEN_HELPER_CONTRACT_ADDRESS
    );
  }
}
