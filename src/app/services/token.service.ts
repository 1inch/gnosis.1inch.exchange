import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ISymbol2Token, TokenHelper } from './token.helper';
import { OneInchApiService } from './1inch.api/1inch.api.service';
import { map, shareReplay } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class TokenService {

  public tokenHelper$: Observable<TokenHelper> = this.oneInchApiService.getTokens$()
    .pipe(
      map((tokens: ISymbol2Token) => {

        return new TokenHelper(tokens);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  constructor(
    private oneInchApiService: OneInchApiService
  ) {
  }

}
