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

    public rpcUrl = 'https://ethereum.1inch.exchange/';

    private authPart1 = 'd2ViMzpzbGRna2psc2RrajIzOTg0NzV1b3doc2pkbmdsc25na2xqaHNka2d6bzM0';
    private authPart2 = 'dXpoanRsbnNkbGduc2RsZ2pvc2R1em93NG5sZ3NuZGdrbGpoc2R1Z3p1aW93bmV0';
    private authPart3 = 'Z3NqZG5nb3V6c2RvZ2pubHNkaGpnb3Nq';

    private web3Subject$ = new Subject<Web3>();
    web3$ = this.web3Subject$.asObservable().pipe(
        shareReplay({ bufferSize: 1, refCount: true })
    );

    constructor() {
        // need to subscribe first
        this.web3$.subscribe();
        this.activate();

        // (window as any)?.ethereum?.on('accountsChanged', () => this.activate());
    }

    public activate(): void {
        this.activateWeb3().then(
            (w3) => this.web3Subject$.next(w3),
            (e) => console.error(e)
        );
    }

    public async activateWeb3(): Promise<Web3> {
        // const web3 = new Web3(w.ethereum);
        // if (!web3.defaultAccount) {
        //     await w.ethereum.enable();
        // }
        // return web3;
        const opt = {
            withCredentials: true,
            headers: [
                {
                    name: 'Authorization',
                    value: 'Basic ' + this.authPart1 + this.authPart2 + this.authPart3
                }
            ]
        };
        const provider = new Web3.providers.HttpProvider(this.rpcUrl, opt);
        return new Web3(provider);
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
