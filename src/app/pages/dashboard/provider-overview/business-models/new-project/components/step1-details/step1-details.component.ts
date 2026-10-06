import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
	selector: 'app-step1-details',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './step1-details.component.html',
	styleUrl: './step1-details.component.css'
})
export class Step1DetailsComponent {
	@Input({ required: true }) projectName!: string;
	@Input({ required: true }) projectDesc!: string;
	@Input({ required: true }) descCount!: number;
	@Input({ required: true }) isStreamingText!: boolean;
	@Input({ required: true }) isAiEnhancing!: boolean;
	@Input({ required: true }) isAiSuggesting!: boolean;
	/** Message of a failed AI stream (null when there is none). */
	@Input() aiStreamError: string | null = null;

	@Output() projectNameChange = new EventEmitter<string>();
	@Output() projectDescChange = new EventEmitter<string>();
	@Output() onAiAssist = new EventEmitter<'improve' | 'suggest'>();
	@Output() onRetryAi = new EventEmitter<void>();

	updateName(event: Event) {
		this.projectNameChange.emit((event.target as HTMLInputElement).value);
	}

	updateDesc(event: Event) {
		this.projectDescChange.emit((event.target as HTMLTextAreaElement).value);
	}

	aiAssist(mode: 'improve' | 'suggest') {
		this.onAiAssist.emit(mode);
	}
}
