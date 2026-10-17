import type { RegisteredSpecialty } from '../../../../../../core/utils/specialty-states';
import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { mapHttpError } from '../../../../../../core/forms/http-error';
import { focusFirstInvalid } from '../../../../../../core/forms/form-helpers';
import { Step1SpecialtyComponent } from './components/step1-specialty/step1-specialty.component';
import { Step2UploadComponent } from './components/step2-upload/step2-upload.component';
import { Step3EvaluationComponent } from './components/step3-evaluation/step3-evaluation.component';
import { PROVIDER_ACCOUNT_ACTIONS_URL, ProviderAccessService } from '../../../../../../core/services/provider-access.service';
import { ProviderApiService } from '../../../../../../core/services/provider-api.service';

export interface Specialty {
	id: string;
	specialtyId: string;
	name: string;
	icon: string;
	score: number;
	passedAt: string;
	accreditationStatus: string;
	subSpecialties: string[];
}

export interface SpecialtyCategory {
	categoryId: string;
	categoryName: string;
	specialties: Specialty[];
}

export interface AttachmentFile {
	id: string;
	name: string;
	size: string;
	url: string;
	type: string;
	file?: File;
}

export interface EvaluationData {
	aiScore: number;
	status: 'AI_VERIFIED' | 'REJECTED' | 'MANUAL_REVIEW';
	aiQualityRating: 'EXCELLENT' | 'ACCEPTABLE' | 'POOR';
	feedbackAr: string;
	strengths: string[];
	recommendations: string[];
	specialtyName?: string;
	auditedAt?: string;
}

@Component({
	selector: 'app-business-models-accreditation-new',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterLink, Step1SpecialtyComponent, Step2UploadComponent, Step3EvaluationComponent],
	templateUrl: './new.html',
	styleUrl: './new.css'
})
export class New implements OnInit, OnDestroy {
	private providerApi = inject(ProviderApiService);
	private router = inject(Router);
	private access = inject(ProviderAccessService);
	private route = inject(ActivatedRoute);

	currentStep = signal<number>(1);
	isLoading = signal<boolean>(true);
	isAnalyzing = signal<boolean>(false);
	hasError = signal<string | null>(null);

	categories = signal<SpecialtyCategory[]>([]);
	hasAccreditedSpecialties = signal<boolean>(false);
	registeredSpecialties = signal<RegisteredSpecialty[]>([]);

	// Step 1 State
	selectedSpecialtyId = signal<string | null>(null);
	selectedSubSpecialties = signal<string[]>([]);

	// Step 2 Form State
	title = signal<string>('');
	description = signal<string>('');
	techInput = signal<string>('');
	technologiesUsed = signal<string[]>([]);
	projectUrl = signal<string>('');
	githubUrl = signal<string>('');
	attachments = signal<AttachmentFile[]>([]);

	// Step 3 AI Result State
	evaluationResult = signal<EvaluationData | null>(null);
	manualReviewNotice = signal<string | null>(null);

	// Form Agreement Checkboxes
	declaredAccuracy = signal<boolean>(true);
	agreedToTerms = signal<boolean>(true);

	// Batch B T1: completing / re-submitting an existing request («استكمال البيانات»): the SAME request opens with its previous data
	resubmitId = signal<string | null>(null);
	existingProofs = signal<{ id: string; fileName: string; bytes: number }[]>([]);
	highlightFields = signal<string[]>([]);
	adminNote = signal<string | null>(null);
	fieldErrors = signal<Record<string, string>>({});
	loadError = signal<string | null>(null);

	ngOnInit() {
		const resubmit = this.route.snapshot.queryParamMap.get('resubmit');
		if (resubmit) { this.loadCompletion(resubmit); return; }
		this.fetchSpecialties();
	}

	private loadCompletion(id: string) {
		this.isLoading.set(true);
		this.providerApi.getAccountActionCompletion(id).subscribe({
			next: res => {
				const d = res?.data;
				if (!d) { this.loadError.set('تعذّر تحميل بيانات الطلب'); this.isLoading.set(false); return; }
				this.resubmitId.set(d.id);
				this.title.set(d.model?.title ?? '');
				this.description.set(d.model?.description ?? '');
				this.technologiesUsed.set(Array.isArray(d.model?.technologiesUsed) ? d.model.technologiesUsed : []);
				this.projectUrl.set(d.model?.projectUrl ?? '');
				this.githubUrl.set(d.model?.githubUrl ?? '');
				this.existingProofs.set(Array.isArray(d.attachments) ? d.attachments : []);
				this.highlightFields.set(Array.isArray(d.completionFields) ? d.completionFields : []);
				this.adminNote.set(d.adminNote ?? null);
				// the request is tied to its specialty: no free choice, the step 1 selection is the request's own
				this.selectedSpecialtyId.set(d.specialty?.providerSpecialtyId ?? null);
				this.lockedSpecialtyName.set(d.specialty?.nameAr ?? null);
				this.currentStep.set(2);
				this.isLoading.set(false);
			},
			error: err => {
				const m = mapHttpError(err, { fallback: 'تعذّر فتح الطلب للاستكمال' });
				this.loadError.set(m.message);
				this.isLoading.set(false);
			}
		});
	}
	lockedSpecialtyName = signal<string | null>(null);

	removeExistingProof(id: string) {
		this.providerApi.deleteAccreditationProof(id).subscribe({
			next: () => this.existingProofs.update(list => list.filter(p => p.id !== id)),
			error: err => this.fieldErrors.update(e => ({ ...e, files: mapHttpError(err, { fallback: 'تعذّر حذف الملف' }).message }))
		});
	}


	fetchSpecialties() {
		this.isLoading.set(true);
		this.providerApi.getPassedSpecialties().subscribe({
			next: (res) => {
				this.registeredSpecialties.set(Array.isArray(res?.registered) ? res.registered : []);
				if (res && res.success) {
					this.hasAccreditedSpecialties.set(!!res.hasAccreditedSpecialties && res.categories?.length > 0);
					this.categories.set(res.categories || []);
					// Do not auto-select any specialty by default, let the user choose
					this.selectedSpecialtyId.set(null);
					this.selectedSubSpecialties.set([]);
				} else {
					this.hasAccreditedSpecialties.set(false);
					this.categories.set([]);
					this.selectedSpecialtyId.set(null);
					this.selectedSubSpecialties.set([]);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Error fetching specialties:', err);
				this.hasAccreditedSpecialties.set(false);
				this.categories.set([]);
				this.selectedSpecialtyId.set(null);
				this.selectedSubSpecialties.set([]);
				this.isLoading.set(false);
			}
		});
	}

	toggleSpecialty(id: string) {
		if (this.selectedSpecialtyId() === id) {
			this.selectedSpecialtyId.set(null);
			this.selectedSubSpecialties.set([]);
		} else {
			this.selectedSpecialtyId.set(id);
			const spec = this.getSelectedSpecialtyById(id);
			if (spec && spec.subSpecialties?.length > 0) {
				this.selectedSubSpecialties.set([spec.subSpecialties[0]]);
			} else {
				this.selectedSubSpecialties.set([]);
			}
		}
	}

	toggleSubSpecialty(sub: string) {
		const subs = this.selectedSubSpecialties();
		if (subs.includes(sub)) {
			this.selectedSubSpecialties.set(subs.filter(s => s !== sub));
		} else {
			this.selectedSubSpecialties.set([...subs, sub]);
		}
	}

	getSelectedSpecialtySubs(): string[] {
		const spec = this.getSelectedSpecialty();
		return spec?.subSpecialties || [];
	}

	getSelectedSpecialty(): Specialty | undefined {
		const id = this.selectedSpecialtyId();
		if (!id) return undefined;
		return this.getSelectedSpecialtyById(id);
	}

	private getSelectedSpecialtyById(id: string): Specialty | undefined {
		for (const cat of this.categories()) {
			const spec = cat.specialties.find(s => s.id === id || s.specialtyId === id);
			if (spec) return spec;
		}
		return undefined;
	}

	// Tech Tag Management
	addTechTag() {
		const val = this.techInput().trim();
		if (val && !this.technologiesUsed().includes(val)) {
			this.technologiesUsed.update(tags => [...tags, val]);
			this.techInput.set('');
		}
	}

	removeTechTag(tag: string) {
		this.technologiesUsed.update(tags => tags.filter(t => t !== tag));
	}

	// File Handling
	onFileSelected(event: any) {
		const files: FileList = event.target.files;
		if (files && files.length > 0) {
			this.processSelectedFiles(files);
		}
	}

	handleDrop(event: DragEvent) {
		event.preventDefault();
		const files = event.dataTransfer?.files;
		if (files && files.length > 0) {
			this.processSelectedFiles(files);
		}
	}

	private processSelectedFiles(files: FileList) {
		const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'application/pdf', 'application/zip', 'application/x-zip-compressed']);
		const availableSlots = Math.max(0, 10 - this.attachments().length);
			for (let i = 0; i < Math.min(files.length, availableSlots); i++) {
				const file = files[i];
				if (!allowedTypes.has(file.type) || file.size > 15 * 1024 * 1024) continue;
					const attachment: AttachmentFile = {
						id: crypto.randomUUID(),
						name: file.name,
						size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
						url: URL.createObjectURL(file),
						type: file.type,
						file
					};
					this.attachments.update(att => [...att, attachment]);
			}
		}

	removeAttachment(id: string) {
		const attachment = this.attachments().find(item => item.id === id);
		if (attachment?.url.startsWith('blob:')) URL.revokeObjectURL(attachment.url);
		this.attachments.update(att => att.filter(a => a.id !== id));
	}

	ngOnDestroy(): void {
		this.attachments().forEach(attachment => {
			if (attachment.url.startsWith('blob:')) URL.revokeObjectURL(attachment.url);
		});
	}

	// Step Validations
	get isValidStep1() {
		return this.selectedSpecialtyId() !== null;
	}

	get isValidStep2() {
			return this.title().trim().length >= 3 &&
				this.description().trim().length >= 10 &&
				this.technologiesUsed().length > 0 &&
				// Batch B T1 (§3): a proof FILE is mandatory (a link alone is not a document)
				(this.attachments().length + this.existingProofs().length > 0);
		}

	private isValidHttpUrl(value: string): boolean {
		if (!value.trim()) return false;
		try {
			return ['http:', 'https:'].includes(new URL(value.trim()).protocol);
		} catch {
			return false;
		}
	}

	get isCurrentStepValid() {
		if (this.currentStep() === 1) return this.isValidStep1;
		if (this.currentStep() === 2) return this.isValidStep2;
		return true;
	}

	goNext() {
		if (this.currentStep() === 1 && this.isValidStep1) {
			this.currentStep.set(2);
			window.scrollTo(0, 0);
		} else if (this.currentStep() === 2) {
			// an invalid step never silently does nothing: each missing field is named at its input and the first one is focused
			if (!this.isValidStep2) { this.showStep2Errors(); return; }
			this.submitForAiEvaluation();
		}
	}

	private showStep2Errors() {
		const e: Record<string, string> = {};
		if (this.title().trim().length < 3) e['title'] = 'عنوان النموذج مطلوب (3 أحرف على الأقل)';
		if (this.description().trim().length < 10) e['description'] = 'الوصف الفني مطلوب (10 أحرف على الأقل)';
		if (this.technologiesUsed().length === 0) e['technologiesUsed'] = 'أضف تقنية واحدة على الأقل';
		if (this.attachments().length + this.existingProofs().length === 0) e['files'] = 'ارفع ملف إثبات واحدًا على الأقل (صورة أو PDF أو ZIP حتى 15 ميجابايت)';
		this.fieldErrors.set(e);
		this.focusInvalidSoon();
	}

	private focusInvalidSoon() {
		setTimeout(() => focusFirstInvalid(document.querySelector('app-step2-upload')), 0);
	}

	goPrev() {
		if (this.currentStep() > 1 && !this.isAnalyzing()) {
			this.currentStep.update(v => v - 1);
			window.scrollTo(0, 0);
		}
	}

	/**
	 * Submits Accreditation Work Sample to backend & runs Gemini Evaluation
	 */
	submitForAiEvaluation() {
		if (!this.isValidStep2 || this.isAnalyzing()) return; // one request at a time (no double click)
		this.fieldErrors.set({});

		this.isAnalyzing.set(true);
		this.hasError.set(null);
		this.manualReviewNotice.set(null);
		this.currentStep.set(3);
		window.scrollTo(0, 0);

		const spec = this.getSelectedSpecialty();

			const payload = new FormData();
			payload.append('providerSpecialtyId', spec?.id || this.selectedSpecialtyId()!);
			if (this.resubmitId()) payload.append('resubmitSampleId', this.resubmitId()!);
			if (this.existingProofs().length) payload.append('proofIds', JSON.stringify(this.existingProofs().map(p => p.id)));
			payload.append('title', this.title().trim());
			payload.append('description', this.description().trim());
			payload.append('technologiesUsed', JSON.stringify(this.technologiesUsed()));
			if (this.projectUrl().trim()) payload.append('projectUrl', this.projectUrl().trim());
			if (this.githubUrl().trim()) payload.append('githubUrl', this.githubUrl().trim());
			this.attachments().forEach(attachment => {
				if (attachment.file) payload.append('files', attachment.file, attachment.name);
			});

		this.providerApi.submitAccreditationRequest(payload).subscribe({
			next: (res) => {
				this.isAnalyzing.set(false);
				if (res && res.success && res.data) {
					this.afterSampleSubmitted(res.data?.sample?.id);
					if (res.data.evaluation) {
						this.evaluationResult.set(res.data.evaluation);
					} else {
						// The sample is stored with status MANUAL_REVIEW (accreditation-ai.service.ts); no AI evaluation is produced.
						// This is a successful submission, not an error — so it is shown as such (and "retry" would only create a duplicate).
						this.manualReviewNotice.set('تم استلام نموذجك وتحويله للمراجعة اليدوية من فريق وسيط. ستظهر حالته ونتيجته في قائمة نماذج الاعتماد.');
					}
				} else {
					this.hasError.set(res.message || 'تعذّر إرسال النموذج للمراجعة');
				}
			},
			error: (err) => {
				this.isAnalyzing.set(false);
				const m = mapHttpError(err, { fallback: 'حدث خطأ أثناء إرسال النموذج. يرجى المحاولة لاحقاً.' });
				// the server names the field (files, title, description...): back to the form, shown at the input, everything the user entered is kept
				const fields = Object.fromEntries(Object.entries(m.fieldErrors ?? {}).filter(([k]) => ['title', 'description', 'files', 'projectUrl', 'githubUrl', 'technologiesUsed', 'providerSpecialtyId'].includes(k)));
				if (Object.keys(fields).length) {
					this.fieldErrors.set(fields);
					this.hasError.set(null);
					this.currentStep.set(2);
					this.focusInvalidSoon();
					return;
				}
				// a duplicate / state conflict (409), 429 or a network error stay honest generic messages, never invented field errors
				this.hasError.set(m.message);
			}
		});
	}

	/**
	 * The sample is in: forget the last access answer and re-read it from the backend. A provider who is not approved yet continues on the status page
	 * (what happens next is the backend's say); an approved one stays on this page. A failed read counts as "not approved" (closed).
	 */
	private afterSampleSubmitted(sampleId?: string) {
		// after submitting, the user goes to the REAL log of this request
		const target = sampleId ? `${PROVIDER_ACCOUNT_ACTIONS_URL}/${sampleId}` : PROVIDER_ACCOUNT_ACTIONS_URL;
		this.access.invalidate();
		this.access.load().subscribe({
			next: s => { if (!s.canAccessDashboard) this.router.navigateByUrl(target); },
			error: () => { this.router.navigateByUrl(target); },
		});
	}

	viewAllAccreditationSamples() {
			this.router.navigate(['/provider-overview/business-models/accreditation/list']);
		}
}
