import { Component } from '@angular/core';
import { WalletHistoryComponent } from '../../../../../shared/wallet/wallet-history.component';

/** Standalone full transaction history of the client wallet (the wallet page keeps the «تفصيل المبالغ والخصومات» summary). */
@Component({
  selector: 'app-transactions',
  imports: [WalletHistoryComponent],
  templateUrl: './transactions.html',
  styleUrl: './transactions.css',
})
export class Transactions {

}
