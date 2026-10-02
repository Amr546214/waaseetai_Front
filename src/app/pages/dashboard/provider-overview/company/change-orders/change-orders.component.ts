import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

// AI Cleanup Batch 2: this page used to render a fully hardcoded mock dataset.
// No backend capability backs it yet, so it now shows an honest "not available"
// state instead (see the template comment for what is missing).
@Component({
	selector: 'app-change-orders',
	standalone: true,
	imports: [RouterModule],
	templateUrl: './change-orders.component.html',
	styleUrls: ['./change-orders.component.css']
})
export class ChangeOrdersComponent {}
