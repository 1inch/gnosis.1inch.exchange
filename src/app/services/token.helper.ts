import {ethers} from 'ethers';
import {BigNumber} from 'ethers/utils';

export interface ITokenDescriptor {
    symbol: string;
    name: string;
    address: string;
    decimals: number;
    balance?: BigNumber;
    logoURI?: string;
    usdBalance?: number;
    // TODO: fix typos server side
    formatedUSDBalance?: string | number;
    formatedTokenBalance?: string;
}

export interface ISymbol2Token {
    [symbol: string]: ITokenDescriptor;
}

export interface IAddress2Token {
    [address: string]: ITokenDescriptor;
}

export class TokenHelper {

    // Symbol -> TokenDescriptor mapping
    public readonly tokens: Readonly<ISymbol2Token>;

    private re = {
        18: new RegExp('^-?\\d+(?:\.\\d{0,18})?'),
        8: new RegExp('^-?\\d+(?:\.\\d{0,8})?'),
        6: new RegExp('^-?\\d+(?:\.\\d{0,6})?'),
        2: new RegExp('^-?\\d+(?:\.\\d{0,2})?')
    };

    constructor(
        tokens: IAddress2Token
    ) {
        const x: ISymbol2Token = {};
        for (const address in tokens) {
            x[tokens[address].symbol] = tokens[address];
        }
        this.tokens = x;
    }

    public parseAsset(symbol: string, amount): BigNumber {

        if (symbol === 'ETH') {
            return ethers.utils.parseEther(this.toFixedSafe(amount, 18));
        }

        const token = this.tokens[symbol];
        return ethers.utils.parseUnits(this.toFixedSafe(amount, token.decimals), token.decimals);
    }

    public parseUnits(amount, decimals): BigNumber {
        const fixed = this.toFixedSafe(amount, decimals);
        return ethers.utils.parseUnits(fixed, decimals);
    }

    public toFixed(num, fixed): string {

        if (!this.re[fixed]) {

            this.re[fixed] = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
        }

        return num.toString().match(this.re[fixed])[0];
    }

    public parseAssetSafe(symbol: string, amount): BigNumber {

        if (symbol === 'ETH') {
            return ethers.utils.parseEther(this.toFixedSafe(amount, 18));
        }

        const token = this.tokens[symbol];
        return ethers.utils.parseUnits(this.toFixedSafe(amount, token.decimals), token.decimals);
    }

    public toFixedSafe(num, fixed): string {

        if (!this.re[fixed]) {

            this.re[fixed] = new RegExp('^-?\\d+(?:\.\\d{0,' + (fixed || -1) + '})?');
        }

        const x = num.toString().match(this.re[fixed]);
        if (x?.length) {
            return x[0];
        }

        return '0';
    }

    public parseUnitsSafe(amount, decimals): BigNumber {
        const fixed = this.toFixedSafe(amount, decimals);
        return ethers.utils.parseUnits(fixed, decimals);
    }

    public getTokenByAddress(address: string): ITokenDescriptor {
        const symbols = Object.keys(this.tokens);
        const indexOfTokenSymbol = symbols.findIndex((symbol) => (
            this.tokens[symbol]?.address?.toLowerCase() === address?.toLowerCase())
        );
        const tokenSymbol = symbols[indexOfTokenSymbol];
        return this.tokens[tokenSymbol];
    }

    public getTokenBySymbol(symbol: string): ITokenDescriptor {
        return this.tokens[symbol];
    }

    public formatAsset(symbol: string, amount: BigNumber): string {

        if (symbol === 'ETH' || symbol === 'WETH') {
            return this.formatUnits(amount, 18);
        }

        const token = this.tokens[symbol];

        if (!token || !token.decimals) {
            return amount.toString();
        }

        return this.formatUnits(amount, token.decimals);
    }

    public formatUnits(value: BigNumber | string, decimals: number): string {

        const result = value.toString();

        if (!result || result === '0') {

            return '0';
        }

        const zeros = '000000000000000000000000000000000000000000000000000000000000000000000000';

        let start = '';
        let end = '';

        if (result.length > decimals) {

            start = result.slice(0, result.length - decimals);
            end = result.slice(result.length - decimals);

        } else {

            start = '0';
            end = zeros.slice(0, decimals - result.length) + result;
        }

        for (let i = end.length - 1; i >= 0; i--) {

            if (end[i] !== '0') {
                end = end.substr(0, i + 1);
                break;
            }

            // tslint:disable-next-line:triple-equals
            if (i == 0) {
                end = '';
            }
        }

        return start + (end.length ? '.' : '') + end;
    }

    public toPrecision(
        amount: string | number,
        precision: number
    ): string {

        return Number(amount).toFixed(precision)
            .replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');
    }
}
