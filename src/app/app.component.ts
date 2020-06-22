import { Component, OnDestroy } from '@angular/core';
import { OneInchApiService } from './services/1inch.api/1inch.api.service';
import { GnosisService } from './services/gnosis.service';
import { TokenPriceService } from './services/token-price.service';
import { TokenService } from './services/token.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { LocalStorage } from 'ngx-webstorage';
import { merge, Observable, Subject, Subscription } from 'rxjs';
import { ITokenDescriptor } from './services/token.helper';
import { distinctUntilChanged, map, startWith, switchMap, take, tap } from 'rxjs/operators';
import { Quote } from './services/1inch.api/1inch.api.dto';
import { BigNumber } from 'ethers/utils';
import { bnToNumberSafe } from './utils';

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

  public title = '1inch.exchange';

  private updateAmounts = new Subject<string>();
  private subscription = new Subscription();

  @LocalStorage('displaySlippageSettings', false)
  displaySlippageSettings;

  @LocalStorage('slippage', 0.1)
  slippage;

  @LocalStorage('fromTokenSymbol', 'ETH') fromTokenSymbol: string;
  @LocalStorage('toTokenSymbol', 'DAI') toTokenSymbol: string;
  @LocalStorage('fromAmount', '1') fromAmount: string;
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

  sortedTokens: Observable<ITokenDescriptor[]>;

  constructor(
    private oneInchApiService: OneInchApiService,
    private gnosisService: GnosisService,
    private tokenPriceService: TokenPriceService,
    public tokenService: TokenService,
    iconRegistry: MatIconRegistry,
    sanitizer: DomSanitizer
  ) {

    iconRegistry.addSvgIcon('settings', sanitizer.bypassSecurityTrustResourceUrl('assets/settings.svg'));
    iconRegistry.addSvgIcon('swap', sanitizer.bypassSecurityTrustResourceUrl('assets/swap.svg'));

    // this.gnosisService.addListeners();
    // this.gnosisService.isMainNet$.subscribe(console.log);
    // this.gnosisService.walletAddress$.subscribe(console.log);

    this.tokenService.setTokenData('0x66666600E43c6d9e1a249D29d58639DEdFcD9adE');
    this.sortedTokens = this.tokenService.getSortedTokens();

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

    // oneInchApiService.getSwapData$(
    //   'ETH',
    //   'DAI',
    //   String(1e12),
    //   '0x66666600E43c6d9e1a249D29d58639DEdFcD9adE'
    //   // '1',
    //   // false
    // ).subscribe((x) => {
    //   console.log(x);
    //   // gnosisService.sendTransaction({
    //   //   to: x.to,
    //   //   data: x.data,
    //   //   value: x.value
    //   // });
    // });
  }

  ngOnDestroy() {
    this.gnosisService.removeListeners();
    this.subscription.unsubscribe();
  }

  toggleSlippage() {
    this.displaySlippageSettings = !this.displaySlippageSettings;
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

        this.fromAmountBN = tokenHelper.parseAsset(this.fromTokenSymbol, this.fromAmount);
        this.updateAmounts.next(this.fromAmount);
      }),
      take(1)
    ).subscribe();
  }

  public flipTokens(): void {
    const fts = this.fromTokenSymbol;
    this.fromTokenSymbol = this.toTokenSymbol;
    this.toTokenSymbol = fts;
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
}
