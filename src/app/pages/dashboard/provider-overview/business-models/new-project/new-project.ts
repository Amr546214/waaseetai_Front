import type { RegisteredSpecialty } from '../../../../../core/utils/specialty-states';
import { Component, signal, computed, effect, untracked, OnInit, OnDestroy, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NewProjectService, AiReviewEvaluation } from '../../../../../core/services/new-project.service';
import { SkillsCatalogService } from '../../../../../core/services/skills-catalog.service';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { SEED_CLARIFICATION_MESSAGE, buildDescriptionSeed, AI_EMPTY_OUTPUT_MESSAGE, AI_OUTPUT_TOO_LONG_MESSAGE, AI_WATCHDOG_MESSAGE, AI_WATCHDOG_MS, AiSuggestion, PROJECT_DESC_MAX, checkAiSuggestions } from './ai-description';
import { Step1DetailsComponent } from './components/step1-details/step1-details.component';
import { Step2SpecialtyComponent } from './components/step2-specialty/step2-specialty.component';
import { Step3ModelComponent } from './components/step3-model/step3-model.component';
import { Step4StagesComponent } from './components/step4-stages/step4-stages.component';
import { Step5EvaluationComponent } from './components/step5-evaluation/step5-evaluation.component';
import { isMeaningfulProjectTitle } from '../../../../../core/utils/title-validator';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { FieldProblem, SubmitGuard, reportBackendError, reportProblems } from '../../../../../shared/forms/form-error-focus';
import { mapHttpError } from '../../../../../core/forms/http-error';
export interface PassedSpecialtySubItem {
	id: string;
	specialtyId: string;
	name: string;
	icon: string;
	score: number;
	passedAt?: string;
	accreditationStatus?: string;
	subSpecialties: string[];
}

export interface PassedCategoryItem {
	categoryId: string;
	categoryName: string;
	specialties: PassedSpecialtySubItem[];
}

export interface AccreditationModelItem {
	id: string;
	specialtyId?: string;
	title: string;
	description?: string;
	specialtyName?: string;
	technologies?: string[];
	status: string; // 'AI_VERIFIED' | 'APPROVED' | 'PENDING_AI_AUDIT'
	score: number;
	attachments?: string[];
	coverImage?: string;
	views?: number;
}


@Component({
	selector: 'app-business-models-new-project',
	standalone: true,
	imports: [CommonModule, RouterLink, Step1DetailsComponent, Step2SpecialtyComponent, Step3ModelComponent, Step4StagesComponent, Step5EvaluationComponent],
	templateUrl: './new-project.html',
	styleUrl: './new-project.css',
})
export class NewProject implements OnInit, OnDestroy {
	private newProjectService = inject(NewProjectService);
	private providerApi = inject(ProviderApiService);
	private skillsCatalog = inject(SkillsCatalogService);
	private notify = inject(UiNotificationService);
	private sanitizer = inject(DomSanitizer);
	private router = inject(Router);
	private route = inject(ActivatedRoute);
	private host = inject(ElementRef<HTMLElement>);
	private submitGuard = new SubmitGuard();

	isSvgIcon(iconStr?: string): boolean {
		return !!iconStr && iconStr.includes('<');
	}

	getSanitizedIcon(iconStr?: string): SafeHtml | string {
		if (!iconStr) return '💻';
		if (iconStr.includes('<')) {
			let wrapped = iconStr;
			if (!iconStr.includes('<svg')) {
				wrapped = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 text-[#2BD4C7]">${iconStr}</svg>`;
			}
			return this.sanitizer.bypassSecurityTrustHtml(wrapped);
		}
		return iconStr;
	}

	editServiceId = signal<string | null>(null);
	isEditMode = computed(() => !!this.editServiceId());

	currentStep = signal<number>(1);
	totalSteps = 5;
	isSubmitting = signal<boolean>(false);

	// Step 1 - Name & Description
	projectName = signal('');
	projectDesc = signal('');
	descCount = computed(() => this.projectDesc().length);
	isValidStep1 = computed(() => this.projectName().trim().length > 0 && this.projectDesc().trim().length > 0);

	// Gemini Streaming & Loading States for Step 1
	isAiEnhancing = signal<boolean>(false);
	isAiSuggesting = signal<boolean>(false);
	isStreamingText = signal<boolean>(false);
	/** Set when a stream ends with `error:true` or an unusable result: the field was never touched, a retry is offered. */
	aiStreamError = signal<string | null>(null);
	/** Live text of the running request. Shown ONLY in the suggestions area, never in the description field. */
	aiStreamPreview = signal('');
	/** The complete, validated (<= PROJECT_DESC_MAX) candidates the user can approve, one card each. */
	aiSuggestions = signal<AiSuggestion[]>([]);
	aiAppliedId = signal<string | null>(null);
	readonly descMax = PROJECT_DESC_MAX;
	/** Id of the one request whose events are accepted; any other id (or none active) is a stale event and is ignored. */
	private aiRequestId: string | null = null;
	private aiWatchdog: ReturnType<typeof setTimeout> | null = null;
	/** «نصّك الأصلي محفوظ» is shown only when the field still holds exactly the text it had when the request started. */
	aiOriginalPreserved = computed(() => this.draftBeforeStreamSignal().trim().length > 0 && this.projectDesc() === this.draftBeforeStreamSignal());
	private draftBeforeStreamSignal = signal('');

	updateName(event: Event) { this.projectName.set((event.target as HTMLInputElement).value); }
	updateDesc(event: Event) { this.projectDesc.set((event.target as HTMLTextAreaElement).value); }

	retryAiAssist() { this.aiAssist(); }

	/** True while the shown/running suggestions were generated from the title/form data only (empty field), for the honesty note. */
	aiFromContext = signal(false);

	/** ONE action: a field with text is improved; an EMPTY field is generated through the same enhance path from a seed of what the user provided. */
	aiAssist(_legacyMode?: string) {
		// One request at a time: the button is disabled while one runs, and a stray second call is refused here too.
		if (this.isStreamingText()) return;
		this.aiStreamError.set(null);
		const title = this.projectName().trim();
		const desc = this.projectDesc().trim();
		const improve = desc.length >= 10;

		// Validate title meaningfulness
		if (title) {
			const titleValidation = isMeaningfulProjectTitle(title);
			if (!titleValidation.valid) {
				this.notify.warning(titleValidation.reason ?? 'يرجى كتابة اسم مشروع واضح');
				return;
			}
		}

		// The seed is built ONLY from what the user provided (before any auto-population) and goes to the service only, never into the field.
		let payloadText = this.projectDesc();
		if (!improve) {
			// Only what the user explicitly provided/chose (see userProvided): auto-populated, recommended or defaulted values are NOT facts.
			const u = this.userProvided;
			const spec = u.specialty ? this.selectedMainSpecialtyObj() : null;
			const model = u.model ? this.accreditationModels().find(m => m.id === this.selectedModel()) : undefined;
			const days = u.days ? this.stages().reduce((sum, st) => sum + (Number(st?.days) > 0 ? Number(st.days) : 0), 0) : 0;
			const seed = buildDescriptionSeed({
				title, specialty: spec?.name, subSpecialty: u.subSpecialty ? this.selectedSubSpecialty() : '', model: model?.title,
				skills: u.skills ? this.selectedSkills() : [], budgetUsd: u.budget ? this.totalAmount() : null, days,
			});
			if (seed === null) {
				this.notify.warning(SEED_CLARIFICATION_MESSAGE);
				return;
			}
			payloadText = seed;
		}

		// A new request replaces whatever was shown before: no leftovers, so a retry never duplicates text.
		this.cancelRunningAi();
		this.draftBeforeStreamSignal.set(this.projectDesc());
		this.aiSuggestions.set([]);
		this.aiStreamPreview.set('');
		this.aiAppliedId.set(null);
		this.aiFromContext.set(!improve);
		const requestId = `ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
		this.aiRequestId = requestId;
		this.isStreamingText.set(true);
		this.armAiWatchdog();

		if (improve) {
			this.isAiEnhancing.set(true);
			this.newProjectService.streamEnhanceDescription(title, payloadText, requestId);
			this.notify.info('بدأ الاتصال المباشر لبث تحسين النص باحترافية...');
		} else {
			this.isAiSuggesting.set(true);
			this.newProjectService.streamEnhanceDescription(title, payloadText, requestId, true);
			this.notify.info('بدأ البث المباشر لاقتراح وصف مبني على بيانات مشروعك...');
		}
	}

	/** Applies ONE suggestion: the description becomes exactly that text (no introduction, no other alternatives). */
	useAiSuggestion(id: string) {
		const picked = this.aiSuggestions().find(s => s.id === id);
		if (!picked || this.isStreamingText()) return;
		if (!picked.text.trim() || picked.text.length > PROJECT_DESC_MAX) {
			this.notify.warning(`الاقتراح يتجاوز ${PROJECT_DESC_MAX} حرفاً ولا يمكن استخدامه.`);
			return;
		}
		this.projectDesc.set(picked.text);
		this.aiAppliedId.set(id);
		this.aiStreamError.set(null);
		this.autoPopulateWizardSelections();
		this.autoPopulateMilestonesIfBlank();
		this.notify.success('تم استخدام الاقتراح في حقل الوصف');
	}

	dismissAiSuggestions() {
		if (this.isStreamingText()) return;
		this.aiSuggestions.set([]);
		this.aiStreamPreview.set('');
		this.aiAppliedId.set(null);
	}

	private armAiWatchdog() {
		this.clearAiWatchdog();
		this.aiWatchdog = setTimeout(() => {
			if (!this.aiRequestId) return;
			this.newProjectService.cancelStream?.(this.aiRequestId);
			this.finishAiRequest();
			this.aiStreamPreview.set('');
			this.aiStreamError.set(AI_WATCHDOG_MESSAGE);
		}, AI_WATCHDOG_MS);
	}

	private clearAiWatchdog() {
		if (this.aiWatchdog) { clearTimeout(this.aiWatchdog); this.aiWatchdog = null; }
	}

	/** Stops tracking the running request (later events with its id are ignored) and releases the busy state. */
	private finishAiRequest() {
		this.clearAiWatchdog();
		this.aiRequestId = null;
		this.isStreamingText.set(false);
		this.isAiEnhancing.set(false);
		this.isAiSuggesting.set(false);
	}

	/** Cancels the running request server-side (retry/navigation) and ignores anything it still sends. */
	private cancelRunningAi() {
		if (!this.aiRequestId) return;
		this.newProjectService.cancelStream?.(this.aiRequestId);
		this.finishAiRequest();
	}

	private acceptsAiEvent(requestId: string | undefined): boolean {
		return this.aiRequestId !== null && (requestId === undefined || requestId === this.aiRequestId);
	}

	private computeRecommendedSkills(options: string[]): string[] {
		if (!options.length) return [];
		const picked = new Set<string>();
		for (const sk of this.providerSkills()) {
			if (options.includes(sk)) picked.add(sk);
		}
		const modelTechs = this.accreditationModels().flatMap(m => m.technologies || []);
		const combinedText = `${this.projectName()} ${this.projectDesc()} ${modelTechs.join(' ')}`.toLowerCase();
		const aliases: Record<string, string[]> = {
			'React': ['react', 'react.js', 'reactjs'],
			'Next.js': ['next', 'next.js', 'nextjs'],
			'TypeScript': ['typescript', 'ts'],
			'JavaScript': ['javascript', 'js', 'es6'],
			'HTML': ['html', 'html5', 'واجهة', 'واجهات'],
			'CSS': ['css', 'tailwind', 'sass', 'تجاوب', 'متجاوب'],
			'REST API': ['rest', 'api', 'apis', 'ربط'],
			'Git': ['git', 'github'],
			'اختبار البرمجيات': ['jest', 'test', 'اختبار', 'جودة'],
			'تصميم البنية التقنية': ['معمارية', 'بنية', 'architecture', 'state', 'redux'],
		};
		for (const opt of options) {
			const lowerOpt = opt.toLowerCase();
			if (combinedText.includes(lowerOpt)) {
				picked.add(opt);
				continue;
			}
			const keys = aliases[opt];
			if (keys && keys.some(k => combinedText.includes(k))) {
				picked.add(opt);
			}
		}
		if (picked.size < 5) {
			const defaults = ['HTML', 'CSS', 'JavaScript', 'TypeScript', 'React', 'Next.js', 'REST API', 'Git', 'اختبار البرمجيات', 'تصميم البنية التقنية'];
			for (const d of defaults) {
				if (options.includes(d)) picked.add(d);
				if (picked.size >= 8) break;
			}
		}
		if (picked.size === 0) {
			options.slice(0, 6).forEach(o => picked.add(o));
		}
		return [...picked].slice(0, 12);
	}

	private autoPopulateWizardSelections() {
		const allSpecs = this.specialties();
		if (!this.selectedSpecialty() && allSpecs.length > 0) {
			const first = allSpecs[0];
			this.selectedSpecialty.set(first.id || first.specialtyId);
		}
		const mainObj = this.selectedMainSpecialtyObj();
		if (mainObj && mainObj.subSpecialties?.length > 0 && !this.selectedSubSpecialty()) {
			this.selectedSubSpecialty.set(mainObj.subSpecialties[0]);
		}
		if (this.skillOptions().length > 0 && this.selectedSkills().length === 0) {
			this.selectedSkills.set(this.computeRecommendedSkills(this.skillOptions()));
		} else if (this.selectedSkills().length === 0) {
			this.suggestSkillsOnLoad = true;
		}
		if (!this.selectedModel()) {
			const validModels = this.filteredModels();
			const fallbackApproved = this.accreditationModels().filter(m => m.status === 'AI_VERIFIED' || m.status === 'APPROVED');
			const chosen = validModels[0] || fallbackApproved[0];
			if (chosen) this.selectedModel.set(chosen.id);
		}
	}

	private autoPopulateMilestonesIfBlank() {
		const currentStages = this.stages();
		const isBlankStages = currentStages.length === 1 && !String(currentStages[0]?.title ?? '').trim();
		if (!isBlankStages || this.isAiSuggestingMilestones()) return;
		if (!this.projectName().trim() || !this.projectDesc().trim()) return;
		if (!this.totalAmount() || (this.totalAmount() ?? 0) <= 0) {
			this.totalAmount.set(1000);
		}
		this.suggestMilestonesWithAi(true);
	}

	// Step 2 - Specialization (Accredited Main & Sub Specialties)
	passedCategories = signal<PassedCategoryItem[]>([]);
	specialties = computed(() => this.passedCategories().flatMap(c => c.specialties));
	isLoadingSpecialties = signal<boolean>(true);
	hasAccreditedSpecialties = signal<boolean>(true);
	/** Every specialty registered on the account with its state (signup choices included), for the empty-state message. */
	registeredSpecialties = signal<RegisteredSpecialty[]>([]);

	selectedSpecialty = signal<string>(''); // Main Passed Specialty ID
	selectedSubSpecialty = signal<string>(''); // Selected Sub-specialty name

	selectedMainSpecialtyObj = computed<PassedSpecialtySubItem | null>(() => {
		const selId = this.selectedSpecialty();
		if (!selId) return null;
		for (const cat of this.passedCategories()) {
			const found = cat.specialties.find(s => s.id === selId || s.specialtyId === selId);
			if (found) return found;
		}
		return null;
	});

	/** True only when the CURRENTLY selected main specialty really has sub-specialties: the star, aria-required and the validator all read this. */
	mainHasSubSpecialties = computed(() => (this.selectedMainSpecialtyObj()?.subSpecialties?.length ?? 0) > 0);
	/** The sub-specialty that counts: a value left over from a specialty without (or with other) sub-specialties is never submitted. */
	effectiveSubSpecialty = computed(() => {
		const sub = this.selectedSubSpecialty();
		return sub && (this.selectedMainSpecialtyObj()?.subSpecialties ?? []).includes(sub) ? sub : '';
	});

	isValidStep2 = computed(() => {
		if (!this.selectedSpecialty()) return false;
		const mainObj = this.selectedMainSpecialtyObj();
		if (mainObj && mainObj.subSpecialties && mainObj.subSpecialties.length > 0) {
			return this.effectiveSubSpecialty() !== '';
		}
		return true;
	});

	// Skills of the chosen specialty (single source: the backend skills catalog of the specialty's category).
	skillOptions = signal<string[]>([]);
	selectedSkills = signal<string[]>([]);
	skillsLoading = signal<boolean>(false);
	skillsError = signal<string>('');
	/** The provider's saved profile skills: offered as the starting selection after the specialty is picked. */
	private providerSkills = signal<string[]>([]);
	private suggestSkillsOnLoad = false;
	private skillsCategoryKey = '';

	private selectedCategoryId = computed<string>(() => {
		const selId = this.selectedSpecialty();
		if (!selId) return '';
		for (const cat of this.passedCategories()) {
			if (cat.specialties.some(s => s.id === selId || s.specialtyId === selId)) return cat.categoryId || cat.categoryName || '';
		}
		return '';
	});

	private readonly skillsOptionsEffect = effect(() => {
		const key = this.selectedCategoryId();
		untracked(() => this.loadSkillOptions(key));
	});

	private loadSkillOptions(key: string) {
		if (key === this.skillsCategoryKey) return;
		this.skillsCategoryKey = key;
		if (!key) { this.skillOptions.set([]); this.skillsLoading.set(false); return; }
		this.skillsLoading.set(true);
		this.skillsCatalog.getCatalog(key).subscribe({
			next: res => {
				if (key !== this.skillsCategoryKey) return;
				const options = res?.success ? (res.data?.skills ?? []) : [];
				this.skillOptions.set(options);
				this.skillsLoading.set(false);
				if (this.suggestSkillsOnLoad || (this.selectedSkills().length === 0 && this.projectDesc().trim().length > 0)) {
					this.suggestSkillsOnLoad = false;
					this.selectedSkills.set(this.computeRecommendedSkills(options));
				}
			},
			error: () => {
				if (key !== this.skillsCategoryKey) return;
				this.skillOptions.set([]);
				this.skillsLoading.set(false);
				this.skillsError.set('تعذر تحميل مهارات هذا المجال، حاول مرة أخرى لاحقًا.');
			}
		});
	}

	/**
	 * Provenance of the wizard values: true ONLY when the user explicitly typed/chose that value. Anything auto-populated, defaulted, recommended,
	 * prefilled or restored from a draft stays false, and is therefore never presented as a fact in the AI seed.
	 */
	private userProvided = { specialty: false, subSpecialty: false, model: false, skills: false, budget: false, days: false };

	onSkillsChange(list: string[]) {
		this.userProvided.skills = list.length > 0;
		this.skillsError.set('');
		this.selectedSkills.set(list.slice(0, 30));
	}

	selectMainSpecialty(spec: PassedSpecialtySubItem) {
		const next = spec.id || spec.specialtyId;
		const changed = next !== this.selectedSpecialty();
		this.selectedSpecialty.set(next);
		this.userProvided.specialty = true;
		if (changed) {
			this.userProvided.skills = false; // the list is reset/recommended below: not the user's choice
			this.selectedSkills.set([]);
			this.skillsError.set('');
			if (this.selectedCategoryId() === this.skillsCategoryKey && !this.skillsLoading()) {
				this.selectedSkills.set(this.computeRecommendedSkills(this.skillOptions()));
			} else {
				this.suggestSkillsOnLoad = true;
			}
		}
		this.selectedSubSpecialty.set(spec.subSpecialties?.[0] ?? '');
		this.userProvided.subSpecialty = false; // the first sub-specialty is a default until the user picks one
		this.userProvided.model = false; // the matching model is linked automatically
		const matchingModel = this.accreditationModels().find(
			m => m.specialtyId === spec.specialtyId && (m.status === 'AI_VERIFIED' || m.status === 'APPROVED')
		);
		this.selectedModel.set(matchingModel?.id ?? '');
	}

	selectSubSpecialty(sub: string) {
		this.userProvided.subSpecialty = true;
		this.selectedSubSpecialty.set(sub);
	}

	loadPassedSpecialties() {
		this.isLoadingSpecialties.set(true);
		this.providerApi.getPassedSpecialties().subscribe({
			next: (res) => {
				this.isLoadingSpecialties.set(false);
				this.registeredSpecialties.set(Array.isArray(res?.registered) ? res.registered : []);
				if (res && res.success && Array.isArray(res.categories) && res.categories.length > 0) {
					this.passedCategories.set(res.categories);
					this.hasAccreditedSpecialties.set(true);
					if (this.projectDesc().trim().length > 0 || !this.selectedSpecialty()) {
						this.autoPopulateWizardSelections();
					}
				} else {
					this.passedCategories.set([]);
					this.hasAccreditedSpecialties.set(false);
				}
			},
			error: (err) => {
				console.warn('Error fetching passed specialties', err);
				this.isLoadingSpecialties.set(false);
				this.passedCategories.set([]);
				this.hasAccreditedSpecialties.set(false);
			}
		});
	}

	// Step 3 - Model Selection (Accredited Samples)
	accreditationModels = signal<AccreditationModelItem[]>([]);
	models = computed(() => this.accreditationModels());
	isLoadingModels = signal<boolean>(true);
	modelFilter = signal<'all' | 'verified'>('all');
	selectedModel = signal<string>('');

	filteredModels = computed(() => {
			const filter = this.modelFilter();
			const selectedSpecialtyId = this.selectedMainSpecialtyObj()?.specialtyId;
			const list = selectedSpecialtyId
				? this.accreditationModels().filter(model => model.specialtyId === selectedSpecialtyId)
				: this.accreditationModels();
		// Batch B T1 (§5): only an APPROVED model of the chosen specialty can be linked to a service (the server enforces the same rule)
		void filter;
		return list.filter(m => m.status === 'AI_VERIFIED' || m.status === 'APPROVED');
	});

	verifiedModelsCount = computed(() => {
		return this.accreditationModels().filter(m => m.status === 'AI_VERIFIED' || m.status === 'APPROVED').length;
	});

	accreditedCount = computed(() => {
		return this.accreditationModels().filter(m => m.status === 'AI_VERIFIED' || m.status === 'APPROVED').length;
	});

	distinctSpecialtiesCount = computed(() => {
			const specs = new Set(this.accreditationModels().map(m => m.specialtyName).filter(Boolean));
			return specs.size;
	});

	totalViewsCount = computed(() => {
		return this.accreditationModels().reduce((sum, m) => sum + (m.views || 0), 0);
	});

	averageAiScore = computed(() => {
			const list = this.accreditationModels();
			if (list.length === 0) return 0;
		const sum = list.reduce((acc, m) => acc + (m.score || 0), 0);
		return Math.round(sum / list.length);
	});

	isValidStep3 = computed(() => {
		const selectedSpecialtyId = this.selectedMainSpecialtyObj()?.specialtyId;
		return this.accreditationModels().some(model =>
			model.id === this.selectedModel() &&
			model.specialtyId === selectedSpecialtyId &&
			(model.status === 'AI_VERIFIED' || model.status === 'APPROVED')
		);
	});

	/** server field errors (Batch B T1) shown next to the field's step */
	modelError = signal('');
	specialtyError = signal('');
	galleryUrls = signal<string[]>([]);
	isUploadingImage = signal<boolean>(false);

	selectModel(id: string) {
		this.modelError.set('');
		this.userProvided.model = true;
		this.selectedModel.set(id);
	}

	setModelFilter(filter: 'all' | 'verified') {
		this.modelFilter.set(filter);
	}

	onGalleryFileSelected(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			const file = input.files[0];
			this.isUploadingImage.set(true);
			this.newProjectService.uploadGalleryImage(file).subscribe({
				next: (res) => {
					this.isUploadingImage.set(false);
					if (res && res.urls && res.urls.length > 0) {
						this.galleryUrls.update(arr => [...arr, res.urls[0]]);
						this.notify.success('تم رفع الصورة بنجاح');
					}
				},
				error: (err) => {
					this.isUploadingImage.set(false);
					this.notify.warning('حدث خطأ أثناء رفع الصورة');
					console.error(err);
				}
			});
		}
		// Reset input so the same file can be selected again
		input.value = '';
	}

	removeGalleryImage(index: number) {
		this.galleryUrls.update(arr => arr.filter((_, i) => i !== index));
	}

	getFirstImage(sample: any): string | null {
		if (!sample) return null;
		if (sample.coverImage && typeof sample.coverImage === 'string') return sample.coverImage;

		let list: any[] = [];
		if (typeof sample.attachments === 'string') {
			try {
				list = JSON.parse(sample.attachments);
			} catch {
				if (sample.attachments.trim().length > 0) {
					list = [sample.attachments];
				}
			}
		} else if (Array.isArray(sample.attachments)) {
			list = sample.attachments;
		}

		for (const item of list) {
			const url = typeof item === 'string' ? item : (item?.url || item?.path || item?.fileUrl);
			if (typeof url === 'string' && url.length > 5) {
				if (url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://') || url.match(/\.(jpg|jpeg|png|webp|gif|svg)$/i)) {
					return url;
				}
			}
		}

		return null;
	}

	loadAccreditationModels() {
		this.isLoadingModels.set(true);
		this.providerApi.getAccreditationSamples().subscribe({
			next: (res) => {
				this.isLoadingModels.set(false);
				if (res && res.success && Array.isArray(res.samples) && res.samples.length > 0) {
						const mapped: AccreditationModelItem[] = res.samples.map((s: any) => ({
							id: s.id,
							specialtyId: s.providerSpecialty?.specialty?.id || s.providerSpecialty?.specialtyId,
						title: s.title,
						description: s.description,
						specialtyName: s.providerSpecialty?.specialty?.nameAr || s.providerSpecialty?.specialty?.name || 'تخصص معتمد',
						technologies: Array.isArray(s.technologiesUsed) ? s.technologiesUsed : (s.technologiesUsed ? [s.technologiesUsed] : ['تقنيات حديثة']),
							status: s.status || 'PENDING_AI_AUDIT',
							score: Math.round(s.aiScore || 0),
						attachments: s.attachments || [],
						views: Number(s.views || s.viewsCount || s.viewCount || 0)
					}));
					this.accreditationModels.set(mapped);
					this.autoPopulateWizardSelections();
					if (this.projectDesc().trim().length > 0) {
						this.autoPopulateMilestonesIfBlank();
					}

				} else {
					this.setFallbackAccreditationModels();
				}
			},
			error: (err) => {
				console.warn('Error fetching accreditation samples, loading fallback', err);
				this.isLoadingModels.set(false);
				this.setFallbackAccreditationModels();
			}
		});
	}

	private setFallbackAccreditationModels() {
		const fallbackModels: AccreditationModelItem[] = [
			// No sample data: when the samples request fails the list is honestly empty.
		];
		this.accreditationModels.set(fallbackModels);
		if (!this.isEditMode() && !this.selectedModel() && fallbackModels.length > 0) {
			this.selectedModel.set(fallbackModels[0].id);
		}
	}

	// Step 4 - Stages & Milestones
	// Starts empty: the provider types the budget and the durations (no invented amount). A single stage is always 100% of the budget.
	totalAmount = signal<number | null>(null);
	stages = signal<any[]>([
		{ title: '', desc: '', days: null, percentage: 100 }
	]);
	isAiSuggestingMilestones = signal<boolean>(false);

	suggestMilestonesWithAi(silent = false) {
		if (!this.projectName().trim()) {
			if (!silent) this.notify.warning('يرجى كتابة اسم المشروع في الخطوة الأولى أولاً ليقوم الذكاء بإنشاء المراحل المناسبة له');
			return;
		}
		if (!this.totalAmount() || (this.totalAmount() ?? 0) <= 0) {
			if (!silent) {
				this.notify.warning('يرجى تحديد القيمة الإجمالية للمشروع ($) أولاً ليتمكن الذكاء الاصطناعي من توزيع نسب ومبالغ المراحل بدقة');
				const el = this.host.nativeElement.querySelector('#np-total-amount') as HTMLElement | null;
				el?.focus();
			}
			return;
		}
		this.isAiSuggestingMilestones.set(true);
		if (!silent) this.notify.info('يقوم المستشار الذكي الآن بتحليل مشروعك وهندسة المراحل الأنسب...');

		this.newProjectService.suggestMilestones(this.projectName(), this.projectDesc(), this.totalAmount() ?? undefined).subscribe({
			next: (res) => {
				this.isAiSuggestingMilestones.set(false);
				if (res?.data?.milestones && Array.isArray(res.data.milestones) && res.data.milestones.length > 0) {
					const mapped = res.data.milestones.map((m: any) => ({
						title: m.title || 'مرحلة جديدة',
						desc: m.description || m.desc || '',
						days: Number(m.estimatedDays || m.days) || null,
						percentage: Number(m.percentage) || 0
					}));
					this.stages.set(mapped);
					if (!silent) this.notify.success('تم إنشاء هيكل مراحل العمل وتوزيع النسب بذكاء بناءً على وصف مشروعك!');
				}
			},
			error: (err) => {
				this.isAiSuggestingMilestones.set(false);
				console.error('AI suggest milestones error', err);
				if (!silent) this.notify.warning(err?.error?.message || 'لم يتم الاتصال بالخادم الذكي، يمكنك إضافة المراحل يدوياً');
			}
		});
	}

	addStage() {
		this.stages.update(s => [...s, { title: '', desc: '', days: null, percentage: null }]);
	}

	removeStage(index: number) {
		this.stages.update(s => s.filter((_, i) => i !== index));
	}

	setTotalAmountByUser(value: number | null) {
		this.userProvided.budget = (value ?? 0) > 0;
		this.totalAmount.set(value);
	}

	updateStage(index: number, field: string, value: any) {
		if (field === 'days') this.userProvided.days = Number(value) > 0;
		this.stages.update(s => {
			const newStages = [...s];
			newStages[index] = { ...newStages[index], [field]: value };
			return newStages;
		});
	}

	totalPercentage = computed(() => this.stages().reduce((sum, s) => sum + (Number(s.percentage) || 0), 0));
	totalDays = computed(() => this.stages().reduce((sum, s) => sum + (Number(s.days) || 0), 0));
	isValidStep4 = computed(() => (this.totalAmount() ?? 0) > 0 && this.totalPercentage() === 100 && this.stages().length > 0
		&& this.stages().every(s => String(s.title ?? '').trim() && Number(s.percentage) > 0 && Number(s.days) > 0));

	getAmountForStage(percentage: number): number {
		return ((this.totalAmount() ?? 0) * (percentage || 0)) / 100;
	}

	// Step 5 - AI Review & Orchestration
	isValidStep5 = computed(() => !this.isAiAnalyzing());
	isAiAnalyzing = signal<boolean>(false);
	aiEvaluation = signal<AiReviewEvaluation | null>(null);
	private readonly draftStorageKey = 'waseet_new_project_draft_v1';
	private isHydrated = false;

	private readonly persistDraftEffect = effect(() => {
		const draft = {
			step: this.currentStep(),
			projectName: this.projectName(),
			projectDesc: this.projectDesc(),
			selectedSpecialty: this.selectedSpecialty(),
			selectedSubSpecialty: this.selectedSubSpecialty(),
			selectedSkills: this.selectedSkills(),
			selectedModel: this.selectedModel(),
			totalAmount: this.totalAmount(),
			stages: this.stages(),
			galleryUrls: this.galleryUrls(),
			aiEvaluation: this.aiEvaluation(),
		};
		if (!this.isHydrated || this.isEditMode()) return;
		try {
			sessionStorage.setItem(this.draftStorageKey, JSON.stringify(draft));
		} catch { /* ignore storage errors */ }
	});

	private syncStepInUrl(step: number) {
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { step },
			queryParamsHandling: 'merge',
			replaceUrl: true,
		});
	}

	private restoreDraft(): number | null {
		try {
			const raw = sessionStorage.getItem(this.draftStorageKey);
			if (!raw) return null;
			const parsed = JSON.parse(raw);
			if (typeof parsed.projectName === 'string') this.projectName.set(parsed.projectName);
			if (typeof parsed.projectDesc === 'string') this.projectDesc.set(parsed.projectDesc);
			if (typeof parsed.selectedSpecialty === 'string') this.selectedSpecialty.set(parsed.selectedSpecialty);
			if (typeof parsed.selectedSubSpecialty === 'string') this.selectedSubSpecialty.set(parsed.selectedSubSpecialty);
			if (Array.isArray(parsed.selectedSkills)) this.selectedSkills.set(parsed.selectedSkills);
			if (typeof parsed.selectedModel === 'string') this.selectedModel.set(parsed.selectedModel);
			if (typeof parsed.totalAmount === 'number') this.totalAmount.set(parsed.totalAmount);
			if (Array.isArray(parsed.stages) && parsed.stages.length > 0) this.stages.set(parsed.stages);
			if (Array.isArray(parsed.galleryUrls)) this.galleryUrls.set(parsed.galleryUrls);
			if (parsed.aiEvaluation && typeof parsed.aiEvaluation === 'object') this.aiEvaluation.set(parsed.aiEvaluation);
			return typeof parsed.step === 'number' && parsed.step >= 1 && parsed.step <= 5 ? parsed.step : null;
		} catch {
			return null;
		}
	}

	private clearDraft() {
		try { sessionStorage.removeItem(this.draftStorageKey); } catch { /* ignore */ }
	}

	ngOnInit() {
		// Initialize Socket listeners for Real-time word-by-word streaming
		this.newProjectService.initSocket();

		this.newProjectService.onStreamStart((data) => {
			if (!this.acceptsAiEvent(data?.requestId)) return;
			this.isStreamingText.set(true);
			this.armAiWatchdog();
		});

		this.newProjectService.onStreamChunk((data) => {
			if (!this.acceptsAiEvent(data?.requestId)) return;
			this.armAiWatchdog();
			// The live text goes to the suggestions area only: the user's own description is untouched until a complete valid suggestion is approved.
			const cleanChunk = (data.chunk || '').replace(/\*\*/g, '');
			this.aiStreamPreview.update(current => current + cleanChunk);
		});

		this.newProjectService.onStreamEnd((data) => {
			if (!this.acceptsAiEvent(data?.requestId)) return;
			const preview = this.aiStreamPreview();
			this.finishAiRequest();
			this.aiStreamPreview.set('');
			if (data.error === true) {
				// Failed stream: the field was never touched; the live text is dropped and a retry is offered.
				this.aiSuggestions.set([]);
				this.aiStreamError.set(data.message || 'تعذّر إكمال الاقتراح. يمكنك إعادة المحاولة.');
				return;
			}
			// Client-side gate: only complete, non-empty candidates within the limit can ever be approved.
			const checked = checkAiSuggestions(data.candidates, preview, PROJECT_DESC_MAX);
			if (!checked.suggestions.length) {
				this.aiSuggestions.set([]);
				this.aiStreamError.set(checked.rejectedTooLong > 0 ? AI_OUTPUT_TOO_LONG_MESSAGE : AI_EMPTY_OUTPUT_MESSAGE);
				return;
			}
			this.aiStreamError.set(null);
			this.aiSuggestions.set(checked.suggestions);
			// Neutral: nothing is applied yet, so no success wording (the backend's «تم تحسين...» is not shown).
			this.notify.info(checked.suggestions.length === 1 ? 'اقتراح جاهز للمراجعة' : 'اقتراحات جاهزة للمراجعة');
		});

		const editId = this.route.snapshot.queryParamMap.get('edit') || this.route.snapshot.queryParamMap.get('id');
		if (!editId) {
			const savedStep = this.restoreDraft();
			const urlStep = Number(this.route.snapshot.queryParamMap.get('step'));
			const initialStep = (urlStep >= 1 && urlStep <= 5) ? urlStep : (savedStep ?? 1);
			this.currentStep.set(initialStep);
			this.syncStepInUrl(initialStep);
			if (initialStep === 5 && !this.aiEvaluation() && this.isValidStep1() && this.isValidStep4()) {
				this.triggerAiReviewAnalysis();
			}
		}
		this.isHydrated = true;

		// Check query parameters for edit mode
		this.route.queryParams.subscribe(params => {
			const eid = params['edit'] || params['id'];
			if (eid && eid !== this.editServiceId()) {
				this.editServiceId.set(eid);
				this.loadExistingService(eid);
			}
		});

		// The provider's saved skills (suggested as the starting selection); an honest empty list when unavailable.
		this.skillsCatalog.getProviderMine().subscribe({
			next: res => this.providerSkills.set(res?.success ? (res.data?.skills ?? []) : []),
			error: () => this.providerSkills.set([])
		});

		// Fetch Passed Accredited Specialties for Step 2
		this.loadPassedSpecialties();

		// Fetch Accredited Samples (models) for Step 3
		this.loadAccreditationModels();
	}

	loadExistingService(serviceId: string) {
		this.newProjectService.getServiceById(serviceId).subscribe({
			next: (res) => {
				const service = res?.data || res;
				if (!service) return;

				this.projectName.set(service.title || '');

				let cleanDesc = service.description || '';
				const subMatch = cleanDesc.match(/\[تخصص فرعي:\s*(.*?)\]/);
				if (subMatch && subMatch[1]) {
					this.selectedSubSpecialty.set(subMatch[1].trim());
				}
				cleanDesc = cleanDesc.replace(/\n\[تخصص:.*\]/g, '').replace(/\n\[تخصص فرعي:.*\]/g, '').trim();
				this.projectDesc.set(cleanDesc);

				if (service.totalAmount) {
					this.totalAmount.set(Number(service.totalAmount));
				}

				if (service.specialtyId || service.specialty?.id) {
					const specId = service.specialtyId || service.specialty?.id;
					this.selectedSpecialty.set(specId);

					// Sub-specialty auto-selection removed as per user request
				}

					if (service.portfolioItemId || service.portfolioItem?.id) {
						this.selectedModel.set(service.portfolioItemId || service.portfolioItem?.id);
					}
					if (service.accreditationSampleId || service.accreditationSample?.id) {
						this.selectedModel.set(service.accreditationSampleId || service.accreditationSample?.id);
					}

				if (Array.isArray(service.skills)) {
					this.suggestSkillsOnLoad = false;
					this.selectedSkills.set(service.skills.filter((x: unknown): x is string => typeof x === 'string'));
				}

				if (service.gallery && Array.isArray(service.gallery)) {
					this.galleryUrls.set(service.gallery);
				}

				if (service.stages && Array.isArray(service.stages) && service.stages.length > 0) {
					const mappedStages = service.stages.map((stg: any) => ({
						title: stg.title || '',
						desc: stg.description || stg.desc || '',
						days: Number(stg.deliveryDays || stg.days) || null,
						percentage: Number(stg.percentage || 0)
					}));
					this.stages.set(mappedStages);
				}

				this.notify.info('تم تحميل تفاصيل النموذج للتعديل');
			},
			error: (err) => console.error('Failed to load existing service for editing:', err)
		});
	}

	ngOnDestroy(): void {
		this.cancelRunningAi();
		this.clearAiWatchdog();
		this.newProjectService.disconnectSocket();
	}

	// Navigation
	get isCurrentStepValid() {
		switch (this.currentStep()) {
			case 1: return this.isValidStep1();
			case 2: return this.isValidStep2();
			case 3: return this.isValidStep3();
			case 4: return this.isValidStep4();
			case 5: return this.isValidStep5();
			default: return false;
		}
	}

	/** What is missing in the CURRENT step, in page order, each tied to its control (ids in the step components). */
	stepProblems(step = this.currentStep()): FieldProblem[] {
		const out: FieldProblem[] = [];
		if (step === 1) {
			if (!this.projectName().trim()) out.push({ field: 'np-name', message: 'اكتب اسم المشروع', label: 'اسم المشروع', step });
			if (!this.projectDesc().trim()) out.push({ field: 'np-desc', message: 'اكتب وصف المشروع', label: 'وصف المشروع', step });
		} else if (step === 2) {
			if (!this.selectedSpecialty()) out.push({ field: 'np-specialty', message: 'اختر تخصصاً رئيسياً للمتابعة', label: 'التخصص', step });
			else if (!this.isValidStep2()) out.push({ field: 'np-subspecialty', message: 'اختر تخصصاً فرعياً للمتابعة', label: 'التخصص الفرعي', step });
		} else if (step === 3) {
			if (!this.isValidStep3()) out.push({ field: 'np-model', message: 'اختر نموذجاً من معرض أعمالك للمتابعة', label: 'النموذج', step });
		} else if (step === 4) {
			if (!((this.totalAmount() ?? 0) > 0)) out.push({ field: 'np-total-amount', message: 'أدخل الميزانية الإجمالية بالدولار (أكبر من صفر)', label: 'الميزانية', step });
			this.stages().forEach((s, i) => {
				if (!String(s.title ?? '').trim()) out.push({ field: `np-stage-title-${i}`, message: 'اكتب عنوان المرحلة', step });
				if (!(Number(s.days) > 0)) out.push({ field: `np-stage-days-${i}`, message: 'أدخل مدة التسليم بالأيام', step });
				if (!(Number(s.percentage) > 0)) out.push({ field: `np-stage-percentage-${i}`, message: 'أدخل نسبة المرحلة', step });
			});
			if (this.totalPercentage() !== 100 && this.stages().every(s => Number(s.percentage) > 0)) {
				out.push({ field: 'np-stage-percentage-0', message: `مجموع النسب ${this.totalPercentage()}% ويجب أن يساوي 100%`, step });
			}
		}
		return out;
	}

	/** Marks every missing field of the current step (red, aria-invalid, role=alert) and focuses the first one. */
	private async showStepProblems(problems: FieldProblem[]) {
		const res = await reportProblems(this.host.nativeElement, problems, { openStep: (s) => { this.currentStep.set(Number(s)); } });
		if (!res.focused) this.notify.warning(problems[0]?.message ?? 'أكمل الحقول المطلوبة');
	}

	async goNext() {
		if (this.isSubmitting() || this.isStreamingText() || (this.currentStep() === 5 && this.isAiAnalyzing())) return;
		const problems = this.stepProblems();
		if (problems.length) { await this.showStepProblems(problems); return; }
		if (this.currentStep() < this.totalSteps) {
			// Upon navigating to Step 5, trigger complete Gemini analysis
			if (this.currentStep() === 4) {
				this.triggerAiReviewAnalysis();
			}
			const nextStep = this.currentStep() + 1;
			this.currentStep.set(nextStep);
			this.syncStepInUrl(nextStep);
			window.scrollTo(0, 0);
		} else if (this.currentStep() === this.totalSteps) {
			this.submitProject();
		}
	}

	goPrev() {
		if (this.currentStep() > 1) {
			const prevStep = this.currentStep() - 1;
			this.currentStep.set(prevStep);
			this.syncStepInUrl(prevStep);
			window.scrollTo(0, 0);
		}
	}

	retryAiEvaluation() {
		this.triggerAiReviewAnalysis();
	}

	private triggerAiReviewAnalysis() {
		this.isAiAnalyzing.set(true);
		this.aiEvaluation.set(null);

		const selectedSpecialtyObj = this.selectedMainSpecialtyObj();
		const selectedModelObj = this.accreditationModels().find(m => m.id === this.selectedModel());

		const payload = {
			title: this.projectName(),
			description: this.projectDesc(),
			category: selectedSpecialtyObj ? selectedSpecialtyObj.name : this.selectedSpecialty(),
			specialtyId: this.selectedSpecialty(),
			subSpecialty: this.effectiveSubSpecialty(),
			modelType: selectedModelObj ? selectedModelObj.title : this.selectedModel(),
			accreditationSampleId: this.selectedModel(),
			totalAmount: this.totalAmount() ?? undefined,
			stages: this.stages().map(s => ({
				title: s.title,
				description: s.desc,
				days: Number(s.days) || 0,
				percentage: Number(s.percentage) || 0
			}))
		};

		this.newProjectService.analyzeProjectModel(payload).subscribe({
			next: (res) => {
				this.isAiAnalyzing.set(false);
				if (res && res.success && res.data) {
					this.aiEvaluation.set(res.data);
					this.notify.success('اكتمل تحليل مستشار Waseet AI بنجاح!');
				}
			},
			 error: (err) => {
					this.isAiAnalyzing.set(false);
					console.error('AI review error', err);
					this.notify.warning('تعذر التحليل الذكي، ويمكنك نشر النموذج مباشرة');
				}
		});
	}

	applySuggestedMilestones(): void {
		const ev = this.aiEvaluation();
		if (!ev || !ev.suggestedMilestones || ev.suggestedMilestones.length === 0) return;

		const count = ev.suggestedMilestones.length;
		const defaultPerc = Math.floor(100 / count);
		let sum = 0;

		const updated = ev.suggestedMilestones.map((m, idx) => {
			let p = m.percentage || defaultPerc;
			if (idx === count - 1 && !m.percentage) {
				p = 100 - sum;
			}
			sum += p;
			return {
				title: m.title || `المرحلة ${idx + 1}`,
				desc: m.description || '',
				days: m.estimatedDays || null,
				percentage: p
			};
		});

		this.stages.set(updated);
		this.notify.success('تم تطبيق المراحل والدفعات المقترحة بنجاح على مشروعك!');
	}

	applySuggestedPricing(): void {
		const ev = this.aiEvaluation();
		if (!ev || !ev.suggestedPricingStrategy?.recommendedRange) return;

		// Try parsing numerical average out of string like "4000 - 5000 $"
		const matches = ev.suggestedPricingStrategy.recommendedRange.match(/\d+[,\d]*/g);
		if (matches && matches.length >= 1) {
			const nums = matches.map(m => parseInt(m.replace(/,/g, ''), 10)).filter(n => !isNaN(n));
			if (nums.length >= 2) {
				const avg = Math.round((nums[0] + nums[1]) / 2);
				this.totalAmount.set(avg);
			} else if (nums.length === 1) {
				this.totalAmount.set(nums[0]);
			}
		}
		this.notify.success('تم تعديل الميزانية الإجمالية وفق نطاق تسعير السوق المقترح!');
	}

	private submitProject() {
		if (!this.submitGuard.enter()) return;
		this.isSubmitting.set(true);
		const payload = {
			title: this.projectName(),
			description: this.projectDesc(),
			specialtyId: this.selectedSpecialty(),
			subSpecialty: this.effectiveSubSpecialty(),
			skills: this.selectedSkills(),
				accreditationSampleId: this.selectedModel(),
			gallery: this.galleryUrls(),
			stages: this.stages().map(stage => ({
				...stage,
				computedAmount: this.getAmountForStage(stage.percentage)
			})),
				aiScore: this.aiEvaluation() ? (this.aiEvaluation()!.feasibilityScore != null ? Math.round((this.aiEvaluation()!.clarityScore + this.aiEvaluation()!.feasibilityScore!) / 2) : Math.round(this.aiEvaluation()!.clarityScore)) : undefined
		};

		const request$ = this.isEditMode() && this.editServiceId()
			? this.newProjectService.updateService(this.editServiceId()!, payload)
			: this.newProjectService.publishService(payload);

		request$.subscribe({
			next: (res) => {
				this.submitGuard.release();
				this.isSubmitting.set(false);
				this.clearDraft();
					const msg = this.isEditMode() ? 'تم تحديث النموذج ونشره مباشرة' : 'تم نشر مشروعك مباشرة في السوق';
				this.notify.success(msg);
				setTimeout(() => {
					this.router.navigate(['/provider-overview/business-models/market']);
				}, 1200);
			},
				error: (err) => {
					console.error('Publish failed', err);
					this.submitGuard.release();
					this.isSubmitting.set(false);
					const mapped = mapHttpError(err, { fallback: 'تعذر حفظ نموذج العمل. راجع البيانات وحاول مرة أخرى' });
					const serverMsg: string = err?.error?.message || err?.error?.error || '';
					// Batch B T1: server field errors go to the step that holds the field (specialty / skills / approval model), shown next to it
					const fields: Array<{ field?: string; path?: string; message?: string }> = Array.isArray(err?.error?.errors) ? err.error.errors : [];
					const fieldMsg = (name: string) => fields.find(f => (f.field || f.path) === name)?.message;
					if (fieldMsg('accreditationSampleId')) { this.modelError.set(fieldMsg('accreditationSampleId')!); this.currentStep.set(3); }
					else if (fieldMsg('specialtyId')) { this.specialtyError.set(fieldMsg('specialtyId')!); this.currentStep.set(2); }
					else if (fieldMsg('skills')) { this.skillsError.set(fieldMsg('skills')!); this.currentStep.set(2); }
					if (err?.status === 400 && /مهار|skill/i.test(serverMsg)) {
						// The server refused a skill that is not in the catalog of this field: show it next to the skills.
						this.skillsError.set(serverMsg);
						this.currentStep.set(2);
					}
					// Only a 400/422 that names fields lands on the field; network / 429 / 5xx / 403 / 409 stay a generic message.
					void reportBackendError(this.host.nativeElement, mapped, {
						resolve: { title: 'np-name', description: 'np-desc', specialtyId: 'np-specialty', subSpecialty: 'np-subspecialty', accreditationSampleId: 'np-model', totalAmount: 'np-total-amount' },
						steps: { title: 1, description: 1, specialtyId: 2, subSpecialty: 2, accreditationSampleId: 3, totalAmount: 4 },
						openStep: (st) => { this.currentStep.set(Number(st)); },
					}).then(r => {
						if (!r.handled) this.notify.error(mapped.kind === 'backend-validation' ? (serverMsg || mapped.message) : mapped.message);
					});
				}
		});
	}
}
