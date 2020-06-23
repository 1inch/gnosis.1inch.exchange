import { Observable, Subject } from 'rxjs';
import { Contract } from 'web3-eth-contract';
import { Injectable } from '@angular/core';
import { map, shareReplay } from 'rxjs/operators';
import Web3 from 'web3';

const w = window as any;

@Injectable({
  providedIn: 'root'
})
export class Web3Service {

  web3Subject$ = new Subject<Web3>();
  web3$ = this.web3Subject$.asObservable();

  constructor() {
    // need to subscribe first
    this.web3$.subscribe();

    this.activateWeb3().then(
      (w3) => this.web3Subject$.next(w3),
      (e) => {
        console.error(e);
      }
    );
  }

  public async activateWeb3(): Promise<Web3> {
    const web3 = new Web3(w.ethereum);
    if (!web3.defaultAccount) {
      await w.ethereum.enable();
    }
    return web3;
  }

  public getInstance(abi: any[], address: string): Observable<Contract> {

    return this.web3$.pipe(
      map((web3) => {
        // @ts-ignore
        return (new web3.eth.Contract(
          abi,
          address
        )) as Contract;
      }),
      // catchError( () => { }) ???
    );
  }

  public getInstanceWithoutNetwork(abi: any[]): Contract {

    const web3 = new Web3('');

    // @ts-ignore
    return new web3.eth.Contract(abi) as Contract;
  }
}
