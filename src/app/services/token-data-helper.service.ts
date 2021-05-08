import {Injectable} from '@angular/core';
import {decodeParameter, Web3Service} from './web3.service';
import PriceOracleABI from '../abi/PriceOracleABI.json';
import ERC20ABI from '../abi/ERC20ABI.json';
import {environment} from '../../environments/environment';
import {ISymbol2Token} from './token.helper';
import {combineLatest, Observable, of} from 'rxjs';
import {catchError, map, retry, take, tap} from 'rxjs/operators';
import {fromPromise} from 'rxjs/internal-compatibility';
import {BigNumber} from 'ethers/utils';
import {MultiCallService} from './multicall.service';
import {getNumerator} from './erc20.helper';
import {TokenPriceService} from './token-price.service';

export type TokenData = {
    usdBalances: BigNumber[];
    balances: BigNumber[];
};

@Injectable({
    providedIn: 'root'
})
export class TokenDataHelperService {

    private oracle = this.web3Service.getInstanceWithoutNetwork(PriceOracleABI);

    constructor(
        private web3Service: Web3Service,
        private multiCallService: MultiCallService,
        private tokenPriceService: TokenPriceService
    ) {
    }

    public getTokenBalancesAndPrices(
        userWalletAddress: string,
        tokens: ISymbol2Token
    ): Observable<TokenData> {

        const symbols = Object.keys(tokens);
        const addresses = symbols.map(symbol => tokens[symbol].address);
        const decimals = symbols.map(symbol => tokens[symbol].decimals);

        const token2decimals = {};
        // tslint:disable-next-line:forin
        for (const symbol in tokens) {
            token2decimals[tokens[symbol].address] = tokens[symbol].decimals;
        }

        const result: TokenData = {
            usdBalances: [],
            balances: []
        };

        const tokenBalances$ = fromPromise(this.getBalances(userWalletAddress, addresses));
        const tokenPrices$ = fromPromise(this.fetchTokenEthPricesFromOracle(addresses, decimals));

        return combineLatest([
            tokenBalances$,
            tokenPrices$,
            this.tokenPriceService.ethUsdPriceBN$
        ]).pipe(
            retry(3),
            tap(([balances, prices, ethUsdPrice]) => {
                // tslint:disable-next-line:forin
                for (const token in balances) {
                    const balance = new BigNumber(balances[token]);
                    const price = new BigNumber(prices[token]).mul(ethUsdPrice).div(getNumerator(18));
                    const cost = balance.mul(price).div(getNumerator(token2decimals[token]));
                    result.usdBalances.push(cost);
                    result.balances.push(balance);
                }
            }),
            map(() => result),
            catchError((e) => {
                console.log(e);
                return of({
                    usdBalances: [],
                    balances: []
                });
            }),
            take(1)
        );
    }

    private async getBalances(wallet: string, tokens: string[]): Promise<{ [token: string]: string }> {
        const balanceOfCallData = this.web3Service.getInstanceWithoutNetwork(ERC20ABI).methods.balanceOf(wallet).encodeABI();
        const callData = tokens.map((t) => ({
            to: t.toLowerCase() === environment.ETH_ADDRESS.toLowerCase() ? environment.ETH_BALANCE_CONTRACT : t,
            data: balanceOfCallData
        }));
        const res = await this.multiCallService.callWithBatchRetry(callData, 500);
        const token2balance = {};
        for (const [i, data] of res.entries()) {
            try {
                token2balance[tokens[i]] = decodeParameter('uint256', data).toString();
            } catch (e) {
                console.log(`cannot decode balances for ${tokens[i]}`);
                token2balance[tokens[i]] = '0';
            }
        }
        return token2balance;
    }

    public async fetchTokenEthPricesFromOracle(tokens: string[], decimals: number[]): Promise<{ [token: string]: string }> {
        return new Promise(async (resolve, reject) => {

            setTimeout(() => reject('prices timeout'), 50000);

            const tokenPrices = {};

            if (tokens.length === 0) {
                return tokenPrices;
            }

            const dataToCall = [];
            for (const [i, token] of tokens.entries()) {

                const callData = this.oracle.methods.getRate(
                    token,
                    '0x0000000000000000000000000000000000000000'
                ).encodeABI();

                dataToCall.push({
                    to: environment.PRICE_ORACLE_CONTRACT,
                    data: callData
                });
            }

            const response = await this.multiCallService.callWithBatchRetry(dataToCall, 20);
            for (const [i, res] of response.entries()) {
                try {
                    if (res.length > 66) {
                        tokenPrices[tokens[i]] = '0';
                        continue;
                    }
                    const x = new BigNumber(decodeParameter('uint256', res).toString());
                    tokenPrices[tokens[i]] = x.mul(getNumerator(decimals[i])).div(getNumerator(18)).toString();
                } catch (e) {
                    tokenPrices[tokens[i]] = '0';
                    // console.log(e.toString());
                    console.log('failed to fetch price for', tokens[i], 'res:', res);
                }
            }
            resolve(tokenPrices);
        });
    }
}
