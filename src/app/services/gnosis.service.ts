import initSdk, { SafeInfo } from '@gnosis.pm/safe-apps-sdk';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

const appsSdk = initSdk();

export type Tx = {
  to: string;
  value: string;
  data: string;
};

@Injectable({
  providedIn: 'root'
})
export class GnosisService {

  private walletAddress = new Subject<string>();
  public walletAddress$ = this.walletAddress.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // todo: add alert for rinkeby
  private isMainNet = new Subject<boolean>();
  public isMainNet$ = this.isMainNet.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {

  }

  public sendTransaction(tx: Tx) {
    appsSdk.sendTransactions([tx]);
  }

  public addListeners(): void {

    appsSdk.addListeners({
      onSafeInfo: ((info: SafeInfo) => {

        this.isMainNet.next(info.network === 'mainnet');
        this.walletAddress.next(info.safeAddress);
      }),
    });
  }

  public removeListeners(): void {
    appsSdk.removeListeners();
  }
}
