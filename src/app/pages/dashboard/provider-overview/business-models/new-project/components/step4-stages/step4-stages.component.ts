import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
	selector: 'app-step4-stages',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './step4-stages.component.html',
	styleUrl: './step4-stages.component.css'
})
export class Step4StagesComponent {
	@Input({ required: true }) totalAmount!: number;
	@Input({ required: true }) stages!: any[];
	@Input({ required: true }) isAiSuggestingMilestones!: boolean;
	@Input({ required: true }) totalPercentage!: number;
	@Input({ required: true }) totalDays!: number;

	@Output() onTotalAmountChange = new EventEmitter<number>();
	@Output() onSuggestMilestones = new EventEmitter<void>();
	@Output() onAddStage = new EventEmitter<void>();
	@Output() onRemoveStage = new EventEmitter<number>();
	@Output() onUpdateStage = new EventEmitter<{ index: number, field: string, value: any }>();

	updateTotalAmount(event: Event) {
		const val = (event.target as HTMLInputElement).value;
		this.onTotalAmountChange.emit(Number(val) || 0);
	}

	updateStage(index: number, field: string, event: Event) {
		const val = (event.target as HTMLInputElement).value;
		this.onUpdateStage.emit({ index, field, value: val });
	}

	getAmountForStage(percentage: number): number {
		return (this.totalAmount * (percentage || 0)) / 100;
	}
}
