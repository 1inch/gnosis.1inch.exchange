import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { combineLatest, Observable } from 'rxjs';
import { map, timeout } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type Price = { usd: number };

export interface UsdPrice {
    [tokenAddress: string]: Price;
}

@Injectable({
    providedIn: 'root'
})
export class CoinGeckoService {

    private endpoint = 'https://api.coingecko.com/api/v3';
    private ethUsdPriceEndpoint = `${ this.endpoint }/simple/price?ids=ethereum&vs_currencies=usd`;

    constructor(
        private httpClient: HttpClient,
    ) {
    }

    public getUSDPrices(tokenAddresses: string[]): Observable<UsdPrice> {

        const ethAddr = environment.ETH_ADDRESS.toLowerCase();
        const ethIndex = tokenAddresses.indexOf(ethAddr);
        if (ethIndex === -1) {
            const url = this.endpoint + `/simple/token_price/ethereum?contract_addresses=${ tokenAddresses.join(',') }&vs_currencies=usd`;
            return this.httpClient.get<UsdPrice>(url).pipe(
                timeout(1000)
            );
        }

        if (tokenAddresses.length === 1) {
            return this.getEthUsdPrice();
        }

        const _tokenAddresses = tokenAddresses.filter((_, i) => i !== ethIndex);
        const url = this.endpoint + `/simple/token_price/ethereum?contract_addresses=${ _tokenAddresses.join(',') }&vs_currencies=usd`;
        const tokensReq$ = this.httpClient.get<UsdPrice>(url).pipe(
            timeout(1000)
        );
        const ethReq$ = this.getEthUsdPrice();
        return combineLatest([tokensReq$, ethReq$]).pipe(
            map(([tokensPrices, ethPrice]) => {
                tokensPrices[ethAddr] = ethPrice[ethAddr];
                return tokensPrices;
            })
        );
    }

    public getEthUsdPrice(): Observable<UsdPrice> {
        return this.httpClient.get(this.ethUsdPriceEndpoint).pipe(
            timeout(1000),
            map((price) => {
                const priceObj = {};
                const ethAddr = environment.ETH_ADDRESS.toLowerCase();
                priceObj[ethAddr] = price['ethereum'];
                return priceObj;
            })
        );
    }

    public getUSDPrice(tokenAddress: string): Observable<number | never> {

        const addr = tokenAddress.toLowerCase();

        return this.getUSDPrices([addr]).pipe(
            map((price: UsdPrice) => price[addr].usd)
        );
    }
}
