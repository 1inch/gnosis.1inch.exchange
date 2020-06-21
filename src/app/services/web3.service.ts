import { defer, Observable, of } from 'rxjs';
import { Contract } from 'web3-eth-contract';
import { Injectable } from '@angular/core';
import { exhaustMap, map } from 'rxjs/operators';
import Web3 from 'web3';
import { fromPromise } from 'rxjs/internal-compatibility';

const w = window as any;

@Injectable({
  providedIn: 'root'
})
export class Web3Service {

  public web3$ = defer(() => {

    return of(new Web3(w.ethereum));
  }).pipe(
    exhaustMap((web3: Web3) => {

      if (!web3.defaultAccount) {
        return fromPromise(w.ethereum.enable()).pipe(map(() => web3));
      }
      return of(web3);
    })
  );

  public getInstance(abi: any[], address: string): Observable<Contract> {

    return this.web3$.pipe(
      map((web3) => {

        // @ts-ignore
        return (new web3.eth.Contract(
          abi,
          address
        )) as Contract;
      })
    );
  }

  public getInstanceWithoutNetwork(abi: any[]): Contract {

    const web3 = new Web3('');

    // @ts-ignore
    return new web3.eth.Contract(abi) as Contract;
  }
}
