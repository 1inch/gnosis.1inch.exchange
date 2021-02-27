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

export function removePositiveSlippage(data: string, toToken: string): string {
  // 4470bdb947 followed by the sell token seems to indicate the positive slippage capture.
  // The word after seems to correspond to the "guaranteed" buy amount (if proceeds are higher, 
  // the difference is captured by the protocol). By setting this amount to max uint we make
  // sure that no positive slippage is extracted.
  const regexp = RegExp("4470bdb947000000000000000000000000" + toToken.substring(2,42));
  const match = data.match(regexp)
  if (match) {
    // replace min guaranteed amount
    const guaranteed_min_amount_section = match.index + 74;
    return data.substring(0, guaranteed_min_amount_section) + "ff".repeat(32) + data.substring(guaranteed_min_amount_section + 64, data.length)
  }
  return data;
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
