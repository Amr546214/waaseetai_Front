import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';

// There is no provider-invoice endpoint (invoices exist only on the CLIENT side: GET /client/finance/invoices). This page therefore shows no invoices at all —
// it used to render fixed demo rows (invented numbers, clients, tax) with a download button that only showed a toast. Nothing here is invented.
@Component({
	selector: 'app-provider-invoices',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './invoices.html',
	styleUrls: ['./invoices.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class InvoicesComponent {}
