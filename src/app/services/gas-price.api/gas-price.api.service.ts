import { HttpClient } from '@angular/common/http';
import { catchError, map, mergeMap, tap } from 'rxjs/operators';
import { BehaviorSubject, interval, Observable, of, timer } from 'rxjs';
import { Injectable } from '@angular/core';
import { GasPrice, GasPriceBN, GasPriceOneInch, GasPricePoaNetwork, GasPriceUpVest } from './gas-price.api.dto';
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
export class GasPriceApiService {

  private GAS_PRICE_URL = 'http://gas-price.1inch.exchange';
  private GAS_PRICE_URL2 = 'https://gasprice.poa.network';
  private GAS_PRICE_URL3 = 'https://fees.upvest.co/estimate_eth_fees';
  private CORS_PROXY_URL = 'https://corsproxy.1inch.exchange/';

  public gasPrice = new BehaviorSubject<GasPriceBN>({
    fast: new ethers.utils.BigNumber(Math.trunc(6 * 100)).mul(1e7),
    standard: new ethers.utils.BigNumber(Math.trunc(11 * 100)).mul(1e7),
    instant: new ethers.utils.BigNumber(Math.trunc(21 * 100)).mul(1e7)
  });

  constructor(private http: HttpClient) {
    timer(0, 30000).pipe(
      mergeMap(() => this.getGasPrice()),
      tap((gasPrice: GasPrice) => {

        const fast = formatGasPrice(gasPrice.fast);
        const instant = formatGasPrice(gasPrice.instant);
        const standard = formatGasPrice(gasPrice.standard);

        this.gasPrice.next({
          fast: ethers.utils.bigNumberify(Math.trunc(fast)),
          standard: ethers.utils.bigNumberify(Math.trunc(standard)),
          instant: ethers.utils.bigNumberify(Math.trunc(instant))
        });
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
