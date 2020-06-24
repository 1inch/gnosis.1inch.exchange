import { ChangeDetectionStrategy, Component, EventEmitter, OnDestroy, OnInit, Output, } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { Observable, of, Subscription } from 'rxjs';
import { filter, shareReplay, switchMap, tap } from 'rxjs/operators';
import { LocalStorage } from 'ngx-webstorage';
import { BigNumber, bigNumberify } from 'ethers/utils';
import { GasPriceApiService } from '../services/gas-price.api/gas-price.api.service';
import { bnToNumberSafe, zeroValueBN } from '../utils';
import { GasPriceBN } from '../services/gas-price.api/gas-price.api.dto';

export type TxSpeed = 'normal' | 'fast' | 'instant' | 'custom'
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

  private subscription: Subscription;

  @LocalStorage('txSpeed', 'fast')
  txSpeed;

  get txSpeedWithFirstCapital(): string {

    if (!this.txSpeed) {
      return '';
    }
    const capitalLetter = this.txSpeed.slice(0, 1).toUpperCase();
    const restOfTheString = this.txSpeed.slice(1);

    return `${capitalLetter}${restOfTheString}`
  }

  @LocalStorage('customGasPrice', '')
  customGasPrice;

  public form = new FormGroup({
    txSpeedSelect: new FormControl(this.txSpeed),
    gasPriceInput: new FormControl(this.customGasPrice, [
      Validators.pattern('^[0-9.]*$'),
      Validators.min(1)
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

  getGasPrice(txSpeed: TxSpeed): string {
    return this.gasPriceValues[txSpeed + 'BN'];
  }

  // Be aware, it's not actual double way binding at the moment.
  // Because component read value only once at initTime
  // That could be improved later on once we have demand fo this

  @Output()
  gasPriceChange = new EventEmitter<string>();

  lastSubmittedGasPrice: string;

  @LocalStorage('gasPricePanelOpenState', false)
  gasPricePanelOpenState: boolean;

  selectTxSpeed(txSpeed: TxSpeed) {

    const price = this.getGasPrice(txSpeed);
    this.form.setValue({
      txSpeedSelect: txSpeed,
      gasPriceInput: this.customGasPrice
    });

    // if (this.isPreDefinedSlippageValue(txSpeed)) {
    //   this.showCustomSlippageInput = false;
    //   this.form.setValue({
    //     gasPriceSelect: txSpeed,
    //     gasPriceInput: ''
    //   });
    // }
    // else {
    //   this.gasPriceSelect.setValue('custom');
    //   this.gasPriceInput.setValue(txSpeed);
    //   this.showCustomSlippageInput = true;
    // }
  }

  // isPreDefinedSlippageValue(value: string): boolean {
  //   return ['0.1', '0.5', '1', '3'].indexOf(value) !== -1;
  // }

  constructor(private gasPriceApiService: GasPriceApiService) {
    this.gasPriceApiService.gasPrice.pipe(
      tap((gasPrice: GasPriceBN) => {

        // this.gasPriceValues.normal
      })
    )
  }

  ngOnInit(): void {

    this.gasPrice$ = this.txSpeedSelect.valueChanges.pipe(
      switchMap((txSpeed: TxSpeed) => {

        if (txSpeed !== 'custom') {
          return of(this.getGasPrice(txSpeed));
        }

        return this.gasPriceInput.valueChanges.pipe(
          filter((x) => !this.gasPriceInput.errors),
          tap((value) => this.customGasPrice = value)
        );
      }),
      tap((gasPrice: string) => {
        this.lastSubmittedGasPrice = gasPrice;
        this.gasPriceChange.next(gasPrice);
      }),
      shareReplay({bufferSize: 1, refCount: true})
    );

  }

  ngOnDestroy() {
    //this.subscription.unsubscribe();
  }
}

function parseGasPrice(gasPrice: BigNumber): number {
  return Math.round(bnToNumberSafe(gasPrice) / 1e9);
}

function formatGasPrice(gasPrice: string): BigNumber {
  return bigNumberify(gasPrice * 100 * 1e9 / 100);
}
