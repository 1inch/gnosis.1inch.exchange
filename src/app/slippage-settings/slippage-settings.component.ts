import {
    ChangeDetectionStrategy,
    Component,
    EventEmitter,
    Input,
    OnDestroy,
    OnInit,
    Output
} from '@angular/core';
import { AbstractControl, FormControl, FormGroup, Validators } from '@angular/forms';
import { merge, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, filter, map, tap } from 'rxjs/operators';

@Component({
    // tslint:disable-next-line:component-selector
    selector: 'oi-slippage-settings',
    templateUrl: './slippage-settings.component.html',
    styleUrls: ['./slippage-settings.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SlippageSettingsComponent implements OnInit, OnDestroy {

    private form = new FormGroup({
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

    // error2text(errors: any): string {
    //   let text = '';
    //   if(errors.pattern){
    //     text += 'Not valid value!. Only numeric value is allowed!'
    //   }
    //   if() {
    //
    //   }
    // }


    // Be aware, it's not actual double way binding at the moment.
    // Because component read value only once at initTime
    // That could be improved later on once we have demand fo this
    @Input()
    slippage: number;
    @Output()
    slippageChange = new EventEmitter<number>();

    isSelected(value: number): boolean {
        return !this.slippageInput.value && this.slippageSelect.value === value;
    }

    selectSlippage(slippage: number) {
        this.form.setValue({
            slippageSelect: slippage,
            slippageInput: ''
        });
    }

    ngOnInit(): void {

        // Init view as pre-selected button value OR value in input
        const buttonExists = [0.1, 0.5, 1, 3].indexOf(this.slippage) !== -1;
        if (buttonExists) {
            this.slippageSelect.setValue(this.slippage);
        } else {
            this.slippageInput.setValue(this.slippage);
        }

        this.subscription = merge(
            this.slippageSelect.valueChanges,
            this.slippageInput.valueChanges.pipe(
                debounceTime(200),
                filter((x) => !this.slippageInput.errors),
                map(x => {
                    // In case user input empty string, take latest selected or maximal
                    return x === ''
                        ? this.slippageSelect.value || 3
                        : +x;
                })
            ),
        ).pipe(
            distinctUntilChanged(),
            tap((latest: number) => {
                this.slippage = latest;
                this.slippageChange.next(latest);
            })
        ).subscribe();
    }

    ngOnDestroy() {
        this.subscription.unsubscribe();
    }
}
