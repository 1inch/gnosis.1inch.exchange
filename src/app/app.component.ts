import { Component } from '@angular/core';
import { OneInchApiService } from './services/1inch.api/1inch.api.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  title = '1inch';

  constructor(
    private oneInchApiService: OneInchApiService
  ) {
    // oneInchApiService.getQuote$('ETH', 'DAI', '10000000000000').subscribe(console.log);
    // oneInchApiService.getSwapData$('ETH', 'DAI', String(1e12), '0x66666600E43c6d9e1a249D29d58639DEdFcD9adE').subscribe(console.log);
  }

}
