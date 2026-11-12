import { Component } from '@angular/core';
import { InvoicesComponent } from '../../finance/invoices/invoices';

/** Keep the company route on the same recorded invoices and report exporter as provider finance. */
@Component({
  selector: 'app-official-invoices',
  standalone: true,
  imports: [InvoicesComponent],
  templateUrl: './official-invoices.component.html',
  styleUrls: ['./official-invoices.component.css'],
})
export class OfficialInvoicesComponent {}
