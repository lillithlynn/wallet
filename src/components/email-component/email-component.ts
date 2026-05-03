import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { ExternalLinkProvider } from '../../providers/external-link/external-link';
import { ActionSheetParent } from '../action-sheet/action-sheet-parent';

@Component({
  selector: 'email-component',
  templateUrl: 'email-component.html'
})
export class EmailComponent extends ActionSheetParent {
  public emailForm: FormGroup;

  constructor(private externalLinkProvider: ExternalLinkProvider) {
    super();
    this.emailForm = new FormGroup({
      email: new FormControl(
        '',
        Validators.compose([
          Validators.required,
          Validators.pattern(
            /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/
          )
        ])
      ),
      agreement: new FormControl(false, Validators.requiredTrue)
    });
  }

  ionViewDidLoad() {
    this.emailForm.setValue({
      email: ''
    });
  }

  public optionClicked(): void {
    this.dismiss(this.emailForm.value.email);
  }

  public openPolicy() {
    let url = 'https://bitpay.com/about/privacy';
    this.externalLinkProvider.open(url);
  }
}
