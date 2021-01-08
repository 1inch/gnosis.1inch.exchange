export interface Token {
    symbol: string;
    name: string;
    decimals: number;
    address: string;
    logoURI: string;
}

export interface ISymbol2Token {
    [symbol: string]: Token;
}

export interface Exchange {
    name: string;
    part: number;
}

export interface Quote {
    fromToken: Token;
    toToken: Token;
    toTokenAmount: string;
    fromTokenAmount: string;
    protocols: any[][][];
    estimatedGas: number;
}

export interface Tx {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: number;
}

export interface SwapData {
    fromToken: Token;
    toToken: Token;
    toTokenAmount: string;
    fromTokenAmount: string;
    protocols: any[][][];
    tx: Tx;
}

export enum SupportedExchanges {
    WETH,
    MultiSplit,
    Mooniswap,
    Chai,
    BETH,
    Compound,
    Aave,
    ChMinter,
    iearn,
    Fulcrum,
    MakerDAO,
    Oasis,
    Kyber,
    Uniswap,
    MultiUniswap,
    Balancer,
    Synthetix,
    Bancor,
    PMM,
    CurveFi,
    CurveFiV2,
    CurveFiIearn,
    CurveFiBUSD,
    CurveFiSUSD,
    CurveFiPAX,
    CurveFirenBTC,
    CurveFiTBTC,
    dForceSwap,
    PMM2,
    UniswapV2,
    ZeroXRelays,
    ZeroXAPI,
    dForce,
    AirSwap,
    Idle
}

// tslint:disable-next-line:max-line-length
export const exchanges = ['WETH', 'MultiSplit', 'Mooniswap', 'Chai', 'BETH', 'Compound', 'Aave', 'Chi Minter', 'iearn', 'Fulcrum', 'MakerDAO', 'Oasis', 'Kyber', 'Uniswap', 'Multi Uniswap', 'Balancer', 'Synthetix', 'Bancor', 'PMM', 'Curve.fi', 'Curve.fi v2', 'Curve.fi iearn', 'Curve.fi BUSD', 'Curve.fi sUSD', 'Curve.fi PAX', 'Curve.fi renBTC', 'Curve.fi tBTC', 'dForce Swap', 'PMM2', 'Uniswap V2', '0x Relays', '0x API', 'dForce', 'AirSwap', 'Idle'];
