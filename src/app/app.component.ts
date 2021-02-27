import {Component, OnDestroy} from '@angular/core';
import {OneInchApiService} from './services/1inch.api/1inch.api.service';
import {GnosisService, Tx} from './services/gnosis.service';
import {TokenPriceService} from './services/token-price.service';
import {TokenService} from './services/token.service';
import {AbstractControl, FormControl, FormGroup, ValidatorFn, Validators} from '@angular/forms';
import {MatIconRegistry} from '@angular/material/icon';
import {DomSanitizer} from '@angular/platform-browser';
import {LocalStorage} from 'ngx-webstorage';
import {combineLatest, forkJoin, merge, Observable, of, Subject, Subscription} from 'rxjs';
import {ITokenDescriptor, TokenHelper} from './services/token.helper';
import {faGithub, faTelegramPlane, faTwitter, faYoutube} from '@fortawesome/free-brands-svg-icons';
import {
    catchError,
    debounceTime,
    delay,
    distinctUntilChanged,
    map,
    repeatWhen,
    shareReplay,
    startWith,
    switchMap,
    take,
    tap
} from 'rxjs/operators';
import {Quote, SwapData} from './services/1inch.api/1inch.api.dto';
import {BigNumber} from 'ethers/utils';
import {bnToNumberSafe, removePositiveSlippage} from './utils';
import {EthereumService} from './services/ethereum.service';
import {environment} from '../environments/environment';
import {ethers} from 'ethers';

type TokenCost = { tokenUsdCost: number, tokenUsdCostView: string };
type QuoteUpdate = { fromAmount: string };

// function capitalFirstChar(str: string): string {
//   if (!str) {
//     return '';
//   }
//   const capitalLetter = str.slice(0, 1).toUpperCase();
//   const restOfTheString = str.slice(1);
//
//   return `${capitalLetter}${restOfTheString}`;
// }

export function maxBn(tokenHelper: TokenHelper, balance: BigNumber, decimals: number): ValidatorFn {

    return (control: AbstractControl): { [key: string]: any } | null => {
        const parsedAsset = tokenHelper.parseUnits(control.value, decimals);
        const forbidden = parsedAsset.gt(balance);
        return forbidden ? {maxBalance: {value: control.value}} : null;
    };
}

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {

    public openLoader = true;
    private updateAmounts = new Subject<QuoteUpdate>();
    private subscription = new Subscription();

    @LocalStorage('slippage', '3') slippage;
    @LocalStorage('fromAmount', '1') fromAmount: string;
    @LocalStorage('fromTokenSymbol', 'ETH') _fromTokenSymbol: string;
    @LocalStorage('toTokenSymbol', 'DAI') _toTokenSymbol: string;

    @LocalStorage('panelOpenState', false)
    panelOpenState: boolean;

    // @LocalStorage('gasPricePanelOpenState', false)
    // gasPricePanelOpenState: boolean;

    set fromTokenSymbol(symbol: string) {
        if (symbol === this.toTokenSymbol) {
            this.flipTokens();
            return;
        }
        this._fromTokenSymbol = symbol;
    }

    get fromTokenSymbol(): string {
        return this._fromTokenSymbol;
    }

    set toTokenSymbol(symbol: string) {
        if (symbol === this.fromTokenSymbol) {
            this.flipTokens();
            return;
        }
        this._toTokenSymbol = symbol;
    }

    get toTokenSymbol(): string {
        return this._toTokenSymbol;
    }

    // gasPriceBN: BigNumber;

    toAmount: string;
    fromAmountBN: BigNumber;
    toAmountBN: BigNumber;

    fromTokenUsdCost: number;
    fromTokenUsdCostView: string;
    toTokenUsdCost: number;
    toTokenUsdCostView: string | undefined;

    tokenAmountInputValidator = [
        Validators.pattern(/^\d*\.{0,1}\d*$/),
        Validators.minLength(0),
        Validators.required
    ];

    swapForm = new FormGroup({
        fromAmount: new FormControl('', this.tokenAmountInputValidator),
        toAmount: new FormControl('', [...this.tokenAmountInputValidator]),
    });

    get fromAmountCtrl(): AbstractControl {
        return this.swapForm.controls.fromAmount;
    }

    get hasErrors(): boolean {
        const errors = this.fromAmountCtrl.errors;
        const isValidToAmount = this.swapForm.controls.toAmount.valid;
        if (!isValidToAmount) {
            return true;
        }
        if (!errors) {
            return false;
        }
        return Object.keys(errors)?.length > 0;
    }

    usdFormatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    });

    loading = false;

    sortedTokens$: Observable<ITokenDescriptor[]>;
    public tokenCountInOnePack = 50;

    autoCompleteCtrlFromToken = new FormControl();
    autoCompleteCtrlToToken = new FormControl();
    filteredFromTokens$: Observable<ITokenDescriptor[]>;
    filteredToTokens$: Observable<ITokenDescriptor[]>;

    // gasPrice = '';
    // txSpeedStr = ''

    twitterIcon = faTwitter;
    youtubeIcon = faYoutube;
    telegramIcon = faTelegramPlane;
    githubIcon = faGithub;

    constructor(
        private oneInchApiService: OneInchApiService,
        private gnosisService: GnosisService,
        private tokenPriceService: TokenPriceService,
        public tokenService: TokenService,
        private ethereumService: EthereumService,
        iconRegistry: MatIconRegistry,
        sanitizer: DomSanitizer
    ) {

        iconRegistry.addSvgIcon('settings', sanitizer.bypassSecurityTrustResourceUrl('assets/settings.svg'));
        iconRegistry.addSvgIcon('swap', sanitizer.bypassSecurityTrustResourceUrl('assets/swap.svg'));

        // need to subscribe before addListener
        this.gnosisService.walletAddress$.subscribe();
        // this.gnosisService.isMainNet$.subscribe(console.log);

        this.sortedTokens$ = this.gnosisService.walletAddress$.pipe(
            switchMap((walletAddress) => {
                return combineLatest([
                    this.tokenService.getSortedTokens(walletAddress),
                    this.tokenService.tokenHelper$
                ]);
            }),
            map(([tokens, tokenHelper]) => {

                this.updateFromAmountValidator(tokenHelper);
                this.openLoader = false;
                return tokens;
            }),
            shareReplay({bufferSize: 1, refCount: true})
        );

        this.filteredFromTokens$ = this.getFilteredTokens(this.autoCompleteCtrlFromToken);
        this.filteredToTokens$ = this.getFilteredTokens(this.autoCompleteCtrlToToken);

        this.swapForm.controls.fromAmount.setValue(this.fromAmount, {emitEvent: false});

        const fromAmountChange$ = this.swapForm.controls.fromAmount.valueChanges.pipe(
            startWith(this.fromAmount),
            debounceTime(200),
            distinctUntilChanged(),
            map((value: string) => ({
                fromAmount: value,
                resetFields: true
            }))
        );

        const fromAmountListener$ = merge(fromAmountChange$, this.updateAmounts.asObservable())
            .pipe(
                switchMap((({fromAmount}) => {
                    return this.setAmounts(fromAmount).pipe(
                        // background refresh
                        repeatWhen((completed) => completed.pipe(delay(20000)))
                    );
                }))
            );

        this.subscription.add(fromAmountListener$.subscribe());
        this.gnosisService.addListeners();
    }

    public swap(): void {

        this.loading = true;

        const walletAddress$ = this.gnosisService.walletAddress$;
        const tokenHelper$ = this.tokenService.tokenHelper$;

        const transactions: Tx[] = [];
        let token: ITokenDescriptor;
        let walletAddress: string;
        combineLatest([walletAddress$, tokenHelper$]).pipe(
            switchMap(([addr, tokenHelper]) => {
                walletAddress = addr;
                token = tokenHelper.getTokenBySymbol(this.fromTokenSymbol);
                const toToken = tokenHelper.getTokenBySymbol(this.toTokenSymbol);
                const isTokenApproved$ = this.ethereumService.isTokenApproved(
                    token.address,
                    walletAddress,
                    environment.TOKEN_SPENDER,
                    this.fromAmountBN
                );
                return forkJoin({
                    isApproved: isTokenApproved$,
                    fromToken: of(token),
                    toToken: of(toToken)
                });
            }),
            switchMap(({isApproved, fromToken, toToken}) => {

                if (!isApproved) {
                    const tx: Tx = {
                        to: token.address,
                        data: this.ethereumService.getApproveCallData(environment.TOKEN_SPENDER, ethers.constants.MaxUint256),
                        value: '0'
                    };
                    transactions.push(tx);
                }

                return this.oneInchApiService.getSwapData$(
                    fromToken.address,
                    toToken.address,
                    this.fromAmountBN.toString(),
                    walletAddress,
                    this.slippage,
                    true
                );
            }),
            tap((data: SwapData) => {

                const tx: Tx = {
                    to: data.tx.to,
                    value: data.tx.value,
                    data: removePositiveSlippage(data.tx.data, data.toToken.address),
                    gasPrice: data.tx.gasPrice
                };
                transactions.push(tx);

                this.gnosisService.sendTransactions(transactions);
                this.loading = false;
            }),
            catchError((e) => {
                this.loading = false;
                console.log(e);
                return of('');
            }),
            take(1),
        ).subscribe();
    }

    ngOnDestroy() {
        this.gnosisService.removeListeners();
        this.subscription.unsubscribe();
    }

    private setAmounts(value: string): Observable<any> {

        this.resetToTokenAmount();
        this.fromAmount = value;
        this.loading = true;
        return this.tokenService.tokenHelper$.pipe(
            switchMap((tokenHelper) => {

                const fromToken = tokenHelper.getTokenBySymbol(this.fromTokenSymbol);
                const toToken = tokenHelper.getTokenBySymbol(this.toTokenSymbol);
                const cost$ = this.getTokenCost(fromToken, +value).pipe(
                    map(({tokenUsdCost, tokenUsdCostView}) => {

                        this.fromTokenUsdCost = tokenUsdCost;
                        this.fromTokenUsdCostView = tokenUsdCostView;
                        return tokenHelper.parseAsset(this.fromTokenSymbol, value);
                    }),
                    take(1)
                );
                return forkJoin({
                    fromToken: of(fromToken),
                    toToken: of(toToken),
                    valueBN: cost$
                });
            }),
            switchMap(({valueBN, fromToken, toToken}) => {

                this.fromAmountBN = valueBN;
                return this.oneInchApiService.getQuote$(
                    fromToken.address,
                    toToken.address,
                    this.fromAmountBN.toString()
                );
            }),
            switchMap((quote: Quote) => {

                this.toAmountBN = new BigNumber(quote.toTokenAmount);
                return this.tokenService.tokenHelper$.pipe(
                    switchMap((tokenHelper) => {

                        const token = tokenHelper.getTokenBySymbol(this.toTokenSymbol);
                        const formattedAsset = tokenHelper.formatUnits(this.toAmountBN, token.decimals);
                        this.toAmount = formattedAsset;

                        return this.getTokenCost(token, +formattedAsset).pipe(
                            map(({tokenUsdCost, tokenUsdCostView}) => {

                                this.toTokenUsdCost = tokenUsdCost;
                                this.toTokenUsdCostView = tokenUsdCostView;
                                return formattedAsset;
                            }),
                            take(1)
                        );
                    })
                );
            }),
            tap((toAmount: string) => {

                this.swapForm.controls.toAmount.setValue(toAmount);
                this.loading = false;
            })
        );
    }

    private getFilteredTokens(form: FormControl): Observable<ITokenDescriptor[]> {

        return combineLatest([
            this.sortedTokens$,
            form.valueChanges.pipe(
                startWith('')
            ),
        ]).pipe(
            map((x) => {
                const [tokens, filterText] = x;
                return filterTokens(tokens, filterText);
            })
        );
    }

    private getTokenCost(
        token: ITokenDescriptor,
        tokenAmount: number
    ): Observable<TokenCost> {

        return this.tokenPriceService.getUsdTokenPrice(
            token.address,
            token.decimals
        ).pipe(
            map((priceBN: BigNumber) => {

                const usdPrice = bnToNumberSafe(priceBN) / 1e8;
                return this.calcTokenCost(tokenAmount, usdPrice);
            }),
            take(1)
        );
    }

    private calcTokenCost(tokenAmount: number, tokenPrice: number): TokenCost {
        try {
            const tokenUsdCost = tokenAmount * tokenPrice;
            const tokenUsdCostView = this.usdFormatter.format(tokenUsdCost);
            return {tokenUsdCost, tokenUsdCostView};
        } catch (e) {
            return {tokenUsdCost: 0, tokenUsdCostView: '0'};
        }
    }

    private resetToTokenAmount(): void {
        this.swapForm.controls.toAmount.reset();
        this.toTokenUsdCostView = undefined;
    }

    public onTokenChange(): void {
        this.resetToTokenAmount();
        this.tokenService.tokenHelper$.pipe(
            tap((tokenHelper) => {

                const token = tokenHelper.getTokenBySymbol(this.fromTokenSymbol);
                this.swapForm.controls.fromAmount.setValue(tokenHelper.toFixedSafe(this.fromAmount, token.decimals), {emitEvent: false});
                this.fromAmountBN = tokenHelper.parseUnits(this.fromAmount, token.decimals);
                this.updateAmounts.next({
                    fromAmount: this.fromAmount
                });
                this.tokenAmountInputValidator.pop();
                this.updateFromAmountValidator(tokenHelper);
            }),
            take(1)
        ).subscribe();
    }

    public flipTokens(): void {
        const fts = this._fromTokenSymbol;
        this._fromTokenSymbol = this._toTokenSymbol;
        this._toTokenSymbol = fts;
        this.fromAmount = this.toAmount;
        this.swapForm.controls.fromAmount.setValue(this.fromAmount, {emitEvent: false});
        this.fromTokenUsdCost = this.toTokenUsdCost;
        this.fromTokenUsdCostView = this.toTokenUsdCostView;
        this.onTokenChange();
    }

    public setMaxAmount(fromToken: ITokenDescriptor): void {
        this.swapForm.controls.fromAmount.setValue(fromToken.formatedTokenBalance);
    }

    public getTokenLogoImage(token: ITokenDescriptor): string {
        return token.logoURI || 'https://etherscan.io/images/main/empty-token.png';
    }

    get fromToDiffInPercent() {

        const diff = this.fromTokenUsdCost - this.toTokenUsdCost;
        if (!this.fromTokenUsdCost || +(diff.toFixed(2)) <= 0) {
            return '';
        }

        const percent = Math.abs((diff / this.fromTokenUsdCost) * 100);
        return `( -${percent.toFixed(2)}% )`;
    }

    private updateFromAmountValidator(tokenHelper: TokenHelper): void {
        const token = tokenHelper.getTokenBySymbol(this.fromTokenSymbol);
        const newValidatorFn = maxBn(tokenHelper, token.balance, token.decimals);
        this.tokenAmountInputValidator.push(newValidatorFn);
        this.swapForm.controls.fromAmount.setValidators(this.tokenAmountInputValidator);
        this.swapForm.controls.fromAmount.updateValueAndValidity();
        this.swapForm.controls.fromAmount.markAllAsTouched();
    }

    // onGasPriceChange(x: any): void {
    //   const {gasPriceBN, gasPrice, txSpeed} = x;
    //   this.txSpeedStr = txSpeed
    //   this.gasPrice = gasPrice;
    //   this.gasPriceBN = gasPriceBN;
    // }
}

function filterTokens(tokens: ITokenDescriptor[], value: string): ITokenDescriptor[] {
    const filterValue = value?.toLowerCase();
    return tokens.filter(token => token.symbol?.toLowerCase().indexOf(filterValue) === 0);
}
