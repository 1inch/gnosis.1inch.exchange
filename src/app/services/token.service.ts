import { Injectable } from '@angular/core';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { ISymbol2Token, ITokenDescriptor, TokenHelper } from './token.helper';
import { OneInchApiService } from './1inch.api/1inch.api.service';
import { delay, map, mergeMap, repeatWhen, shareReplay, tap } from 'rxjs/operators';
import { TokenData, TokenDataHelperService } from './token-data-helper.service';
import { zeroValueBN } from '../utils';
import { BigNumber } from 'ethers/utils';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  private subscription = new Subscription();

  public tokenHelper$: Observable<TokenHelper> = this.oneInchApiService.getTokens$()
    .pipe(
      map((tokens: ISymbol2Token) => new TokenHelper(tokens)),
      shareReplay({ bufferSize: 1, refCount: true }),
    );

  private tokens$ = this.tokenHelper$.pipe(
    map((tokenHelper) => tokenHelper.tokens),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  private tokenBalancesAndPricesUpdate$: Observable<TokenData>;

  private tokenData$: Observable<TokenData>;

  private usdFormatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  });

  constructor(
    private oneInchApiService: OneInchApiService,
    private tokenDataHelperService: TokenDataHelperService
  ) {
  }

  public getSortedTokens(walletAddress: string): Observable<ITokenDescriptor[]> {

    if (!this.tokenData$) {
      const tokenData$ = this.tokens$.pipe(
        mergeMap((symbols2Tokens: ISymbol2Token) => {

          return this.tokenDataHelperService.getTokenBalancesAndPrices(
            walletAddress,
            symbols2Tokens
          );
        }),
      );

      this.tokenData$ = tokenData$.pipe(
        shareReplay({ bufferSize: 1, refCount: true })
      );

      const update$ = combineLatest([this.tokenHelper$, this.tokens$, tokenData$]).pipe(
        tap(([tokenHelper, symbols2Tokens, tokenData]) => {
          this.assignPricesAndBalances2Tokens(tokenHelper, symbols2Tokens, tokenData);
        }),
        repeatWhen((completed) => completed.pipe(delay(20000)))
      );

      this.subscription.add(update$.subscribe());
    }

    return combineLatest([this.tokenHelper$, this.tokens$, this.tokenData$]).pipe(
      map(([tokenHelper, symbols2Tokens, tokenData]) => {
        return this.sortTokens(tokenHelper, tokenData, symbols2Tokens);
      })
    );
  }

  private sortTokens(
    tokenHelper: TokenHelper,
    tokenData: TokenData,
    symbols2Tokens: ISymbol2Token,
  ): ITokenDescriptor[] {

    this.assignPricesAndBalances2Tokens(tokenHelper, symbols2Tokens, tokenData);
    return Object.values(symbols2Tokens).sort(sortSearchResults);
  }

  private assignPricesAndBalances2Tokens(
    tokenHelper: TokenHelper,
    tokens: ISymbol2Token,
    tokenData: TokenData
  ): void {

    const symbols = Object.keys(tokens);

    const { balances, usdBalances } = tokenData;

    for (let i = 0; i < balances.length; i++) {

      const token = tokens[symbols[i]];
      const balance = balances[i];
      const usdBalance = usdBalances[i];

      if (!token || !balance) {
        console.log(tokens[i].symbol);
        continue;
      }

      token.balance = balance;
      const formattedTokenBalance = tokenHelper.formatAsset(
        token.symbol,
        token.balance as BigNumber
      );
      token.formatedTokenBalance = tokenHelper.toFixedSafe(
        formattedTokenBalance,
        token.decimals
      );

      if (usdBalance.isZero()) {
        token.usdBalance = 0;
        token.formatedUSDBalance = 0;
        continue;
      }

      token.usdBalance = +tokenHelper.formatUnits(usdBalance, 8);
      token.formatedUSDBalance = this.usdFormatter.format(token.usdBalance);
    }
  }

}

function sortSearchResults(firstEl: ITokenDescriptor, secondEl: ITokenDescriptor) {

  if (!firstEl.usdBalance) {
    firstEl.usdBalance = 0;
  }

  if (!secondEl.usdBalance) {
    secondEl.usdBalance = 0;
  }

  if (!firstEl.balance) {
    firstEl.balance = zeroValueBN;
  }

  if (!secondEl.balance) {
    secondEl.balance = zeroValueBN;
  }

  if (Number(firstEl.usdBalance) > Number(secondEl.usdBalance)) {

    return -1;
  }

  if (Number(firstEl.usdBalance) < Number(secondEl.usdBalance)) {

    return 1;
  }

  return 0;
}
