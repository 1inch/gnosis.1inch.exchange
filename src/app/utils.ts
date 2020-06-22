import { BigNumber, bigNumberify } from 'ethers/utils';
import { Observable, ReplaySubject, Subscriber, Subscription } from 'rxjs';
import { first } from 'rxjs/operators';

export const ethAddresses = [
  '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
  '0x0000000000000000000000000000000000000000'
];

export function bnToNumberSafe(val: BigNumber): number {
  const hex = val.toHexString();
  return parseInt(hex, 16);
}

export const zeroValueBN = bigNumberify(0);

export class RefreshingReplaySubject<T> extends ReplaySubject<T> {

  private providerCallback: () => Observable<T>;
  private lastProviderTrigger: number;
  private readonly windowTime;

  constructor(providerCallback: () => Observable<T>, windowTime?: number) {
    // Cache exactly 1 item forever in the ReplaySubject
    super(1);
    this.windowTime = windowTime || 60000;
    this.lastProviderTrigger = 0;
    this.providerCallback = providerCallback;
  }

  public _subscribe(subscriber: Subscriber<T>): Subscription {
    // Hook into the subscribe method to trigger refreshing
    this._triggerProviderIfRequired();
    return super._subscribe(subscriber);
  }

  protected _triggerProviderIfRequired() {
    const now = this._getNow();
    if ((now - this.lastProviderTrigger) > this.windowTime) {
      // Data considered stale, provider triggering required...
      this.lastProviderTrigger = now;
      this.providerCallback().pipe(first()).subscribe((t: T) => this.next(t));
    }
  }
}
