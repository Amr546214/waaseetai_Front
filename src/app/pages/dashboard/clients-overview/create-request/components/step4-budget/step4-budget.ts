import { WsCurrencyPipe } from '../../../../../../shared/money/money.pipe';
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import type { CreateRequest } from '../../create-request';

@Component({
	selector: 'app-step4-budget',
	standalone: true,
	imports: [CommonModule, FormsModule, WsCurrencyPipe],
	templateUrl: './step4-budget.html',
})
export class Step4Budget {
	@Input({ required: true }) parent!: CreateRequest;
}
