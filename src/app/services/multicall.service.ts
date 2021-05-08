import {Web3Service} from './web3.service';
import MultiCallABI from '../abi/MultiCall.abi.json';
import {environment} from '../../environments/environment';
import {Injectable} from '@angular/core';
import {switchMap, take} from 'rxjs/operators';
import {fromPromise} from 'rxjs/internal-compatibility';
import {Observable} from 'rxjs';

export type MultiCallData = {
    to: string;
    data: string;
};

@Injectable({
    providedIn: 'root'
})
export class MultiCallService {

    private multiCallContract$ = this.web3Service.getInstance(MultiCallABI, environment.MULTI_CALL_ADDRESS);

    constructor(private readonly web3Service: Web3Service) {
    }

    async callWithBatchRetry(
        requests: MultiCallData[],
        chunk = 100,
        retryCount = 3
    ): Promise<string[]> {
        const promises: Promise<string[]>[] = [];
        const chunks = chunkArray(requests, chunk);

        for (const c of chunks) {
            promises.push(this.singleCallWithRetry(c, retryCount));
        }

        const results = await Promise.all(promises);
        return results.flat();
    }

    async call(
        requests: MultiCallData[],
        chunk = 100
    ): Promise<string[]> {
        const promises: Promise<string[]>[] = [];
        const chunks = chunkArray(requests, chunk);

        for (const c of chunks) {
            promises.push(this.singleCall(c));
        }

        const results = await Promise.all(promises);
        return results.flat();
    }

    private async singleCallWithRetry(chunk: MultiCallData[], retries: number): Promise<string[]> {

        while (retries > 0) {
            const result = await this.singleCall(chunk).catch((e) => {
                console.log(`Retry multicall. Remaing: ${retries}. Error: ${e.toString()}`);
                return null;
            });

            if (result) {
                return result;
            }

            retries -= 1;
        }

        throw new Error('token prices retries exceeded');
    }

    private async singleCall(chunk: MultiCallData[]): Promise<string[]> {
        return this.multiCallContract$.pipe(
            switchMap((instance) => {
                return fromPromise(instance.methods.multicall(chunk).call({}, 'pending')) as Observable<string[]>;
            }),
            take(1)
        ).toPromise();
    }

}

function chunkArray(array: MultiCallData[], size: number): MultiCallData[][] {
    const result: MultiCallData[][] = [];
    const arrayCopy = [...array];
    while (arrayCopy.length > 0) {
        result.push(arrayCopy.splice(0, size));
    }
    return result;
}
