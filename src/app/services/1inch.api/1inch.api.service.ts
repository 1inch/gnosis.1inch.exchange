import { HttpClient, HttpParams } from '@angular/common/http';
import {delay, map, mergeMap, retryWhen, timeout} from 'rxjs/operators';
import { Observable, of, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import { exchanges, ISymbol2Token, Quote, SupportedExchanges, SwapData } from './1inch.api.dto';

@Injectable({
  providedIn: 'root'
})
export class OneInchApiService {

  private url = 'https://gnosis.api.enterprise.1inch.exchange/v3.0/1';

  constructor(private http: HttpClient) {
  }

  public getQuote$(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
  ): Observable<Quote> {

    let params = new HttpParams();
    params = params.append('fromTokenAddress', fromTokenAddress);
    params = params.append('toTokenAddress', toTokenAddress);
    params = params.append('amount', amount);

    const url = this.url + '/quote';

    return this.http.get<Quote>(url, { params }).pipe(
      delayedRetry(1000)
    );
  }

  public getSwapData$(
    fromTokenAddress: string,
    toTokenAddress: string,
    amount: string,
    fromWalletAddress: string,
    slippage = '1',
    disableEstimate = false,
  ): Observable<SwapData> {

    let params = new HttpParams();
    params = params.append('fromTokenAddress', fromTokenAddress);
    params = params.append('toTokenAddress', toTokenAddress);
    params = params.append('amount', amount);
    params = params.append('fromAddress', fromWalletAddress);
    params = params.append('slippage', slippage);
    params = params.append('disableEstimate', String(disableEstimate));

    const url = this.url + '/swap';

    return this.http.get<SwapData>(url, { params }).pipe(
      delayedRetry(1000)
    );
  }

  public getTokens$(): Observable<ISymbol2Token> {

    const url = this.url + '/tokens';

    return this.http.get<{tokens: ISymbol2Token}>(url).pipe(
        timeout(5000),
      delayedRetry(1000)
    ).pipe(
        map((x) => x.tokens)
    );
  }
}

const DEFAULT_MAX_RETRIES = 1;

function delayedRetry(delayMs: number, maxRetry = DEFAULT_MAX_RETRIES) {
  let retries = maxRetry;

  return (src: Observable<any>) =>
    src.pipe(
      retryWhen((errors: Observable<any>) => errors.pipe(
        delay(delayMs),
        mergeMap(error => retries-- > 0 ? of(error) : throwError(error))
      ))
    );
}
