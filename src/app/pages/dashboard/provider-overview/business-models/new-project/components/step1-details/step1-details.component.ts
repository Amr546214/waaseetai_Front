import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SEED_HONESTY_NOTE, type AiSuggestion } from '../../ai-description';

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
	/** Live text of the running request: shown in the suggestions area only, never in the description field. */
	@Input() aiStreamPreview = '';
	@Input() aiSuggestions: AiSuggestion[] = [];
	@Input() aiAppliedId: string | null = null;
	/** Suggestions were generated from the title/form data only (empty field): shows the honesty note. */
	@Input() aiFromContext = false;
	readonly honestyNote = SEED_HONESTY_NOTE;
	/** True only while the field still holds the text it had when the request started (drives «نصّك الأصلي محفوظ»). */
	@Input() aiOriginalPreserved = false;
	@Input() descMax = 1500;

	@Output() projectNameChange = new EventEmitter<string>();
	@Output() projectDescChange = new EventEmitter<string>();
	@Output() onAiAssist = new EventEmitter<void>();
	@Output() onUseSuggestion = new EventEmitter<string>();
	@Output() onDismissSuggestions = new EventEmitter<void>();
	@Output() onRetryAi = new EventEmitter<void>();

	updateName(event: Event) {
		this.projectNameChange.emit((event.target as HTMLInputElement).value);
	}

	updateDesc(event: Event) {
		this.projectDescChange.emit((event.target as HTMLTextAreaElement).value);
	}

	/** The single AI action: empty field -> generate from the title, field with text -> improve it (decided by the page). */
	aiAssist() {
		this.onAiAssist.emit();
	}

	/** Which of the two labels the single button shows. */
	get improveMode(): boolean {
		return this.projectDesc.trim().length >= 10;
	}
}
