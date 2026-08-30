import { Component, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-withdraw',
  standalone: true,
  imports: [RouterLink, CommonModule],
  templateUrl: './withdraw.html',
})
export class Withdraw {
  balance = signal(3240.00);
  withdrawAmount = signal(1000);
  selectedMethod = signal('card');
  termsAccepted = signal(false);

  showOTP = signal(false);
  showSuccess = signal(false);

  amountString = computed(() => {
    return this.withdrawAmount().toLocaleString('en-US');
  });

  setAmount(val: number) {
    this.withdrawAmount.set(val);
  }

  setAmountStr(event: Event) {
    const target = event.target as HTMLInputElement;
    const v = parseInt(target.value.replace(/\D/g, ''), 10) || 0;
    this.withdrawAmount.set(v);
  }

  setMethod(method: string) {
    this.selectedMethod.set(method);
  }

  toggleTerms() {
    this.termsAccepted.update(v => !v);
  }

  openOTP() {
    this.showOTP.set(true);
  }

  closeOTP() {
    this.showOTP.set(false);
  }

  confirmWithdraw() {
    this.showOTP.set(false);
    this.showSuccess.set(true);
  }
}
