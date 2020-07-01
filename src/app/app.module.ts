import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HttpClientModule } from '@angular/common/http';

import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';

import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SlippageSettingsComponent } from './slippage-settings/slippage-settings.component';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { NgxWebstorageModule } from 'ngx-webstorage';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search';
import { MatExpansionModule } from '@angular/material/expansion';
import { GasSettingsComponent } from 'src/app/gas-settings/gas-settings.component';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';


@NgModule({
    declarations: [
        AppComponent,
        SlippageSettingsComponent,
        GasSettingsComponent
    ],
    imports: [
        BrowserModule,
        AppRoutingModule,
        HttpClientModule,
        BrowserAnimationsModule,
        MatButtonModule,
        MatSelectModule,
        FormsModule,
        ReactiveFormsModule,
        MatInputModule,
        MatFormFieldModule,
        MatTooltipModule,
        MatIconModule,
        MatRadioModule,
        NgxWebstorageModule.forRoot(),
        MatAutocompleteModule,
        NgxMatSelectSearchModule,
        MatExpansionModule,
        FontAwesomeModule
    ],
    providers: [],
    bootstrap: [AppComponent]
})
export class AppModule {
}
