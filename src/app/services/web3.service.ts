import { Observable, of } from 'rxjs';
import { Contract } from 'web3-eth-contract';
import { Injectable } from '@angular/core';
import { map, mergeMap } from 'rxjs/operators';
import Web3 from 'web3';
import { fromPromise } from 'rxjs/internal-compatibility';

@Injectable({
  providedIn: 'root'
})
export class Web3Service {

  public web3$ = of(window).pipe(
    mergeMap((w: any) => {
      w.web3 = new Web3(w.ethereum);
      if (!w.web3) {
        return fromPromise(w.ethereum.enable()).pipe(map(() => w.web3));
      }
      return of(w.web3);
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
}
