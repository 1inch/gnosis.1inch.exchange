import initSdk, { SafeInfo } from '@gnosis.pm/safe-apps-sdk';
import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

const appsSdk = initSdk();

export type Tx = {
  to: string;
  value: string;
  data: string;
  gasPrice?: string;
  gas?: string;
};

@Injectable({
  providedIn: 'root'
})
export class GnosisService {

  private walletAddress = new Subject<string>();
  public walletAddress$ = this.walletAddress.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  // todo: add alert for testnet (not supported)
  private isMainNet = new Subject<boolean>();
  public isMainNet$ = this.isMainNet.pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  constructor() {
  }

  public sendTransactions(txs: Tx[]): void {
    appsSdk.sendTransactions(txs);
  }

  public addListeners(): void {

    // this.walletAddress.next('0x66666600e43c6d9e1a249d29d58639dedfcd9ade');
    this.walletAddress.next('0x3a13D9b322F391a1AFab36a1d242C24F3250bA48');
    // appsSdk.addListeners({
    //   onSafeInfo: ((info: SafeInfo) => {
    //
    //     this.isMainNet.next(info.network.toLowerCase() === 'mainnet');
    //     this.walletAddress.next(info.safeAddress);
    //   }),
    // });
  }

  public removeListeners(): void {
    appsSdk.removeListeners();
  }
}
