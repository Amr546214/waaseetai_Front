import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WsBasePipe, WsCurrencyPipe } from '../../../../../../../shared/money/money.pipe';

@Component({
	selector: 'app-step4-stages',
	standalone: true,
	imports: [WsBasePipe, WsCurrencyPipe, CommonModule],
	templateUrl: './step4-stages.component.html',
	styleUrl: './step4-stages.component.css'
})
export class Step4StagesComponent {
	@Input({ required: true }) totalAmount!: number | null;
	@Input({ required: true }) stages!: any[];
	@Input({ required: true }) isAiSuggestingMilestones!: boolean;
	@Input({ required: true }) totalPercentage!: number;
	@Input({ required: true }) totalDays!: number;

	@Output() onTotalAmountChange = new EventEmitter<number | null>();
	@Output() onSuggestMilestones = new EventEmitter<void>();
	@Output() onAddStage = new EventEmitter<void>();
	@Output() onRemoveStage = new EventEmitter<number>();
	@Output() onUpdateStage = new EventEmitter<{ index: number, field: string, value: any }>();

	updateTotalAmount(event: Event) {
		const val = (event.target as HTMLInputElement).value;
		this.onTotalAmountChange.emit(val === '' ? null : Number(val));
	}

	updateStage(index: number, field: string, event: Event) {
		const val = (event.target as HTMLInputElement).value;
		// Numeric fields stay empty (null) until the user types: an empty box is never turned into 0.
		this.onUpdateStage.emit({ index, field, value: field === 'days' || field === 'percentage' ? (val === '' ? null : Number(val)) : val });
	}

	getAmountForStage(percentage: number): number {
		return ((this.totalAmount ?? 0) * (percentage || 0)) / 100;
	}
}
