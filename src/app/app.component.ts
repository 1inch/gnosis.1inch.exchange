import { Component, OnDestroy } from '@angular/core';
import { OneInchApiService } from './services/1inch.api/1inch.api.service';
import { GnosisService } from './services/gnosis.service';
import { TokenPriceService } from './services/token-price.service';
import { ISymbol2Token, TokenHelper } from './services/token.helper';
import { Token } from './services/1inch.api/1inch.api.dto';
import { map, shareReplay } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {

  public title = '1inch';
  private tokenHelper$: Observable<TokenHelper>;

  constructor(
    private oneInchApiService: OneInchApiService,
    private gnosisService: GnosisService,
    private tokenPriceService: TokenPriceService
  ) {

    this.gnosisService.addListeners();
    this.gnosisService.isMainNet$.subscribe(console.log);
    this.gnosisService.walletAddress$.subscribe(console.log);

    this.tokenHelper$ = this.oneInchApiService.getTokens$().pipe(
      map((tokens: Token[]) => {

        const symbol2Token: ISymbol2Token = {};
        for (const token of tokens) {
          symbol2Token[token.symbol] = token;
        }
        return new TokenHelper(symbol2Token);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );


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
  }

}
