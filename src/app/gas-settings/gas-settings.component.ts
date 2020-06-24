import { ChangeDetectionStrategy, Component, EventEmitter, OnDestroy, OnInit, Output, } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { concat, Observable, of, Subscription } from 'rxjs';
import { filter, map, shareReplay, startWith, switchMap, tap } from 'rxjs/operators';
import { LocalStorage } from 'ngx-webstorage';
import { BigNumber, bigNumberify } from 'ethers/utils';
import { GasPriceApiService } from '../services/gas-price.api/gas-price.api.service';
import { bnToNumberSafe, zeroValueBN } from '../utils';
import { GasPriceBN } from '../services/gas-price.api/gas-price.api.dto';

export type TxSpeed = 'normal' | 'fast' | 'instant' | 'custom';
export type GasPriceChangeDto = {
  gasPriceBN: BigNumber;
  gasPrice: string;
  txSpeed: TxSpeed
};

type GasPrice = {
  normal: number,
  fast: number,
  instant: number,
  normalBN: BigNumber,
  fastBN: BigNumber,
  instantBN: BigNumber
}

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'oi-gas-settings',
  templateUrl: './gas-settings.component.html',
  styleUrls: ['./gas-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class GasSettingsComponent implements OnInit, OnDestroy {

  private subscription = new Subscription();

  @LocalStorage('txSpeed', 'fast')
  txSpeed;

  @LocalStorage('customGasPrice', '')
  customGasPrice;

  public form = new FormGroup({
    txSpeedSelect: new FormControl(this.txSpeed),
    gasPriceInput: new FormControl(this.customGasPrice, [
      Validators.pattern('^[0-9.]*$'),
      Validators.min(1),
      Validators.required
    ])
  });

  gasPrice$: Observable<string>;

  get gasPriceInput(): AbstractControl {
    return this.form.controls.gasPriceInput;
  }

  get txSpeedSelect(): AbstractControl {
    return this.form.controls.txSpeedSelect;
  }

  private gasPriceValues: GasPrice = {
    normal: 0,
    fast: 0,
    instant: 0,
    normalBN: zeroValueBN,
    fastBN: zeroValueBN,
    instantBN: zeroValueBN
  };

  getGasPrice(txSpeed: TxSpeed): [BigNumber, string] {
    return [
      this.gasPriceValues[txSpeed + 'BN'],
      this.gasPriceValues[txSpeed],
    ];
  }

  // Be aware, it's not actual double way binding at the moment.
  // Because component read value only once at initTime
  // That could be improved later on once we have demand fo this

  @Output()
  gasPriceChange = new EventEmitter<GasPriceChangeDto>();

  selectTxSpeed(txSpeed: TxSpeed) {

    this.txSpeed = txSpeed;
    this.form.setValue({
      txSpeedSelect: txSpeed,
      gasPriceInput: this.customGasPrice
    });
  }

  constructor(private gasPriceApiService: GasPriceApiService) {
    this.setValues(this.gasPriceApiService.gasPrice.value);
    const gasChangesListener$ = this.gasPriceApiService.gasPrice.pipe(
      tap((gasPrice: GasPriceBN) => this.setValues(gasPrice))
    );
    this.subscription.add(gasChangesListener$.subscribe());
  }

  ngOnInit(): void {

    this.gasPrice$ = this.txSpeedSelect.valueChanges.pipe(
      switchMap((txSpeed: TxSpeed) => {
        console.log(`txSpeed=`, txSpeed);
        if (txSpeed !== 'custom') {
          return of(this.getGasPrice(txSpeed));
        }

        return this.gasPriceInput.valueChanges.pipe(
            startWith(this.gasPriceInput.value),
            filter(() => !this.gasPriceInput.errors),
            map((value) => {
              this.customGasPrice = value;
              return [formatGasPrice(value), value];
            })
          );

      }),
      map(([gasPriceBN, gasPrice]) => {
        this.gasPriceChange.next({
          gasPriceBN,
          gasPrice,
          txSpeed: this.txSpeedSelect.value
        });
        return gasPrice;
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

    this.subscription.add(
      this.gasPrice$.subscribe()
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  private setValues(gasPrice: GasPriceBN): void {

    this.gasPriceValues.normalBN = gasPrice.standard;
    this.gasPriceValues.fastBN = gasPrice.fast;
    this.gasPriceValues.instantBN = gasPrice.instant;

    this.gasPriceValues.normal = parseGasPrice(gasPrice.standard);
    this.gasPriceValues.fast = parseGasPrice(gasPrice.fast);
    this.gasPriceValues.instant = parseGasPrice(gasPrice.instant);

    this.txSpeedSelect.setValue(this.txSpeed);
  }
}

function parseGasPrice(gasPrice: BigNumber): number {
  return Math.round(bnToNumberSafe(gasPrice) / 1e9);
}

function formatGasPrice(gasPrice: string): BigNumber {
  return bigNumberify(+gasPrice * 100 * 1e9 / 100);
}
