import { Component, OnDestroy } from '@angular/core';
import { OneInchApiService } from './services/1inch.api/1inch.api.service';
import { GnosisService } from './services/gnosis.service';
import { TokenPriceService } from './services/token-price.service';
import { TokenService } from './services/token.service';
import { tap } from 'rxjs/operators';
import { FormControl, FormGroup } from "@angular/forms";



@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnDestroy {

  public title = '1inch';

  selectedValue = 1;
  foods = [
    {viewValue: 'USDC', value: 1},
    {viewValue: 'WBTC', value: 2}
  ];

  swapForm = new FormGroup({
    firstName: new FormControl(''),
    lastName: new FormControl(''),
  });

  constructor(
    private oneInchApiService: OneInchApiService,
    private gnosisService: GnosisService,
    private tokenPriceService: TokenPriceService,
    private tokenService: TokenService
  ) {

    this.gnosisService.addListeners();
    this.gnosisService.isMainNet$.subscribe(console.log);
    this.gnosisService.walletAddress$.subscribe(console.log);

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
  }

}
