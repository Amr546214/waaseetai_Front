import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { scrollFocus } from '../../shared/forms/form-error-focus';
import { CreateDisputePayload, DisputeFieldError, DisputeStageOption, REQUESTED_RESOLUTIONS, RequestedResolutionCode, STAGE_DISPUTE_MIN_DESCRIPTION } from '../../core/models/dispute.model';

export type DisputeActor = 'client' | 'provider';

const FILE_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;

@Component({
	selector: 'app-dispute-modal',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './dispute-modal.html',
	styleUrl: './dispute-modal.css',
})
export class DisputeModal implements OnChanges {
	@Input() open = false;
	@Input() isSubmitting = false;
	@Input() actor: DisputeActor = 'client';
	/** Server rejection message (e.g. 403/400 from the API), shown inside the dialog. */
	@Input() errorMessage = '';
	/** Per-field problems from the server (`errors:[{field,message}]`), shown under the matching field. */
	@Input() fieldErrors: DisputeFieldError[] = [];
	/** The project's stages with the server's own eligibility. Empty = the project has no stage to choose (project-level dispute). */
	@Input() stages: DisputeStageOption[] = [];
	/** Stage to preselect (e.g. the one the user opened the dialog from); ignored when it is not eligible. */
	@Input() presetStageId: string | null = null;

	@Output() close = new EventEmitter<void>();
	@Output() submit = new EventEmitter<CreateDisputePayload>();

	stageId = signal('');
	reason = signal('');
	description = signal('');
	requested = signal<RequestedResolutionCode | ''>('');
	files = signal<File[]>([]);
	stageError = signal('');
	reasonError = signal('');
	descriptionError = signal('');
	requestedError = signal('');
	evidenceError = signal('');
	formError = signal('');

	readonly MAX_FILES = MAX_FILES;
	readonly MIN_STAGE_DESCRIPTION = STAGE_DISPUTE_MIN_DESCRIPTION;

	/** A project with stages must name one; a project with none keeps the older project-level dispute. */
	hasStages = computed(() => this.stages.length > 0);
	/** The server asks for the long explanation only when the dispute is about a stage. */
	minDescription = computed(() => (this.stageId() ? STAGE_DISPUTE_MIN_DESCRIPTION : 10));
	resolutionOptions = computed(() => REQUESTED_RESOLUTIONS[this.actor]);
	eligibleCount = computed(() => this.stages.filter((s) => s.canDispute).length);

	private lastFingerprint = '';
	private submissionKey = '';

	ngOnChanges(changes: SimpleChanges): void {
		if (changes['open'] && this.open) this.preselectStage();
		if (changes['fieldErrors']) this.applyServerErrors();
	}

	private preselectStage(): void {
		const eligible = this.stages.filter((s) => s.canDispute);
		const preset = this.presetStageId && eligible.find((s) => s.id === this.presetStageId);
		this.stageId.set(preset ? preset.id : eligible.length === 1 ? eligible[0].id : '');
	}

	private applyServerErrors(): void {
		for (const e of this.fieldErrors || []) {
			if (e.field === 'stageId') this.stageError.set(e.message);
			else if (e.field === 'reason') this.reasonError.set(e.message);
			else if (e.field === 'description') this.descriptionError.set(e.message);
			else if (e.field === 'requestedResolution') this.requestedError.set(e.message);
		}
	}

	closeModal(): void {
		if (this.isSubmitting) return;
		this.reset();
		this.close.emit();
	}

	onSubmit(): void {
		if (this.isSubmitting) return;

		this.formError.set('');
		this.stageError.set('');
		this.reasonError.set('');
		this.descriptionError.set('');
		this.requestedError.set('');

		const reason = this.reason().trim();
		const description = this.description().trim();
		const stageId = this.stageId();
		let hasError = false;

		if (this.hasStages() && this.eligibleCount() > 0 && !stageId) {
			this.stageError.set('اختر المرحلة المعنية بالنزاع');
			hasError = true;
		}

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

		const min = this.minDescription();
		if (!description) {
			this.descriptionError.set('الرجاء إدخال وصف المشكلة');
			hasError = true;
		} else if (description.length < min) {
			this.descriptionError.set(`وصف المشكلة يجب ألا يقل عن ${min} حرف (الآن ${description.length})`);
			hasError = true;
		} else if (description.length > 10000) {
			this.descriptionError.set('وصف المشكلة طويل جدًا');
			hasError = true;
		}

		if (stageId && !this.requested()) {
			this.requestedError.set('اختر الحل الذي تطلبه');
			hasError = true;
		}

		if (hasError) {
			// First problem in page order gets the cursor, below the sticky header.
			const first = this.stageError() ? 'dp-stage' : this.reasonError() ? 'dp-reason' : this.descriptionError() ? 'dp-desc' : 'dp-requested';
			const el = document.getElementById(first);
			if (el) scrollFocus(el);
			return;
		}

		const files = this.files();
		// The same content keeps ONE key (a retry after a lost answer returns the dispute already created); changed content gets a new key.
		const fingerprint = JSON.stringify([stageId, reason, description, this.requested(), files.map((f) => [f.name, f.size, f.lastModified])]);
		if (!this.submissionKey || fingerprint !== this.lastFingerprint) {
			this.submissionKey = crypto.randomUUID();
			this.lastFingerprint = fingerprint;
		}

		this.submit.emit({
			reason,
			description,
			stageId: stageId || undefined,
			requestedResolution: this.requested() || undefined,
			files: files.length ? files : undefined,
			submissionKey: this.submissionKey,
		});
	}

	onStageChange(event: Event): void {
		this.stageId.set((event.target as HTMLSelectElement).value);
		this.stageError.set('');
		if (this.descriptionError()) this.descriptionError.set('');
	}

	onPresetReasonChange(event: Event): void {
		const select = event.target as HTMLSelectElement;
		const val = select.value;
		if (val && val !== 'other') {
			this.reason.set(val);
			if (this.reasonError()) this.reasonError.set('');
		} else if (val === 'other') {
			this.reason.set('');
		}
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

	onRequestedChange(event: Event): void {
		this.requested.set((event.target as HTMLSelectElement).value as RequestedResolutionCode | '');
		this.requestedError.set('');
	}

	onFilesPicked(event: Event): void {
		const input = event.target as HTMLInputElement;
		const next = [...this.files(), ...Array.from(input.files || [])];
		input.value = '';
		this.evidenceError.set('');
		if (next.length > MAX_FILES) { this.evidenceError.set('الحد الأقصى خمسة ملفات'); return; }
		if (next.some((f) => !FILE_TYPES.includes(f.type))) { this.evidenceError.set('الملفات المقبولة: JPG أو PNG أو PDF فقط'); return; }
		if (next.some((f) => !f.size || f.size > MAX_FILE_BYTES)) { this.evidenceError.set('حجم كل ملف يجب ألا يتجاوز 10 ميجابايت'); return; }
		this.files.set(next);
	}

	removeFile(index: number): void {
		this.files.update((list) => list.filter((_, i) => i !== index));
		this.evidenceError.set('');
	}

	sizeLabel(file: File): string {
		return file.size >= 1024 * 1024 ? `${(file.size / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(file.size / 1024))} KB`;
	}

	reset(): void {
		this.stageId.set('');
		this.reason.set('');
		this.description.set('');
		this.requested.set('');
		this.files.set([]);
		this.stageError.set('');
		this.reasonError.set('');
		this.descriptionError.set('');
		this.requestedError.set('');
		this.evidenceError.set('');
		this.formError.set('');
		this.lastFingerprint = '';
		this.submissionKey = '';
	}
}
