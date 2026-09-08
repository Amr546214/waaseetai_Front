import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CreateDisputePayload } from '../../core/models/dispute.model';

export type DisputeActor = 'client' | 'provider';

@Component({
	selector: 'app-dispute-modal',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './dispute-modal.html',
	styleUrl: './dispute-modal.css',
})
export class DisputeModal {
	@Input() open = false;
	@Input() isSubmitting = false;
	@Input() actor: DisputeActor = 'client';

	@Output() close = new EventEmitter<void>();
	@Output() submit = new EventEmitter<CreateDisputePayload>();

	reason = signal('');
	description = signal('');
	evidenceUrls = signal<string[]>([]);
	newEvidenceUrl = signal('');
	reasonError = signal('');
	descriptionError = signal('');
	evidenceError = signal('');
	formError = signal('');

	readonly MAX_EVIDENCE = 10;

	closeModal(): void {
		if (this.isSubmitting) return;
		this.reset();
		this.close.emit();
	}

	onSubmit(): void {
		if (this.isSubmitting) return;

		this.formError.set('');
		this.reasonError.set('');
		this.descriptionError.set('');
		this.evidenceError.set('');

		const reason = this.reason().trim();
		const description = this.description().trim();

		let hasError = false;

		if (!reason) {
			this.reasonError.set('الرجاء إدخال سبب النزاع');
			hasError = true;
		} else if (reason.length < 2) {
			this.reasonError.set('سبب النزاع يجب أن يكون حرفين على الأقل');
			hasError = true;
		} else if (reason.length > 120) {
			this.reasonError.set('سبب النزاع يجب ألا يتجاوز 120 حرفًا');
			hasError = true;
		}

		if (!description) {
			this.descriptionError.set('الرجاء إدخال تفاصيل النزاع');
			hasError = true;
		} else if (description.length < 10) {
			this.descriptionError.set('تفاصيل النزاع يجب أن تكون 10 أحرف على الأقل');
			hasError = true;
		} else if (description.length > 10000) {
			this.descriptionError.set('تفاصيل النزاع طويلة جدًا');
			hasError = true;
		}

		const evidence = this.evidenceUrls().filter((u) => u.trim().length > 0);
		for (const url of evidence) {
			if (!this.isValidUrl(url)) {
				this.evidenceError.set('أحد روابط الأدلة غير صالح. تأكد من إدخال رابط كامل يبدأ بـ http أو https');
				hasError = true;
				break;
			}
		}

		if (hasError) return;

		this.submit.emit({
			reason,
			description,
			evidence: evidence.length > 0 ? evidence : undefined,
		});
	}

	addEvidenceUrl(): void {
		const url = this.newEvidenceUrl().trim();
		if (!url) return;
		if (this.evidenceUrls().length >= this.MAX_EVIDENCE) {
			this.evidenceError.set('الحد الأقصى 10 روابط أدلة');
			return;
		}
		if (!this.isValidUrl(url)) {
			this.evidenceError.set('الرابط غير صالح. تأكد من إدخال رابط كامل يبدأ بـ http أو https');
			return;
		}
		this.evidenceError.set('');
		this.evidenceUrls.update((urls) => [...urls, url]);
		this.newEvidenceUrl.set('');
	}

	removeEvidenceUrl(index: number): void {
		this.evidenceUrls.update((urls) => urls.filter((_, i) => i !== index));
		this.evidenceError.set('');
	}

	onReasonInput(event: Event): void {
		const value = (event.target as HTMLTextAreaElement | HTMLInputElement).value;
		this.reason.set(value);
		if (this.reasonError()) this.reasonError.set('');
	}

	onDescriptionInput(event: Event): void {
		const value = (event.target as HTMLTextAreaElement).value;
		this.description.set(value);
		if (this.descriptionError()) this.descriptionError.set('');
	}

	onNewEvidenceInput(event: Event): void {
		const value = (event.target as HTMLInputElement).value;
		this.newEvidenceUrl.set(value);
		if (this.evidenceError()) this.evidenceError.set('');
	}

	private isValidUrl(url: string): boolean {
		try {
			const parsed = new URL(url);
			return parsed.protocol === 'http:' || parsed.protocol === 'https:';
		} catch {
			return false;
		}
	}

	reset(): void {
		this.reason.set('');
		this.description.set('');
		this.evidenceUrls.set([]);
		this.newEvidenceUrl.set('');
		this.reasonError.set('');
		this.descriptionError.set('');
		this.evidenceError.set('');
		this.formError.set('');
	}
}
