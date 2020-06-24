import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { merge, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, map, tap } from 'rxjs/operators';
import { LocalStorage } from 'ngx-webstorage';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'oi-slippage-settings',
  templateUrl: './slippage-settings.component.html',
  styleUrls: ['./slippage-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlippageSettingsComponent implements OnInit, OnDestroy {

  public form = new FormGroup({
    slippageSelect: new FormControl(''),
    slippageInput: new FormControl('', [
      Validators.pattern('^[0-9.]*$'),
      Validators.max(50)
    ])
  });
  private subscription: Subscription;

  get slippageInput(): AbstractControl {
    return this.form.controls.slippageInput;
  }

  get slippageSelect(): AbstractControl {
    return this.form.controls.slippageSelect;
  }


  // Be aware, it's not actual double way binding at the moment.
  // Because component read value only once at initTime
  // That could be improved later on once we have demand fo this
  @Input()
  slippage: string;

  @Output()
  slippageChange = new EventEmitter<string>();

  selectSlippage(slippage: string) {

    if (this.isPreDefinedSlippageValue(slippage)) {
      this.showCustomSlippageInput = false;
      this.form.setValue({
        slippageSelect: slippage,
        slippageInput: ''
      });
    } else {
      this.slippageSelect.setValue('custom');
      this.slippageInput.setValue(slippage);
      this.showCustomSlippageInput = true;
    }
  }

  isPreDefinedSlippageValue(value: string): boolean {
    return ['0.1', '0.5', '1', '3'].indexOf(value) !== -1;
  }

  showCustomSlippageInput: boolean;

  ngOnInit(): void {

    console.log('set=' + this.slippage);
    this.selectSlippage(this.slippage);

    const slippageInput$ = this.slippageInput.valueChanges.pipe(
      filter((x) => !this.slippageInput.errors),
      map(x => {
        // In case user input empty string, take latest selected or maximal
        return x === ''
          ? this.slippageSelect.value || '3'
          : x;
      })
    );

    const slippageSelect$ = this.slippageSelect.valueChanges.pipe(
      filter(x => x !== 'custom')
    );

    this.subscription = merge(slippageSelect$, slippageInput$).pipe(
      distinctUntilChanged(),
      tap((latest: string) => {
        this.slippage = latest;
        this.slippageChange.next(latest);
      })
    ).subscribe();
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
