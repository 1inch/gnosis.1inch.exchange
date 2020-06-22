import { Component, OnDestroy } from '@angular/core';
import { OneInchApiService } from './services/1inch.api/1inch.api.service';
import { GnosisService } from './services/gnosis.service';
import { TokenPriceService } from './services/token-price.service';
import { TokenService } from './services/token.service';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { LocalStorage } from 'ngx-webstorage';
import { Observable, Subscription } from 'rxjs';
import { ITokenDescriptor } from './services/token.helper';
import { map, mergeMap, startWith, switchMap, tap } from 'rxjs/operators';
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

  private subscription = new Subscription();

  @LocalStorage('displaySlippageSettings', false)
  displaySlippageSettings;

  @LocalStorage('slippage', 0.1)
  slippage;

  @LocalStorage('fromTokenSymbol', 'ETH') fromTokenSymbol: string;
  @LocalStorage('toTokenSymbol', 'DAI') toTokenSymbol: string;
  @LocalStorage('fromAmount', '1') fromAmount: string;
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

    this.swapForm.controls.fromAmount.setValue(this.fromAmount, { emitEvent: false });
    const fromAmountListener$ = this.swapForm.controls.fromAmount.valueChanges.pipe(
      startWith(this.fromAmount),
      switchMap((value: string) => {

        this.fromAmount = value;
        return this.tokenService.tokenHelper$.pipe(
          mergeMap((tokenHelper) => {

            const token = tokenHelper.getTokenBySymbol(this.fromTokenSymbol);
            return this.getTokenCost(token, +value).pipe(
              map(({ tokenUsdCost, tokenUsdCostView }) => {
                this.fromTokenUsdCost = tokenUsdCost;
                this.fromTokenUsdCostView = tokenUsdCostView;
                return tokenHelper.parseAsset(this.fromTokenSymbol, value);
              })
            );
          }),
        );
      }),
      switchMap((valueBN: BigNumber) => {

        this.loading = true;
        this.fromAmountBN = valueBN;
        this.swapForm.controls.toAmount.reset();
        this.toTokenUsdCostView = undefined;
        return this.oneInchApiService.getQuote$(
          this.fromTokenSymbol,
          this.toTokenSymbol,
          this.fromAmountBN.toString()
        );
      }),
      switchMap((quote: Quote) => {

        this.toAmountBN = new BigNumber(quote.toTokenAmount);
        return this.tokenService.tokenHelper$.pipe(
          mergeMap((tokenHelper) => {

            const token = tokenHelper.getTokenBySymbol(this.toTokenSymbol);
            const formattedAsset = tokenHelper.formatUnits(this.toAmountBN, token.decimals);
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

    this.subscription.add(fromAmountListener$.subscribe());

    iconRegistry.addSvgIcon('settings', sanitizer.bypassSecurityTrustResourceUrl('assets/settings.svg'));
    iconRegistry.addSvgIcon('swap', sanitizer.bypassSecurityTrustResourceUrl('assets/swap.svg'));

    // this.gnosisService.addListeners();
    // this.gnosisService.isMainNet$.subscribe(console.log);
    // this.gnosisService.walletAddress$.subscribe(console.log);

    this.tokenService.setTokenData('0x66666600E43c6d9e1a249D29d58639DEdFcD9adE');
    this.sortedTokens = this.tokenService.getSortedTokens();
    // this.tokenService.getSortedTokens().subscribe(console.log)


    // this.tokenService.tokenHelper$.pipe(
    //   tap((tokenHelper) => {
    //
    //   })
    // ).subscribe();
    // this.tokenPriceService.getTokenPriceBN('0x0000000000000000000000000000000000000000', 18).subscribe(console.log);

    // oneInchApiService.getQuote$('ETH', 'DAI', '10000000000000').subscribe(console.log);
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

  swapTokenPlaces() {
    this.loading = true;
    setTimeout(() => {
      this.loading = false;
    }, 1500);
  }

  get fromToDiffInPercent() {

    const diff = this.fromTokenUsdCost - this.toTokenUsdCost;
    if (!this.fromTokenUsdCost || +(diff.toFixed(2)) <= 0) {
      return '';
    }

    const percent = Math.abs((diff / this.fromTokenUsdCost) * 100);
    return `( -${ percent.toFixed(2) }% )`;
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
        token.usdBalance = usdPrice;
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

  getTokenLogoImage(tokenAddress: string): string {
    return `https://1inch.exchange/assets/tokens/${ tokenAddress.toLowerCase() }.png`;
  }
}
