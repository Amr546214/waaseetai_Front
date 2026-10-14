import type { RegisteredSpecialty } from '../../../../../core/utils/specialty-states';
import { Component, signal, computed, effect, untracked, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NewProjectService, AiReviewEvaluation } from '../../../../../core/services/new-project.service';
import { SkillsCatalogService } from '../../../../../core/services/skills-catalog.service';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { Step1DetailsComponent } from './components/step1-details/step1-details.component';
import { Step2SpecialtyComponent } from './components/step2-specialty/step2-specialty.component';
import { Step3ModelComponent } from './components/step3-model/step3-model.component';
import { Step4StagesComponent } from './components/step4-stages/step4-stages.component';
import { Step5EvaluationComponent } from './components/step5-evaluation/step5-evaluation.component';
import { isMeaningfulProjectTitle } from '../../../../../core/utils/title-validator';
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
	private sanitizer = inject(DomSanitizer);
	private router = inject(Router);
	private route = inject(ActivatedRoute);

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
	toastMessage = signal<string>('');

	// Step 1 - Name & Description
	projectName = signal('');
	projectDesc = signal('');
	descCount = computed(() => this.projectDesc().length);
	isValidStep1 = computed(() => this.projectName().trim().length > 0 && this.projectDesc().trim().length > 0);

	// Gemini Streaming & Loading States for Step 1
	isAiEnhancing = signal<boolean>(false);
	isAiSuggesting = signal<boolean>(false);
	isStreamingText = signal<boolean>(false);
	/** Set when a stream ends with `error:true` (backend BE-1): the user's draft was restored and a retry is offered. */
	aiStreamError = signal<string | null>(null);
	private draftBeforeStream = '';
	private lastAiMode: 'improve' | 'suggest' = 'improve';

	updateName(event: Event) { this.projectName.set((event.target as HTMLInputElement).value); }
	updateDesc(event: Event) { this.projectDesc.set((event.target as HTMLTextAreaElement).value); }

	retryAiAssist() { this.aiAssist(this.lastAiMode); }

	aiAssist(mode: 'improve' | 'suggest') {
		this.lastAiMode = mode;
		this.aiStreamError.set(null);
		const title = this.projectName().trim();
		const desc = this.projectDesc().trim();

		// Validate title meaningfulness
		if (title) {
			const titleValidation = isMeaningfulProjectTitle(title);
			if (!titleValidation.valid) {
				this.showToast(`⚠️ ${titleValidation.reason}`);
				return;
			}
		}

		if (mode === 'improve') {
			if (!desc && !title) {
				this.showToast('⚠️ يرجى كتابة اسم المشروع أو وصف مبدئي أولاً ليتم تحسينه');
				return;
			}
			this.isAiEnhancing.set(true);
			this.isStreamingText.set(true);

			// Trigger WebSocket real-time word-by-word streaming
			this.newProjectService.streamEnhanceDescription(this.projectName(), this.projectDesc());
			this.showToast('✨ بدأ الاتصال المباشر لبث تحسين النص باحترافية...');

		} else if (mode === 'suggest') {
			if (!title) {
				this.showToast('⚠️ يرجى كتابة اسم المشروع أولاً ليقوم الذكاء باقتراح وصف متكامل له');
				return;
			}
			const titleValidation = isMeaningfulProjectTitle(title);
			if (!titleValidation.valid) {
				this.showToast(`⚠️ ${titleValidation.reason}`);
				return;
			}

			this.isAiSuggesting.set(true);
			this.isStreamingText.set(true);

			// Trigger WebSocket real-time word-by-word streaming
			this.newProjectService.streamSuggestText(this.projectName());
			this.showToast('💡 بدأ البث المباشر لتوليد مقترح احترافي لوصف المشروع...');
		}

		// Safety timeout: if streaming doesn't end within 25 seconds, release loading state
		setTimeout(() => {
			if (this.isStreamingText()) {
				this.isStreamingText.set(false);
				this.isAiEnhancing.set(false);
				this.isAiSuggesting.set(false);
			}
		}, 25000);
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

	isValidStep2 = computed(() => {
		if (!this.selectedSpecialty()) return false;
		const mainObj = this.selectedMainSpecialtyObj();
		if (mainObj && mainObj.subSpecialties && mainObj.subSpecialties.length > 0) {
			return this.selectedSubSpecialty() !== '';
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
				if (this.suggestSkillsOnLoad) {
					this.suggestSkillsOnLoad = false;
					this.selectedSkills.set(this.providerSkills().filter(sk => options.includes(sk)).slice(0, 30));
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

	onSkillsChange(list: string[]) {
		this.skillsError.set('');
		this.selectedSkills.set(list.slice(0, 30));
	}

	selectMainSpecialty(spec: PassedSpecialtySubItem) {
		const next = spec.id || spec.specialtyId;
		const changed = next !== this.selectedSpecialty();
		this.selectedSpecialty.set(next);
		if (changed) {
			this.selectedSkills.set([]);
			this.skillsError.set('');
			if (this.selectedCategoryId() === this.skillsCategoryKey && !this.skillsLoading()) {
				// Same field as before: its catalog is already loaded, so the provider's saved skills are suggested right away.
				this.selectedSkills.set(this.providerSkills().filter(sk => this.skillOptions().includes(sk)).slice(0, 30));
			} else {
				this.suggestSkillsOnLoad = true;
			}
		}
		this.selectedSubSpecialty.set('');
		this.selectedModel.set('');
	}

	selectSubSpecialty(sub: string) {
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

					// Removed auto-selection logic based on user request.
					if (this.selectedSpecialty() && !this.selectedSubSpecialty()) {
						// Keeping this empty so user has to manually select sub-specialty even in edit mode if it was not saved.
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
		if (filter === 'verified') {
			return list.filter(m => m.status === 'AI_VERIFIED' || m.status === 'APPROVED');
		}
		return list;
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
			model.specialtyId === selectedSpecialtyId
		);
	});

	galleryUrls = signal<string[]>([]);
	isUploadingImage = signal<boolean>(false);

	selectModel(id: string) {
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
						this.showToast('✅ تم رفع الصورة بنجاح');
					}
				},
				error: (err) => {
					this.isUploadingImage.set(false);
					this.showToast('⚠️ حدث خطأ أثناء رفع الصورة');
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
	totalAmount = signal<number>(4500);
	stages = signal<any[]>([
		{ title: '', desc: '', days: 5, percentage: 100 }
	]);
	isAiSuggestingMilestones = signal<boolean>(false);

	suggestMilestonesWithAi() {
		if (!this.projectName().trim()) {
			this.showToast('⚠️ يرجى كتابة اسم المشروع في الخطوة الأولى أولاً ليقوم الذكاء بإنشاء المراحل المناسبة له');
			return;
		}
		this.isAiSuggestingMilestones.set(true);
		this.showToast('يقوم المستشار الذكي الآن بتحليل مشروعك وهندسة المراحل الأنسب...');

		this.newProjectService.suggestMilestones(this.projectName(), this.projectDesc(), this.totalAmount()).subscribe({
			next: (res) => {
				this.isAiSuggestingMilestones.set(false);
				if (res?.data?.milestones && Array.isArray(res.data.milestones) && res.data.milestones.length > 0) {
					const mapped = res.data.milestones.map((m: any) => ({
						title: m.title || 'مرحلة جديدة',
						desc: m.description || m.desc || '',
						days: Number(m.estimatedDays || m.days) || 4,
						percentage: Number(m.percentage) || 0
					}));
					this.stages.set(mapped);
					this.showToast('⚡ تم إنشاء هيكل مراحل العمل وتوزيع النسب بذكاء بناءً على وصف مشروعك!');
				}
			},
			error: (err) => {
				this.isAiSuggestingMilestones.set(false);
				console.error('AI suggest milestones error', err);
				this.showToast('⚠️ لم يتم الاتصال بالخادم الذكي، يمكنك إضافة المراحل يدوياً');
			}
		});
	}

	addStage() {
		this.stages.update(s => [...s, { title: '', desc: '', days: 0, percentage: 0 }]);
	}

	removeStage(index: number) {
		this.stages.update(s => s.filter((_, i) => i !== index));
	}

	updateStage(index: number, field: string, value: any) {
		this.stages.update(s => {
			const newStages = [...s];
			newStages[index] = { ...newStages[index], [field]: value };
			return newStages;
		});
	}

	totalPercentage = computed(() => this.stages().reduce((sum, s) => sum + (Number(s.percentage) || 0), 0));
	totalDays = computed(() => this.stages().reduce((sum, s) => sum + (Number(s.days) || 0), 0));
	isValidStep4 = computed(() => this.totalPercentage() === 100 && this.stages().length > 0 && this.stages().every(s => s.title && s.percentage > 0));

	getAmountForStage(percentage: number): number {
		return (this.totalAmount() * (percentage || 0)) / 100;
	}

	// Step 5 - AI Review & Orchestration
	isValidStep5 = computed(() => !this.isAiAnalyzing());
	isAiAnalyzing = signal<boolean>(false);
	aiEvaluation = signal<AiReviewEvaluation | null>(null);

	ngOnInit() {
		// Initialize Socket listeners for Real-time word-by-word streaming
		this.newProjectService.initSocket();

		this.newProjectService.onStreamStart((data) => {
			this.isStreamingText.set(true);
			// Remember the user's text: the stream replaces it as it arrives, but a failed stream must give it back.
			this.draftBeforeStream = this.projectDesc();
			if (data.mode === 'suggest') {
				this.projectDesc.set('');
			} else if (data.mode === 'improve') {
				this.projectDesc.set('');
			}
		});

		this.newProjectService.onStreamChunk((data) => {
			this.projectDesc.update(current => current + data.chunk);
		});

		this.newProjectService.onStreamEnd((data) => {
			this.isStreamingText.set(false);
			this.isAiEnhancing.set(false);
			this.isAiSuggesting.set(false);
			if (data.error === true) {
				// Failed stream: never keep partial chunks / an emptied textarea — restore the user's own draft and offer a retry.
				this.projectDesc.set(this.draftBeforeStream);
				this.aiStreamError.set(data.message || 'تعذّر إكمال الاقتراح. يمكنك إعادة المحاولة.');
				return;
			}
			this.aiStreamError.set(null);
			if (data.message) {
				this.showToast(data.message);
			}
		});

		// Check query parameters for edit mode
		this.route.queryParams.subscribe(params => {
			const editId = params['edit'] || params['id'];
			if (editId) {
				this.editServiceId.set(editId);
				this.loadExistingService(editId);
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
						days: Number(stg.deliveryDays || stg.days || 1),
						percentage: Number(stg.percentage || 0)
					}));
					this.stages.set(mappedStages);
				}

				this.showToast('ℹ️ تم تحميل تفاصيل النموذج للتعديل');
			},
			error: (err) => console.error('Failed to load existing service for editing:', err)
		});
	}

	ngOnDestroy(): void {
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

	goNext() {
		if (this.isCurrentStepValid && this.currentStep() < this.totalSteps) {
			// Upon navigating to Step 5, trigger complete Gemini analysis
			if (this.currentStep() === 4) {
				this.triggerAiReviewAnalysis();
			}
			this.currentStep.update(s => s + 1);
			window.scrollTo(0, 0);
		} else if (this.currentStep() === this.totalSteps) {
			this.submitProject();
		}
	}

	goPrev() {
		if (this.currentStep() > 1) {
			this.currentStep.update(s => s - 1);
			window.scrollTo(0, 0);
		}
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
			subSpecialty: this.selectedSubSpecialty(),
			modelType: selectedModelObj ? selectedModelObj.title : this.selectedModel(),
			accreditationSampleId: this.selectedModel(),
			totalAmount: this.totalAmount(),
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
					this.showToast('✅ اكتمل تحليل مستشار Waseet AI بنجاح!');
				}
			},
			 error: (err) => {
					this.isAiAnalyzing.set(false);
					console.error('AI review error', err);
					this.showToast('⚠️ تعذر التحليل الذكي، ويمكنك نشر النموذج مباشرة');
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
				days: m.estimatedDays || 3,
				percentage: p
			};
		});

		this.stages.set(updated);
		this.showToast('⚡ تم تطبيق المراحل والدفعات المقترحة بنجاح على مشروعك!');
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
		this.showToast('💰 تم تعديل الميزانية الإجمالية وفق نطاق تسعير السوق المقترح!');
	}

	private submitProject() {
		this.isSubmitting.set(true);
		const payload = {
			title: this.projectName(),
			description: this.projectDesc(),
			specialtyId: this.selectedSpecialty(),
			subSpecialty: this.selectedSubSpecialty(),
			skills: this.selectedSkills(),
				accreditationSampleId: this.selectedModel(),
			gallery: this.galleryUrls(),
			stages: this.stages().map(stage => ({
				...stage,
				computedAmount: this.getAmountForStage(stage.percentage)
			})),
				aiScore: this.aiEvaluation() ? Math.round((this.aiEvaluation()!.clarityScore + this.aiEvaluation()!.feasibilityScore) / 2) : undefined
		};

		const request$ = this.isEditMode() && this.editServiceId()
			? this.newProjectService.updateService(this.editServiceId()!, payload)
			: this.newProjectService.publishService(payload);

		request$.subscribe({
			next: (res) => {
				this.isSubmitting.set(false);
					const msg = this.isEditMode() ? '✅ تم تحديث النموذج ونشره مباشرة' : '✅ تم نشر مشروعك مباشرة في السوق';
				this.showToast(msg);
				setTimeout(() => {
					this.router.navigate(['/provider-overview/business-models/market']);
				}, 1200);
			},
				error: (err) => {
					console.error('Publish failed', err);
					this.isSubmitting.set(false);
					const serverMsg: string = err?.error?.message || err?.error?.error || '';
					if (err?.status === 400 && /مهار|skill/i.test(serverMsg)) {
						// The server refused a skill that is not in the catalog of this field: show it next to the skills.
						this.skillsError.set(serverMsg);
						this.currentStep.set(2);
					}
					this.showToast(serverMsg || '⚠️ تعذر حفظ نموذج العمل. راجع البيانات وحاول مرة أخرى');
				}
		});
	}

	showToast(msg: string) {
		this.toastMessage.set(msg);
		setTimeout(() => {
			if (this.toastMessage() === msg) {
				this.toastMessage.set('');
			}
		}, 4000);
	}
}
