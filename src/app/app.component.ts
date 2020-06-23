import { Component, OnDestroy } from '@angular/core';
import { OneInchApiService } from './services/1inch.api/1inch.api.service';
import { GnosisService, Tx } from './services/gnosis.service';
import { TokenPriceService } from './services/token-price.service';
import { TokenService } from './services/token.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { LocalStorage } from 'ngx-webstorage';
import { combineLatest, merge, Observable, of, Subject, Subscription } from 'rxjs';
import { ITokenDescriptor } from './services/token.helper';
import { catchError, distinctUntilChanged, map, shareReplay, startWith, switchMap, take, tap } from 'rxjs/operators';
import { Quote, SupportedExchanges, SwapData } from './services/1inch.api/1inch.api.dto';
import { BigNumber } from 'ethers/utils';
import { bnToNumberSafe } from './utils';
import { EthereumService } from './services/ethereum.service';
import { environment } from '../environments/environment';
import { ethers } from 'ethers';

type TokenCost = { tokenUsdCost: number, tokenUsdCostView: string };

const tokenAmountInputValidator = [
  Validators.pattern('^[0-9.]*$'),
];

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {

  private updateAmounts = new Subject<string>();
  private subscription = new Subscription();

  @LocalStorage('displaySlippageSettings', false) displaySlippageSettings;
  @LocalStorage('slippage', 0.1) slippage;
  @LocalStorage('fromAmount', '1') fromAmount: string;
  @LocalStorage('fromTokenSymbol', 'ETH') _fromTokenSymbol: string;
  @LocalStorage('toTokenSymbol', 'DAI') _toTokenSymbol: string;

  @LocalStorage('disabledExchanges', [SupportedExchanges.AirSwap])
  disabledExchanges: SupportedExchanges[];

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

  toAmount: string;
  fromAmountBN: BigNumber;
  toAmountBN: BigNumber;

  fromTokenUsdCost: number;
  fromTokenUsdCostView: string;
  toTokenUsdCost: number;
  toTokenUsdCostView: string | undefined;

  swapForm = new FormGroup({
    fromAmount: new FormControl('', tokenAmountInputValidator),
    toAmount: new FormControl('', tokenAmountInputValidator),
  });

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
      switchMap((walletAddress: string) => {
        return this.tokenService.getSortedTokens(walletAddress);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.filteredFromTokens$ = this.getFilteredTokens(this.autoCompleteCtrlFromToken);
    this.filteredToTokens$ = this.getFilteredTokens(this.autoCompleteCtrlToToken);

    this.swapForm.controls.fromAmount.setValue(this.fromAmount, { emitEvent: false });

    const fromAmountChange$ = this.swapForm.controls.fromAmount.valueChanges.pipe(
      startWith(this.fromAmount),
      distinctUntilChanged()
    );

    const fromAmountListener$ = merge(fromAmountChange$, this.updateAmounts.asObservable())
      .pipe(
        switchMap(((value: string) => this.setAmounts(value)))
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
        return this.ethereumService.isTokenApproved(
          token.address,
          walletAddress,
          environment.TOKEN_SPENDER,
          this.fromAmountBN
        );
      }),
      switchMap((isApproved: boolean) => {

        if (!isApproved) {
          const tx: Tx = {
            to: token.address,
            data: this.ethereumService.getApproveCallData(environment.TOKEN_SPENDER, ethers.constants.MaxUint256),
            value: '0'
          };
          transactions.push(tx);
        }

        return this.oneInchApiService.getSwapData$(
          this.fromTokenSymbol,
          this.toTokenSymbol,
          this.fromAmountBN.toString(),
          walletAddress,
          String(this.slippage),
          true,
          this.disabledExchanges
        );
      }),
      tap((data: SwapData) => {

        const tx: Tx = {
          to: data.to,
          value: data.value,
          data: data.data,
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

    this.loading = true;
    this.fromAmount = value;
    return this.tokenService.tokenHelper$.pipe(
      switchMap((tokenHelper) => {

        const token = tokenHelper.getTokenBySymbol(this.fromTokenSymbol);
        return this.getTokenCost(token, +value).pipe(
          map(({ tokenUsdCost, tokenUsdCostView }) => {

            this.fromTokenUsdCost = tokenUsdCost;
            this.fromTokenUsdCostView = tokenUsdCostView;
            return tokenHelper.parseAsset(this.fromTokenSymbol, value);
          })
        );
      }),
      switchMap((valueBN: BigNumber) => {

        this.fromAmountBN = valueBN;
        this.resetToTokenAmount();
        return this.oneInchApiService.getQuote$(
          this.fromTokenSymbol,
          this.toTokenSymbol,
          this.fromAmountBN.toString(),
          this.disabledExchanges
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
              map(({ tokenUsdCost, tokenUsdCostView }) => {
                this.toTokenUsdCost = tokenUsdCost;
                this.toTokenUsdCostView = tokenUsdCostView;
                return formattedAsset;
              })
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
      })
    );
  }

  private calcTokenCost(tokenAmount: number, tokenPrice: number): TokenCost {
    try {
      const tokenUsdCost = tokenAmount * tokenPrice;
      const tokenUsdCostView = this.usdFormatter.format(tokenUsdCost);
      return { tokenUsdCost, tokenUsdCostView };
    } catch (e) {
      return { tokenUsdCost: 0, tokenUsdCostView: '0' };
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
        this.swapForm.controls.fromAmount.setValue(tokenHelper.toFixed(this.fromAmount, token.decimals));
        this.fromAmountBN = tokenHelper.parseUnits(this.fromAmount, token.decimals);
        this.updateAmounts.next(this.fromAmount);
      }),
      take(1)
    ).subscribe();
  }

  public flipTokens(): void {
    const fts = this._fromTokenSymbol;
    this._fromTokenSymbol = this._toTokenSymbol;
    this._toTokenSymbol = fts;
    this.fromAmount = this.toAmount;
    this.swapForm.controls.fromAmount.setValue(this.fromAmount, { emitEvent: false });
    this.fromTokenUsdCost = this.toTokenUsdCost;
    this.fromTokenUsdCostView = this.toTokenUsdCostView;
    this.onTokenChange();
  }

  public setMaxAmount(fromToken: ITokenDescriptor): void {
    this.swapForm.controls.fromAmount.setValue(fromToken.formatedTokenBalance);
  }

  public getTokenLogoImage(tokenAddress: string): string {
    return `https://1inch.exchange/assets/tokens/${ tokenAddress.toLowerCase() }.png`;
  }

  get fromToDiffInPercent() {

    const diff = this.fromTokenUsdCost - this.toTokenUsdCost;
    if (!this.fromTokenUsdCost || +(diff.toFixed(2)) <= 0) {
      return '';
    }

    const percent = Math.abs((diff / this.fromTokenUsdCost) * 100);
    return `( -${ percent.toFixed(2) }% )`;
  }

  public toggleSlippage() {
    this.displaySlippageSettings = !this.displaySlippageSettings;
  }
}

function filterTokens(tokens: ITokenDescriptor[], value: string): ITokenDescriptor[] {
  const filterValue = value?.toLowerCase();
  return tokens.filter(token => token.symbol?.toLowerCase().indexOf(filterValue) === 0);
}
