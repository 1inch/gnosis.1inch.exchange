import { Injectable } from '@angular/core';
import { Erc20Helper } from './erc20.helper';
import { Observable, of } from 'rxjs';
import { catchError, mergeMap, take } from 'rxjs/operators';
import { fromPromise } from 'rxjs/internal-compatibility';
import { BigNumber, bigNumberify } from 'ethers/utils';
import { Web3Service } from './web3.service';
import { ethAddresses, zeroValueBN } from '../utils';


@Injectable({
  providedIn: 'root'
})
export class EthereumService extends Erc20Helper {

  constructor(web3Service: Web3Service) {
    super(web3Service);
  }

  public getBalance(
    walletAddress: string,
    contractAddress = ethAddresses[0],
    blockNumber?: number
  ): Observable<BigNumber> {

    if (ethAddresses.indexOf(contractAddress) === -1) {

      return this.getErc20Balance(
        contractAddress,
        walletAddress,
        blockNumber
      );
    }

    return this.web3Service.web3$.pipe(
      mergeMap((web3) => {

        const call$ = web3.eth.getBalance(
          walletAddress,
          blockNumber || 'latest'
        ).then((bal) => {

          return BigNumber.isBigNumber(bal) ? bal : bigNumberify(bal);
        });

        return fromPromise(call$) as Observable<BigNumber>;
      }),
      catchError(() => {

        return of(zeroValueBN);
      }),
      take(1)
    );
  }
}
