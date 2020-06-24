import { HttpClient } from '@angular/common/http';
import { catchError, delay, map, mergeMap, retryWhen, tap } from 'rxjs/operators';
import { interval, Observable, of, throwError } from 'rxjs';
import { Injectable } from '@angular/core';
import { GasPrice, GasPriceOneInch, GasPricePoaNetwork, GasPriceUpVest } from './gas-price.api.dto';
import { ethers } from 'ethers';

const badResponse = {
  success: false,
  fast: 0,
  instant: 0,
  standard: 0,
  slow: 0
};

@Injectable({
  providedIn: 'root'
})
export class OneInchApiService {

  private GAS_PRICE_URL = 'http://gas-price.1inch.exchange';
  private GAS_PRICE_URL2 = 'https://gasprice.poa.network';
  private GAS_PRICE_URL3 = 'https://fees.upvest.co/estimate_eth_fees';
  private CORS_PROXY_URL = 'https://corsproxy.1inch.exchange/';

  public fastGasPrice = new ethers.utils.BigNumber(Math.trunc(6 * 100)).mul(1e7);
  public standardGasPrice = new ethers.utils.BigNumber(Math.trunc(11 * 100)).mul(1e7);
  public instantGasPrice = new ethers.utils.BigNumber(Math.trunc(21 * 100)).mul(1e7);

  constructor(private http: HttpClient) {
    interval(30000).pipe(
      mergeMap(() => this.getGasPrice()),
      tap((gasPrice: GasPrice) => {

        const fast = formatGasPrice(gasPrice.fast);
        const instant = formatGasPrice(gasPrice.instant);
        const standard = formatGasPrice(gasPrice.standard);

        this.fastGasPrice = ethers.utils.bigNumberify(Math.trunc(fast));
        this.standardGasPrice = ethers.utils.bigNumberify(Math.trunc(standard));
        this.instantGasPrice = ethers.utils.bigNumberify(Math.trunc(instant));

      })
    ).subscribe();
  }

  private getGasPrice(): Observable<GasPrice> {

    const upVest$ = this.getGasPriceUpVest$();
    const oneInch$ = this.getGasPriceOneInch$();
    const poa$ = this.getGasPricePoa$();

    return upVest$.pipe(
      mergeMap((data: GasPrice) => {

        if (data.success) {
          return of(data);
        }

        return oneInch$.pipe(
          mergeMap((oneInchData: GasPrice) => (
            data.success ? of(oneInchData) : poa$
          ))
        );
      })
    );
  }

  private getGasPriceOneInch$(): Observable<GasPrice> {
    return this.http.get<GasPriceOneInch>(this.CORS_PROXY_URL + this.GAS_PRICE_URL).pipe(
      map((data: GasPriceOneInch) => {

        if (!data.health) {
          return { ...badResponse };
        }
        return {
          success: true,
          fast: data.fast,
          instant: data.instant,
          standard: data.standard,
          slow: data.slow
        };
      }),
      catchError(() => of({ ...badResponse }))
    );
  }

  private getGasPricePoa$(): Observable<GasPrice> {
    return this.http.get<GasPricePoaNetwork>(this.GAS_PRICE_URL2).pipe(
      map((data: GasPricePoaNetwork) => {

        if (!data.health) {
          return { ...badResponse };
        }
        return {
          success: true,
          fast: data.fast,
          instant: data.instant,
          standard: data.standard,
          slow: data.slow
        };
      }),
      catchError(() => of({ ...badResponse }))
    );
  }

  private getGasPriceUpVest$(): Observable<GasPrice> {
    return this.http.get<GasPriceUpVest>(this.CORS_PROXY_URL + this.GAS_PRICE_URL3).pipe(
      map((data: GasPriceUpVest) => {

        if (!data.success) {
          return { ...badResponse };
        }
        return {
          success: true,
          fast: data.estimates.fast,
          instant: data.estimates.fastest,
          standard: data.estimates.medium,
          slow: data.estimates.slow
        };
      }),
      catchError(() => of({ ...badResponse }))
    );
  }
}

function formatGasPrice(gasPrice: number): number {
  return gasPrice * 100 * 1e9 / 100;
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
