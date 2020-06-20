import { HttpClient, HttpParams } from '@angular/common/http';
import { delay, mergeMap, retryWhen } from 'rxjs/operators';
import { Observable, of, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import { exchanges, Quote, SupportedExchanges, SwapData } from './1inch.api.dto';

@Injectable({
  providedIn: 'root'
})
export class OneInchApiService {

  constructor(private http: HttpClient) {
  }

  public getQuote$(
    fromTokenSymbol: string,
    toTokenSymbol: string,
    amount: string,
    disabledExchangesList: SupportedExchanges[] = []
  ): Observable<Quote> {

    const disableExList = disabledExchangesList.map((i) => exchanges[i]).join(',');

    let params = new HttpParams();
    params = params.append('fromTokenSymbol', fromTokenSymbol);
    params = params.append('toTokenSymbol', toTokenSymbol);
    params = params.append('amount', amount);
    if (disabledExchangesList.length !== 0) {
      params = params.append('disabledExchangesList', disableExList);
    }

    const url = 'https://api.1inch.exchange/v1.1/quote';

    return this.http.get<Quote>(url, { params }).pipe(
      delayedRetry(1000)
    );
  }

  public getSwapData$(
    fromTokenSymbol: string,
    toTokenSymbol: string,
    amount: string,
    fromWalletAddress: string,
    slippage = '1',
    disableEstimate = false
  ): Observable<SwapData> {

    let params = new HttpParams();
    params = params.append('fromTokenSymbol', fromTokenSymbol);
    params = params.append('toTokenSymbol', toTokenSymbol);
    params = params.append('amount', amount);
    params = params.append('fromAddress', fromWalletAddress);
    params = params.append('slippage', slippage);
    params = params.append('disableEstimate', String(disableEstimate));

    const url = 'https://api.1inch.exchange/v1.1/swap';

    return this.http.get<SwapData>(url, { params }).pipe(
      delayedRetry(1000)
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
