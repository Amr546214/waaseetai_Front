import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { EvaluationData } from '../../new';

@Component({
	selector: 'app-step3-evaluation',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './step3-evaluation.component.html',
})
export class Step3EvaluationComponent {
	@Input({ required: true }) isAnalyzing!: boolean;
	@Input({ required: true }) hasError!: string | null;
	@Input({ required: true }) evaluationResult!: EvaluationData | null;
	/** Set when the sample was stored and is waiting for the Waseet team's manual review (the normal outcome today). */
	@Input() manualReviewNotice: string | null = null;

	@Output() onRetry = new EventEmitter<void>();
	@Output() onViewAll = new EventEmitter<void>();

	submitForAiEvaluation() {
		this.onRetry.emit();
	}

	viewAllAccreditationSamples() {
		this.onViewAll.emit();
	}
}
