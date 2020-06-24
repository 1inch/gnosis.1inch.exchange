import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { merge, Observable, of, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, shareReplay, switchMap, tap } from 'rxjs/operators';
import { LocalStorage } from "ngx-webstorage";

export type TxSpeed = 'normal' | 'fast' | 'instant' | 'custom'

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

  gasPriceValues = {
    'normal': 42,
    'fast': 48,
    'instant': 59,
  }

  getGasPrice(txSpeed: TxSpeed): string {
    return this.gasPriceValues[txSpeed];
  }

  // Be aware, it's not actual double way binding at the moment.
  // Because component read value only once at initTime
  // That could be improved later on once we have demand fo this
  @Input()
  gasPrice: string;

  @Output()
  gasPriceChange = new EventEmitter<string>();

  lastSubmittedGasPrice: string

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

  ngOnInit(): void {

    this.gasPrice$ = this.txSpeedSelect.valueChanges.pipe(
      switchMap((txSpeed: TxSpeed) => {

        if (txSpeed !== 'custom') {
          return of(this.getGasPrice(txSpeed))
        }

        return this.gasPriceInput.valueChanges.pipe(
          filter((x) => !this.gasPriceInput.errors),
          tap((value) => this.customGasPrice = value)
        )
      }),
      tap((gasPrice: string) => {
        this.lastSubmittedGasPrice = gasPrice;
        this.gasPriceChange.next(gasPrice);
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );

  }

  ngOnDestroy() {
    //this.subscription.unsubscribe();
  }
}
