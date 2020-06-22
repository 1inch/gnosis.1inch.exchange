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

  public async activateWeb3(): Promise<Web3> {
    const web3 = new Web3(w.ethereum);
    if (!web3.defaultAccount) {
      await w.ethereum.enable();
    }
    return web3;
  }

  public getInstance(abi: any[], address: string): Observable<Contract> {

    return fromPromise(
      this.activateWeb3()
    ).pipe(
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
