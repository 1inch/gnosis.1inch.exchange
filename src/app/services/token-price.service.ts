import {Injectable} from '@angular/core';
import {combineLatest, Observable} from 'rxjs';
import {BigNumber, parseUnits} from 'ethers/utils';
import {catchError, map, mergeMap, retry, shareReplay, switchMap} from 'rxjs/operators';
import {fromPromise} from 'rxjs/internal-compatibility';
import {environment} from '../../environments/environment';
import {Web3Service} from './web3.service';
import ChainLinkDaiUsdAggregatorABI from '../abi/ChainLinkDaiUsdAggregatorABI.json';
import {RefreshingReplaySubject} from '../utils';
import {CoinGeckoService} from './coin-gecko.service';
import OracleABI from '../abi/PriceOracleABI.json';
import {getNumerator} from './erc20.helper';

type UsdPriceCache = { [tokenAddress: string]: RefreshingReplaySubject<BigNumber> };

@Injectable({
    providedIn: 'root'
})
export class TokenPriceService {

    private usdPriceCache$: UsdPriceCache = {};

    public ethUsdPriceBN$: Observable<BigNumber> = this.getChainLinkAggregatorInstance(
        environment.ETH_USD_CHAINLINK_ORACLE_CONTRACT_ADDRESS
    ).pipe(
        mergeMap((instance) => {

            // @ts-ignore
            const call$ = instance.methods.latestAnswer().call();
            return fromPromise(call$) as Observable<BigNumber>;
        }),
        retry(5),
        shareReplay({bufferSize: 1, refCount: true})
    );

    constructor(
        private web3Service: Web3Service,
        private coinGeckoService: CoinGeckoService
    ) {
    }

    public getUsdTokenPrice(
        tokenAddress: string,
        tokenDecimals: number,
        blockNumber?: number | 'latest',
    ): Observable<BigNumber> {

        if (this.usdPriceCache$[tokenAddress]) {
            return this.usdPriceCache$[tokenAddress];
        }

        const tokenPrice$ = this.getTokenPriceBN(
            tokenAddress,
            tokenDecimals,
            blockNumber,
        );

        this.usdPriceCache$[tokenAddress] = new RefreshingReplaySubject<BigNumber>(
            () => tokenPrice$,
            10000
        );

        return this.usdPriceCache$[tokenAddress];
    }

    public getTokenPriceBN(
        tokenAddress: string,
        tokenDecimals: number,
        blockNumber?: number | 'latest',
        useOffChain = true
    ): Observable<BigNumber> {

        const onChainPrice$ = combineLatest([
            this.ethUsdPriceBN$,
            this.getEthTokenPriceFromOracle(tokenAddress, tokenDecimals)
        ]).pipe(
          map(([ethUsdPrice, ethPrice]) => {
              return ethPrice.mul(ethUsdPrice).div(getNumerator(18));
          })
        );

        if (!useOffChain) {
            return onChainPrice$;
        }

        const offChainPrice$ = this.coinGeckoService.getUSDPrice(tokenAddress).pipe(
            map((price: number) => parseUnits(String(price), 8)),
        );

        return offChainPrice$.pipe(
            catchError(() => onChainPrice$)
        );
    }

    private getEthTokenPriceFromOracle(tokenAddress: string, decimals: number): Observable<BigNumber> {
        return this.web3Service.getInstance(OracleABI, environment.PRICE_ORACLE_CONTRACT).pipe(
            switchMap((instance) => {
                const call$ = instance.methods.getRate(
                    tokenAddress,
                    '0x0000000000000000000000000000000000000000'
                ).call();
                return fromPromise(call$);
            }),
            map((res: BigNumber) => {
                return res.mul(getNumerator(decimals)).div(getNumerator(18));
            })
        );
    }

    private getChainLinkAggregatorInstance(aggregatorAddress: string) {
        return this.web3Service.getInstance(
            ChainLinkDaiUsdAggregatorABI,
            aggregatorAddress
        );
    }
}
