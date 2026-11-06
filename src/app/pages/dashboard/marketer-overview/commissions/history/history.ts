import { Component } from '@angular/core';
import { WalletHistoryComponent } from '../../../../../shared/wallet/wallet-history.component';

/** Standalone history of the marketer's commissions and withdrawals (real data only; the marketer has no wallet page of its own). */
@Component({
  selector: 'app-marketer-history',
  standalone: true,
  imports: [WalletHistoryComponent],
  template: '<app-wallet-history role="marketer" />',
})
export class MarketerHistory {}
