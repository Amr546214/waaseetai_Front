import { Component, signal, computed, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Step1SpecialtyComponent } from './components/step1-specialty/step1-specialty.component';
import { Step2UploadComponent } from './components/step2-upload/step2-upload.component';
import { Step3EvaluationComponent } from './components/step3-evaluation/step3-evaluation.component';
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

	currentStep = signal<number>(1);
	isLoading = signal<boolean>(true);
	isAnalyzing = signal<boolean>(false);
	hasError = signal<string | null>(null);

	categories = signal<SpecialtyCategory[]>([]);
	hasAccreditedSpecialties = signal<boolean>(false);

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

	// Form Agreement Checkboxes
	declaredAccuracy = signal<boolean>(true);
	agreedToTerms = signal<boolean>(true);

	ngOnInit() {
		this.fetchSpecialties();
	}

	fetchSpecialties() {
		this.isLoading.set(true);
		this.providerApi.getPassedSpecialties().subscribe({
			next: (res) => {
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
				(this.attachments().length > 0 || this.isValidHttpUrl(this.projectUrl()) || this.isValidHttpUrl(this.githubUrl()));
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
		} else if (this.currentStep() === 2 && this.isValidStep2) {
			this.submitForAiEvaluation();
		}
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
		if (!this.isValidStep2) return;

		this.isAnalyzing.set(true);
		this.hasError.set(null);
		this.currentStep.set(3);
		window.scrollTo(0, 0);

		const spec = this.getSelectedSpecialty();

			const payload = new FormData();
			payload.append('providerSpecialtyId', spec?.id || this.selectedSpecialtyId()!);
			payload.append('title', this.title().trim());
			payload.append('description', this.description().trim());
			payload.append('technologiesUsed', JSON.stringify(this.technologiesUsed()));
			if (this.projectUrl().trim()) payload.append('projectUrl', this.projectUrl().trim());
			if (this.githubUrl().trim()) payload.append('githubUrl', this.githubUrl().trim());
			this.attachments().forEach(attachment => {
				if (attachment.file) payload.append('files', attachment.file, attachment.name);
			});

		this.providerApi.submitAccreditationSample(payload).subscribe({
			next: (res) => {
				this.isAnalyzing.set(false);
				if (res && res.success && res.data) {
					if (res.data.evaluation) {
						this.evaluationResult.set(res.data.evaluation);
					} else {
						// Sample stored for manual review; no AI evaluation was produced.
						this.hasError.set(res.data.aiEvaluation?.message || res.message || 'تم استلام النموذج وسيُراجع يدوياً؛ التقييم الآلي متوقف مؤقتاً.');
					}
				} else {
					this.hasError.set(res.message || 'تعذر إكمال فحص الذكاء الاصطناعي');
				}
			},
			error: (err) => {
				console.error('AI Evaluation error:', err);
				this.isAnalyzing.set(false);
				this.hasError.set('حدث خطأ أثناء الاتصال بمحرك التقييم الآلي. يرجى المحاولة لاحقاً.');
			}
		});
	}

	viewAllAccreditationSamples() {
			this.router.navigate(['/provider-overview/business-models/accreditation/list']);
		}
}
