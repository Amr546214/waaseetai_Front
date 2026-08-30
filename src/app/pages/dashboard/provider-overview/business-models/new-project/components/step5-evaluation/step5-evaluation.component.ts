import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
	selector: 'app-step5-evaluation',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './step5-evaluation.component.html',
	styleUrl: './step5-evaluation.component.css'
})
export class Step5EvaluationComponent {
	@Input({ required: true }) isAiAnalyzing!: boolean;
	@Input({ required: true }) aiEvaluation!: any;

	@Output() onApplySuggestedPricing = new EventEmitter<void>();
	@Output() onApplySuggestedMilestones = new EventEmitter<void>();
}
