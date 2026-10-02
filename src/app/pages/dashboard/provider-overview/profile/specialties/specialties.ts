import { Component, ChangeDetectionStrategy, signal, computed, inject, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { SpecialtyService } from '../../../../../core/services/specialty.service';
import { AntiCheatService } from '../../../../../core/services/anti-cheat.service';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';

export interface Specialty {
	id: string;
	name: string;
	count: string;
	iconHtml: string;
	color: string;
	bg: string;
}

export interface WorkSampleForm {
	id: string;
	subSpecialty: string;
	title: string;
	description?: string;
	technologies: string[];
	technologiesInput: string;
	publicFile: File | null;
	publicFileName: string | null;
	proofFiles: File[];
	proofFileNames: string[];
	isUploading?: boolean;
	isProcessingProofs?: boolean;
	previewUrl?: string | null;
	publicFileType?: string | null;
}

export interface AiEvaluationFeedback {
	aiScore: number;
	feasibilityScore: number;
	clarityScore: number;
	ownershipCredibility: number;
	summary: string;
	strengths: string[];
	warnings: string[];
	corrections: string[];
	isEligibleForTesting?: boolean;
}

export interface QuizQuestionOption {
	id: string;
	text: string;
}

export interface QuizQuestion {
	id: string;
	subSpecialtyTag: string;
	text: string;
	options: (QuizQuestionOption | string)[];
}

export interface DetailedResultItem {
	questionId: string;
	text: string;
	subSpecialtyTag: string;
	options: any[];
	selectedIndex: number | string;
	correctOptionIndex: number | string;
	isCorrect: boolean;
	explanation: string;
}

export interface ApiCategory {
	id: string;
	nameAr: string;
	icon?: string;
	specialties: ApiSpecialty[];
}

export interface ApiSpecialty {
	id: string;
	nameAr: string;
	_count?: { providerSpecialties: number };
}

@Component({
	selector: 'app-profile-specialties',
	standalone: true,
	imports: [CommonModule, FormsModule],
	templateUrl: './specialties.html',
	styleUrls: ['./specialties.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class Specialties implements OnInit, OnDestroy {
	private specialtyService = inject(SpecialtyService);
	public antiCheatService = inject(AntiCheatService);
	public confirmModal = inject(ConfirmModalService);
	private platformId = inject(PLATFORM_ID);
	private isBrowser = isPlatformBrowser(this.platformId);

	currentStep = signal<number>(1);
	searchQuery = signal<string>('');

	streamingPlaceholders = [1, 2, 3];
	providerSpecialtyId = signal<string | null>(null);
	aiFeedback = signal<AiEvaluationFeedback | null>(null);
	// Honest failure state — set when the real AI evaluation fails or returns
	// no data. Never paired with a fabricated aiFeedback value.
	aiEvaluationUnavailable = signal<boolean>(false);

	// Real-Time Quiz Signals & Streaming State
	quizSessionId = signal<string | null>(null);
	quizQuestions = signal<QuizQuestion[]>([]);
	isStreamingQuestions = signal<boolean>(false);
	streamProgressCount = signal<number>(0);
	// True only when neither the real-time socket nor the REST fallback
	// produced questions in time and the local static question bank is
	// being shown instead — the UI must never present this as live AI
	// generation.
	usingStaticFallbackQuestions = signal<boolean>(false);

	currentQuestionIdx = signal<number>(0);
	userAnswers = signal<Record<string, string>>({});
	timerRemainingSec = signal<number>(900); // 15 minutes default
	timerStarted = signal<boolean>(false);
	isQuizActive = signal<boolean>(false);
	isSubmittingQuiz = signal<boolean>(false);
	quizResult = signal<{
		passed: boolean;
		scorePercentage: number;
		// Only present when the backend really computed it (legacy attempts);
		// WaseetAI-graded attempts report a score only. Never derived from %.
		correctAnswers: number | null;
		totalQuestions: number;
		status: string;
		badgeGrantedAt?: string;
		feedbackAr?: string;
		strengths?: string[];
		weaknesses?: string[];
		detailedResults: DetailedResultItem[];
		message?: string;
	} | null>(null);

	// Batch 3D-2: an honest, user-facing failure state for real backend
	// assessment_error events (auth/rate-limit/ownership/generation/submission
	// exceptions on the primary socket flow) — distinct from the anti-cheat
	// lockout above. Never paired with a fabricated quiz question/result.
	quizGenerationError = signal<string | null>(null);

	private timerInterval: any = null;
	private fallbackStreamInterval: any = null;
	isSubmittingSamples = signal(false);
	uploadProgress = signal(0);

	// Batch 3D-3 — submission transport consolidation. Socket is primary
	// (evidence: the existing "Submit via WebSocket" / "Fallback REST
	// Endpoint" comments, the evaluationComplete$/assessmentError$
	// architecture already built entirely around the socket, and symmetry
	// with the generation flow's own socket-primary/REST-fallback pattern).
	// REST fires only as a bounded fallback on a genuine transport failure,
	// never in parallel by default.
	//
	// Bound derivation: handleSubmission's one variable-latency step is the
	// Gemini feedback call, whose ceiling is DEFAULT_TIMEOUT_MS = 20_000 in
	// the backend's gemini.client.ts. 25s gives that call its full real
	// budget plus a safety margin for scoring/DB/network overhead, so the
	// fallback does not fire while a legitimate submission is still
	// in-flight.
	private static readonly SUBMISSION_FALLBACK_TIMEOUT_MS = 25_000;
	// ALREADY_FINALIZED / NOT_FOUND / AUTH_REQUIRED / INVALID_REQUEST /
	// RATE_LIMITED are terminal business outcomes (assessment.gateway.ts,
	// Batch 3D-3) — never worth a second submission attempt. Only the
	// generic SUBMISSION_FAILED code represents a genuine processing/
	// transport failure worth retrying via REST.
	private static readonly RETRYABLE_SUBMISSION_ERROR_CODES = new Set(['SUBMISSION_FAILED']);

	// Per-attempt idempotency guard (Step 4): once set, no later event for
	// this attemptId may change quizResult/quizGenerationError again.
	private submissionSettledForAttempt: string | null = null;
	private submissionFallbackTimer: any = null;
	private submissionEvaluationSub: Subscription | null = null;
	private submissionErrorSub: Subscription | null = null;
	private submissionDisconnectSub: Subscription | null = null;

	specialties = signal<Specialty[]>([]);
	subData: Record<string, string[]> = {
		tech: ['تطوير ويب', 'تطبيقات موبايل', 'قواعد بيانات', 'أمن سيبراني', 'DevOps', 'ذكاء اصطناعي', 'برمجة خلفية', 'واجهات برمجية'],
		design: ['UI/UX', 'جرافيك ديزاين', 'هوية بصرية', 'تصميم 3D', 'موشن جرافيك', 'طباعة وتغليف'],
		writing: ['محتوى تسويقي', 'كتابة تقنية', 'محتوى أكاديمي', 'صحافة ومقالات', 'سيناريو', 'مدونات SEO'],
		marketing: ['SEO', 'إعلانات مدفوعة', 'سوشيال ميديا', 'إيميل ماركتينج', 'تحليلات بيانات', 'إنفلونسر'],
		legal: ['عقود تجارية', 'استشارات قانونية', 'تأسيس شركات', 'ملكية فكرية', 'تحكيم ونزاعات'],
		business: ['إدارة مشاريع', 'موارد بشرية', 'مالية وحسابات', 'عمليات وإجراءات', 'تخطيط استراتيجي'],
		other: []
	};

	apiCategories = signal<ApiCategory[]>([]);

	ngOnInit() {
		this.specialtyService.getCategories().subscribe({
			next: (res: any) => {
				if (res && res.success && res.data) {
					this.apiCategories.set(res.data);
				}
			},
			error: (err: any) => console.error('[Specialties Init Error]:', err)
		});

		// Listen to live WebSocket question streaming ("one by one like typing")
		this.antiCheatService.questionStreamed$.subscribe((streamItem) => {
			const q = streamItem.question;
			if (q && this.isQuizActive()) {
				this.quizQuestions.update(curr => {
					if (!curr.some(existing => existing.id === q.id)) {
						return [...curr, q];
					}
					return curr;
				});
				this.startTimerOnceQuestionsAreVisible();
				this.streamProgressCount.set(streamItem.index + 1);
			}
			if (streamItem.isLast || streamItem.index >= streamItem.total - 1) {
				this.isStreamingQuestions.set(false);
			}
		});

		this.antiCheatService.assessmentReady$.subscribe((ready) => {
			if (ready && ready.attemptId) {
				this.quizSessionId.set(ready.attemptId);
			}
			// The backend honestly reports when it had to use its own static
			// bank (Gemini unavailable) — reflect that here too.
			if (ready && ready.generationSource) {
				this.usingStaticFallbackQuestions.set(ready.generationSource === 'STATIC_FALLBACK');
			}
			this.isStreamingQuestions.set(false);
		});

		// Batch 3D-2: surface real assessment_error events honestly instead of
		// silently dropping them. Never fabricates a quiz result and never
		// auto-invokes the legacy quiz fallback — it only stops the
		// loading/streaming UI and shows the sanitized backend message.
		//
		// Batch 3D-3: assessment_error is now also emitted during submission
		// (handleSubmission), which is handled by the scoped watcher armed in
		// armSubmissionWatchers() instead — this generation-only handler must
		// stay silent while a submission is in flight AND after one has
		// settled for the current attempt (a late/duplicate submission-phase
		// event must never be reinterpreted as a generation failure), or it
		// would corrupt state even if the template happens to hide it behind
		// quizResult(). submissionSettledForAttempt is cleared whenever a new
		// quiz attempt begins (initiateDynamicQuiz), so this only suppresses
		// stale events for an attempt that has already concluded.
		this.antiCheatService.assessmentError$.subscribe((err) => {
			if (this.isSubmittingQuiz() || this.submissionSettledForAttempt) return;
			this.isStreamingQuestions.set(false);
			this.quizGenerationError.set(err?.message || 'حدث خطأ أثناء معالجة التقييم الفني.');
		});
	}

	// Batch 3D-3: shared success-application logic for the socket
	// (evaluation_complete) result shape — the sole authoritative place that
	// sets quizResult from a socket-delivered outcome.
	private applyEvaluationResult(res: any) {
		const totalQ = this.quizQuestions().length || 20;
		const scoreVal = Number.isFinite(res?.score) ? res.score : (Number.isFinite(res?.scorePercentage) ? res.scorePercentage : null);
		if (scoreVal === null) {
			// No real score arrived: never invent one.
			this.applyFallbackResults();
			return;
		}
		this.quizResult.set({
			passed: Boolean(res.isPassed),
			scorePercentage: scoreVal,
			correctAnswers: Number.isFinite(res.correctAnswers) ? res.correctAnswers : null,
			totalQuestions: totalQ,
			status: res.status || (res.isPassed ? 'APPROVED' : 'FAILED'),
			badgeGrantedAt: res.completedAt,
			feedbackAr: res.feedbackAr,
			strengths: res.strengths || [],
			weaknesses: res.weaknesses || [],
			detailedResults: [],
			message: res.message
		});
	}

	selectedSpecId = signal<string | null>(null);
	selectedSubs = signal<Set<string>>(new Set());
	otherText = signal<string>('');

	filteredSpecialties = computed(() => {
		const q = this.searchQuery().trim().toLowerCase();
		let specs = this.apiCategories().map(cat => ({
			id: cat.id,
			name: cat.nameAr,
			count: `+${cat.specialties.reduce((sum, s) => sum + (s._count?.providerSpecialties || 0), 0)} مقدم`,
			iconHtml: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
			color: '#2BD4C7',
			bg: 'rgba(43,212,199,.12)'
		}));

		// specs.push({
		//   id: 'other', name: 'أخرى', count: 'اقترح تخصصا', iconHtml: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>', color: '#A8B2D1', bg: 'rgba(255,255,255,.07)'
		// });

		return specs.filter(s => !q || s.name.toLowerCase().includes(q));
	});

	currentSubs = computed(() => {
		const id = this.selectedSpecId();
		if (!id || id === 'other') return [];
		const cat = this.apiCategories().find(c => c.id === id);
		return cat ? cat.specialties.map(s => s.nameAr) : [];
	});

	activeSubSpecialties = computed(() => {
		const subs = Array.from(this.selectedSubs());
		if (subs.length > 0) {
			return subs;
		}
		if (this.selectedSpecId() === 'other' && this.otherText().trim()) {
			return [this.otherText().trim()];
		}
		const spec = this.filteredSpecialties().find(s => s.id === this.selectedSpecId());
		return spec ? [spec.name] : ['التخصص المختار'];
	});

	canProceedToStep2 = computed(() => {
		const id = this.selectedSpecId();
		if (!id) return false;
		if (id === 'other' && this.otherText().trim().length < 5) return false;
		if (id !== 'other' && this.selectedSubs().size === 0) return false;
		return true;
	});

	selectSpec(id: string) {
		this.selectedSpecId.set(id);
		this.selectedSubs.set(new Set());
	}

	toggleSub(sub: string) {
		const subs = new Set(this.selectedSubs());
		if (subs.has(sub)) {
			subs.delete(sub);
		} else {
			if (subs.size >= 5) return;
			subs.add(sub);
		}
		this.selectedSubs.set(subs);
	}

	hasSub(sub: string): boolean {
		return this.selectedSubs().has(sub);
	}

	nextStep() {
		if (this.currentStep() === 1 && this.canProceedToStep2()) {
			const activeSubs = this.activeSubSpecialties();
			const currentSamples = this.samples();

			const validSamples = currentSamples.filter(s => activeSubs.includes(s.subSpecialty));
			const updatedSamples = [...validSamples];

			activeSubs.forEach((sub, idx) => {
				if (!updatedSamples.some(s => s.subSpecialty === sub)) {
					updatedSamples.push({
						id: `${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
						subSpecialty: sub,
						title: `نموذج أعمال لـ ${sub}`,
						description: '',
						technologies: [],
						technologiesInput: '',
						publicFile: null,
						publicFileName: null,
						proofFiles: [],
						proofFileNames: [],
						isUploading: false
					});
				}
			});

			this.samples.set(updatedSamples);

			const payload = {
				specialtyId: this.selectedSpecId()!,
				subSpecialties: activeSubs,
				isCustom: this.selectedSpecId() === 'other',
				customName: this.selectedSpecId() === 'other' ? this.otherText() : undefined
			};

			this.specialtyService.selectSpecialty(payload).subscribe({
				next: (res: any) => {
					if (res && res.success && res.data?.id) {
						this.providerSpecialtyId.set(res.data.id);
					} else {
						this.providerSpecialtyId.set('demo-spec-uuid-101');
					}
					this.currentStep.set(2);
				},
				error: () => {
					this.providerSpecialtyId.set('demo-spec-uuid-101');
					this.currentStep.set(2);
				}
			});
		} else if (this.currentStep() === 2 && this.canProceedToStep3()) {
			const formData = new FormData();
			const specId = this.providerSpecialtyId() || 'demo-spec-uuid-101';
			formData.append('providerSpecialtyId', specId);
			formData.append('sampleCount', this.samples().length.toString());

			this.samples().forEach((s, i) => {
				formData.append(`sampleTitle_${i}`, s.title);
				formData.append(`sampleDescription_${i}`, s.description || '');
				formData.append(`sampleTechnologies_${i}`, JSON.stringify(s.technologies));
				formData.append(`subSpecialty_${i}`, s.subSpecialty);
				if (s.publicFile) {
					formData.append(`publicSample_${i}`, s.publicFile);
				}
				s.proofFiles.forEach((p) => {
					formData.append(`proofFiles_${i}`, p);
				});
			});

			this.isSubmittingSamples.set(true);
			this.uploadProgress.set(0);

			this.specialtyService.submitProof(formData).subscribe({
				next: (event: any) => {
					if (event.type === HttpEventType.UploadProgress && event.total) {
						this.uploadProgress.set(Math.round((event.loaded / event.total) * 100));
					}
					if (event.type === HttpEventType.Response) this.finishSamplesUpload();
				},
				error: () => {
					this.specialtyService.uploadSamples(formData).subscribe({
						next: () => this.finishSamplesUpload(),
						error: () => this.finishSamplesUpload()
					});
				}
			});
		} else if (this.currentStep() === 3 && this.allDeclarationsChecked()) {
			// Step 3 -> Step 4: Initiate instant real-time 20-question dynamic streaming quiz
			this.initiateDynamicQuiz();
		}
	}

	async prevStep() {
		if (this.currentStep() === 4 && this.antiCheatService.isMonitoring()) {
			const confirmLeave = await this.confirmModal.confirm({
				title: '⚠️ مغادرة الاختبار الجاري',
				message: 'مغادرة شاشة الاختبار الآن ستؤدي لفقدان تقدمك في هذه المحاولة.\n\nهل أنت متأكد من العودة؟',
				type: 'danger',
				confirmText: 'نعم، مغادرة الاختبار',
				cancelText: 'البقاء ومتابعة الاختبار'
			});
			if (!confirmLeave) return;

			this.antiCheatService.stopMonitoring();
			this.stopTimer();
			this.stopFallbackStream();
			this.isQuizActive.set(false);
		}

		if (this.currentStep() > 1) {
			this.currentStep.update(s => s - 1);
		}
	}

	// Step 2 specific - Organized by Subspecialties
	samples = signal<WorkSampleForm[]>([]);

	canProceedToStep3 = computed(() => {
		const currentSamples = this.samples();
		if (currentSamples.length === 0) return false;
		return !this.isSubmittingSamples() && currentSamples.every(s =>
			s.title.trim().length >= 3 &&
			(s.description || '').trim().length >= 20 &&
			s.technologies.length > 0 &&
			s.publicFile !== null && s.proofFiles.length > 0 && !s.isUploading && !s.isProcessingProofs
		);
	});

	private finishSamplesUpload() {
		if (!this.isSubmittingSamples()) return;
		this.uploadProgress.set(100);
		this.isSubmittingSamples.set(false);
		this.currentStep.set(3);
		this.isAnalyzing.set(true);
		this.simulateAnalysis();
	}

	getSamplesForSub(sub: string): WorkSampleForm[] {
		return this.samples().filter(s => s.subSpecialty === sub);
	}

	getSampleCountText(sub: string): string {
		const count = this.getSamplesForSub(sub).length;
		if (count === 0) return 'لا نماذج بعد — أضف أول نموذج لبدء المراجعة';
		if (count === 1) return 'نموذج واحد مرفوع';
		if (count === 2) return 'نموذجان مرفوعان';
		return `${count} نماذج مرفوعة`;
	}

	addSampleBlock(subSpecialty: string) {
		const count = this.getSamplesForSub(subSpecialty).length + 1;
		this.samples.update(s => [...s, {
			id: `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
			subSpecialty: subSpecialty,
			title: `نموذج عمل رقم ${count} لـ ${subSpecialty}`,
			description: '',
			technologies: [],
			technologiesInput: '',
			publicFile: null,
			publicFileName: null,
			proofFiles: [],
			proofFileNames: []
		}]);
	}

	updateTechnologies(sampleId: string, value: string) {
		const technologies = [...new Set(value.split(/[,،]/).map(item => item.trim()).filter(Boolean))].slice(0, 15);
		const samples = this.samples();
		const sample = samples.find(item => item.id === sampleId);
		if (!sample) return;
		// Keep the same object identity so Angular does not recreate the input and lose its caret.
		sample.technologiesInput = value;
		sample.technologies = technologies;
		this.samples.set([...samples]);
	}

	removeTechnology(sampleId: string, technology: string) {
		const sample = this.samples().find(item => item.id === sampleId);
		if (!sample) return;
		const technologies = sample.technologies.filter(item => item !== technology);
		sample.technologies = technologies;
		sample.technologiesInput = technologies.join(', ');
		this.samples.set([...this.samples()]);
	}

	removeSampleBlock(id: string) {
		this.samples.update(s => s.filter(x => x.id !== id));
	}

	async onPublicFileSelected(event: Event, sampleId: string) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			const file = input.files[0];
			this.patchSample(sampleId, { isUploading: true });
			try {
				const processed = file.type.startsWith('image/') ? await this.addImageWatermark(file) : file;
				const previewUrl = processed.type.startsWith('image/') ? await this.fileToDataUrl(processed) : null;
				this.patchSample(sampleId, {
					publicFile: processed,
					publicFileName: file.name,
					publicFileType: processed.type || file.type,
					previewUrl,
					isUploading: false
				});
			} catch {
				this.patchSample(sampleId, { isUploading: false });
			}
			input.value = '';
		}
	}

	removePublicFile(sampleId: string) {
		this.patchSample(sampleId, {
			publicFile: null,
			publicFileName: null,
			publicFileType: null,
			previewUrl: null,
			isUploading: false
		});
	}

	private patchSample(sampleId: string, patch: Partial<WorkSampleForm>) {
		this.samples.update(samples => samples.map(sample => sample.id === sampleId ? { ...sample, ...patch } : sample));
	}

	private fileToDataUrl(file: File): Promise<string> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result));
			reader.onerror = () => reject(reader.error);
			reader.readAsDataURL(file);
		});
	}

	private async addImageWatermark(file: File): Promise<File> {
		const source = await this.fileToDataUrl(file);
		const image = await new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = source;
		});
		const canvas = document.createElement('canvas');
		const maxDimension = 1920;
		const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
		canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
		canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
		const ctx = canvas.getContext('2d');
		if (!ctx) throw new Error('Canvas is not available');
		ctx.drawImage(image, 0, 0);
		const fontSize = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.045));
		ctx.save();
		ctx.translate(canvas.width / 2, canvas.height / 2);
		ctx.rotate(-Math.PI / 7);
		ctx.font = `800 ${fontSize}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillStyle = 'rgba(255,255,255,.28)';
		ctx.strokeStyle = 'rgba(7,13,36,.25)';
		ctx.lineWidth = Math.max(1, fontSize / 18);
		const stepX = fontSize * 6;
		const stepY = fontSize * 3.2;
		for (let y = -canvas.height; y <= canvas.height; y += stepY) {
			for (let x = -canvas.width; x <= canvas.width; x += stepX) {
				ctx.strokeText('وسيط AI', x, y);
				ctx.fillText('وسيط AI', x, y);
			}
		}
		ctx.restore();
		const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
		const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Watermark failed')), outputType, .92));
		return new File([blob], file.name, { type: outputType, lastModified: Date.now() });
	}

	async onProofFilesSelected(event: Event, sampleId: string) {
		const input = event.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			const files = Array.from(input.files);
			this.patchSample(sampleId, { isProcessingProofs: true });
			try {
				const processedFiles = await Promise.all(files.map(file => file.type.startsWith('image/') ? this.addImageWatermark(file) : Promise.resolve(file)));
				this.samples.update(s =>
					s.map(sample => sample.id === sampleId ? {
						...sample,
						proofFiles: [...sample.proofFiles, ...processedFiles],
						proofFileNames: [...sample.proofFileNames, ...files.map(f => f.name)],
						isProcessingProofs: false
					} : sample)
				);
			} catch {
				this.patchSample(sampleId, { isProcessingProofs: false });
			}
			input.value = '';
		}
	}

	removeProofFile(sampleId: string, proofIndex: number) {
		this.samples.update(s =>
			s.map(sample => {
				if (sample.id !== sampleId) return sample;
				return {
					...sample,
					proofFiles: sample.proofFiles.filter((_, i) => i !== proofIndex),
					proofFileNames: sample.proofFileNames.filter((_, i) => i !== proofIndex)
				};
			})
		);
	}

	// Step 3 AI Review Engine
	isAnalyzing = signal<boolean>(true);

	simulateAnalysis() {
		this.isAnalyzing.set(true);
		this.aiEvaluationUnavailable.set(false);
		this.aiFeedback.set(null);
		const id = this.providerSpecialtyId() || 'demo-spec-uuid-101';

		this.specialtyService.aiEvaluate(id).subscribe({
			next: (res: any) => {
				const scores = res?.data?.scores;
				const hasRealScores = scores
					&& typeof scores.aiScore === 'number'
					&& typeof scores.feasibilityScore === 'number'
					&& typeof scores.clarityScore === 'number'
					&& typeof scores.ownershipCredibility === 'number';

				if (res?.success && hasRealScores) {
					const feedbackData = res.data.feedback || {};
					const feedback: AiEvaluationFeedback = {
						aiScore: scores.aiScore,
						feasibilityScore: scores.feasibilityScore,
						clarityScore: scores.clarityScore,
						ownershipCredibility: scores.ownershipCredibility,
						summary: feedbackData.summary || '',
						strengths: feedbackData.strengths || [],
						warnings: feedbackData.warnings || [],
						corrections: feedbackData.corrections || [],
						// Reflects the backend's own real decision — never assumed true on success.
						isEligibleForTesting: res.data.status === 'TEST_REQUIRED'
					};
					this.aiFeedback.set(feedback);
					setTimeout(() => this.isAnalyzing.set(false), 2200);
				} else {
					// Honest failure — no invented scores, feedback, or eligibility.
					this.isAnalyzing.set(false);
					this.aiEvaluationUnavailable.set(true);
				}
			},
			error: () => {
				this.isAnalyzing.set(false);
				this.aiEvaluationUnavailable.set(true);
			}
		});
	}

	getGaugeDashArray(): string {
		return '226.19';
	}

	getGaugeDashOffset(score?: number): number {
		const val = Number(score || 0);
		const bounded = Math.min(Math.max(val, 0), 100);
		return 226.19 - (bounded / 100) * 226.19;
	}

	getScoreColor(score?: number): string {
		const val = Number(score || 0);
		if (val >= 85) return '#2BD4C7';
		if (val >= 70) return '#5DA0FF';
		if (val >= 50) return '#FFB400';
		return '#FF6B6B';
	}

	declarations = signal<{ id: number, text: string, checked: boolean }[]>([
		{ id: 1, text: 'أقر بأن جميع نماذج أعمالي المرفوعة صحيحة وتتطابق مع خبرتي الفعلية وهي من إنتاجي', checked: false },
		{ id: 2, text: 'أوافق على شروط الاعتماد وأدرك أن اجتياز الاختبار الفوري لازم لتفعيل التخصص وبشارة التميز', checked: false },
		{ id: 3, text: 'أتعهد بالالتزام التام بضمانات مكافحة الغش وأعلم أن مغادرة المتصفح ستتسبب ببطول النتيجة وقفل الاختبار لـ 24 ساعة', checked: false }
	]);

	toggleDeclaration(id: number) {
		this.declarations.update(decs =>
			decs.map(d => d.id === id ? { ...d, checked: !d.checked } : d)
		);
	}

	allDeclarationsChecked = computed(() => {
		return this.declarations().every(d => d.checked);
	});

	// =========================================================
	// STEP 4: REAL-TIME DYNAMIC QUIZ & ANTI-CHEAT IMPLEMENTATION
	// =========================================================

	currentQuestion = computed(() => {
		const questions = this.quizQuestions();
		const idx = this.currentQuestionIdx();
		return questions[idx] || null;
	});

	answeredCount = computed(() => {
		return Object.keys(this.userAnswers()).length;
	});

	isAllQuestionsAnswered = computed(() => {
		const len = this.quizQuestions().length;
		return len > 0 && this.answeredCount() >= len && !this.isStreamingQuestions();
	});

	formattedTimeRemaining = computed(() => {
		const sec = Math.max(0, this.timerRemainingSec());
		const mins = Math.floor(sec / 60);
		const secs = sec % 60;
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	});

	private initiateDynamicQuiz() {
		const specId = this.providerSpecialtyId() || 'demo-spec-uuid-101';
		this.isQuizActive.set(true);
		this.quizGenerationError.set(null);
		this.quizResult.set(null);
		// A new attempt begins — any settlement guard from a previous
		// submission no longer applies (Batch 3D-3).
		this.submissionSettledForAttempt = null;
		this.clearSubmissionWatchers();
		this.quizQuestions.set([]);
		this.isStreamingQuestions.set(true);
		this.usingStaticFallbackQuestions.set(false);
		this.streamProgressCount.set(0);
		this.currentQuestionIdx.set(0);
		this.userAnswers.set({});
		this.timerRemainingSec.set(900);
		this.stopTimer();

		const portfolioUrls = this.samples().map(s => s.publicFileName).filter(Boolean) as string[];
		const activeSubs = this.activeSubSpecialties();
		const selSpec = this.filteredSpecialties().find(s => s.id === this.selectedSpecId());

		// 1. Primary: Start Real-Time WebSocket Question Stream over /assessments
		this.antiCheatService.startAssessmentStream({
			providerSpecialtyId: specId,
			specialtyId: this.selectedSpecId() || 'tech',
			subSpecialtyIds: activeSubs,
			portfolioFileUrls: portfolioUrls,
			categoryName: selSpec?.name || 'التخصص الفني',
			specialtyName: selSpec?.name || 'التخصص المختار'
		});

		// 2. HTTP fallback if the socket has not delivered its first question quickly.
		setTimeout(() => {
			if (this.quizQuestions().length === 0 && this.isStreamingQuestions()) {
				this.specialtyService.generateAiAssessment(specId).subscribe({
					next: (res: any) => {
						if (res.success && res.data) {
							const attemptId = res.data.attemptId;
							const questions: QuizQuestion[] = (res.data.questions || []).map((q: any) => ({
								id: String(q.id),
								subSpecialtyTag: q.assessmentArea || q.subSpecialtyTag || 'تقييم ذكي',
								text: q.textAr || q.text || '',
								options: q.options || []
							}));
							// The backend honestly reports when it had to use its own
							// static bank (Gemini unavailable) — reflect that here too.
							this.usingStaticFallbackQuestions.set(res.data.generationSource === 'STATIC_FALLBACK');
							this.setupQuizSession(attemptId, questions, 900, false);
						} else {
							this.applyFallback20Questions();
						}
					},
					error: (err: any) => {
						// Batch 3D-2: the backend now reports GENERATION_IN_PROGRESS when
						// the socket stream is still genuinely generating this specialty's
						// questions (concurrency-claim in progress). That is not a real
						// failure — showing the unrelated local static fallback here would
						// be misleading since the real, already-in-flight questions will
						// still arrive via the socket stream shortly. Only a genuine error
						// falls back to the static question bank.
						if (err?.error?.code === 'GENERATION_IN_PROGRESS') return;
						this.applyFallback20Questions();
					}
				});
			}
		}, 3500);

		this.currentStep.set(4);
	}

	// Batch 3D-2: lets the user retry after an honest assessment_error state
	// without re-running the full step 1-3 declaration flow.
	retryQuizGeneration() {
		this.initiateDynamicQuiz();
	}

	private setupQuizSession(sessionId: string, questions: QuizQuestion[], remainingSec: number, isStreaming = false) {
		this.quizSessionId.set(sessionId);
		this.currentQuestionIdx.set(0);
		this.userAnswers.set({});
		this.timerRemainingSec.set(remainingSec);
		this.isQuizActive.set(true);

		if (isStreaming) {
			this.quizQuestions.set([]);
			this.isStreamingQuestions.set(true);
			this.streamProgressCount.set(0);
		} else {
			this.quizQuestions.set(questions);
			this.isStreamingQuestions.set(false);
			this.streamProgressCount.set(questions.length);
		}

		// Establish the assessment socket transport for this attempt
		this.antiCheatService.startMonitoring();

		if (questions.length > 0) {
			this.startTimerOnceQuestionsAreVisible();
		} else {
			this.stopTimer();
		}
	}

	private startTimerOnceQuestionsAreVisible() {
		if (this.timerStarted() || !this.isQuizActive() || this.quizQuestions().length === 0) return;
		this.timerStarted.set(true);
		this.startTimer();
	}

	private startTimer() {
		if (this.timerInterval) clearInterval(this.timerInterval);
		this.timerInterval = setInterval(() => {
			this.timerRemainingSec.update(s => {
				if (s <= 1) {
					this.stopTimer();
					this.handleQuizTimeout();
					return 0;
				}
				return s - 1;
			});
		}, 1000);
	}

	private stopTimer() {
		if (this.timerInterval) {
			clearInterval(this.timerInterval);
			this.timerInterval = null;
		}
		this.timerStarted.set(false);
	}

	private stopFallbackStream() {
		if (this.fallbackStreamInterval) {
			clearInterval(this.fallbackStreamInterval);
			this.fallbackStreamInterval = null;
		}
	}

	private async handleQuizTimeout() {
		if (!this.isQuizActive()) return;
		console.warn('[Specialties Quiz] Time expired! Triggering timeout evaluation.');
		this.antiCheatService.stopMonitoring();
		this.stopFallbackStream();

		await this.confirmModal.notify(
			'⏱️ انتهاء الوقت المقرر',
			'انتهت المهلة الزمنية للاختبار (15 دقيقة). سيتم الآن تسليم ما قمت بإنجازه للتقييم الفوري عبر الذكاء الاصطناعي.',
			'warning'
		);

		this.submitQuizAnswers();
	}

	trackByOptionId(_index: number, option: { id: string; text: string }): string {
		return option.id;
	}

	getNormalizedOptions(q: any): { id: string; text: string }[] {
		if (!q || !q.options || !Array.isArray(q.options)) return [];
		return q.options.map((opt: any, idx: number) => {
			if (typeof opt === 'object' && opt !== null && opt.text) {
				return { id: String(opt.id || String.fromCharCode(97 + idx)), text: opt.text };
			}
			const optionId = String.fromCharCode(97 + idx); // 'a', 'b', 'c', 'd'
			return { id: optionId, text: typeof opt === 'string' ? opt : JSON.stringify(opt) };
		});
	}

	selectQuestionAnswer(questionId: string | number, optionChoice: string | number) {
		this.userAnswers.update(answers => ({
			...answers,
			[String(questionId)]: String(optionChoice)
		}));
	}

	getSelectedOptionForCurrent(): string | null {
		const q = this.currentQuestion();
		if (!q) return null;
		const ans = this.userAnswers()[String(q.id)];
		return ans !== undefined ? ans : null;
	}

	gotoQuestion(index: number) {
		if (index >= 0 && index < this.quizQuestions().length) {
			this.currentQuestionIdx.set(index);
		}
	}

	nextQuestion() {
		if (this.currentQuestionIdx() < this.quizQuestions().length - 1) {
			this.currentQuestionIdx.update(i => i + 1);
		}
	}

	prevQuestion() {
		if (this.currentQuestionIdx() > 0) {
			this.currentQuestionIdx.update(i => i - 1);
		}
	}

	async submitQuizFinal() {
		if (this.isStreamingQuestions()) {
			await this.confirmModal.notify(
				'⚡ جاري بث الأسئلة',
				'الرجاء الانتظار ثوانٍ معدودة حتى اكتمال تدفق الأسئلة قبل تسليم النتيجة النهائية.',
				'info'
			);
			return;
		}

		if (!this.isAllQuestionsAnswered()) {
			const confirmUnfinished = await this.confirmModal.confirm({
				title: '❓ تسليم اختبار غير مكتمل',
				message: `لم تقم بالإجابة عن كافة الأسئلة بعد (أجبت عن ${this.answeredCount()} من ${this.quizQuestions().length}).\n\nالأسئلة غير المجاب عليها سيتم احتسابها خاطئة. هل أنت متأكد من رغبتك في التسليم الآن؟`,
				type: 'warning',
				confirmText: 'تأكيد التسليم على أي حال',
				cancelText: 'استكمال الإجابة'
			});
			if (!confirmUnfinished) return;
		}

		const confirmSubmit = await this.confirmModal.confirm({
			title: '📋 تسليم التقييم الفوري للتدقيق',
			message: 'هل أنت متأكد من تسليم إجابات التقييم وإغلاق الجلسة للتحليل الذكي واعتماد شارة التميز؟',
			type: 'info',
			confirmText: 'نعم، تسليم واعتماد النتيجة',
			cancelText: 'مراجعة الإجابات'
		});
		if (!confirmSubmit) return;

		this.submitQuizAnswers();
	}

	private submitQuizAnswers() {
		// Step 5 — double-click / repeated-invocation guard. isSubmittingQuiz
		// is set synchronously below before any async gap, so a rapid repeat
		// call (or a second entry via the timeout path) is rejected here.
		if (this.isSubmittingQuiz()) return;

		const attemptId = this.quizSessionId() || 'demo-session-2026';

		this.stopTimer();
		this.stopFallbackStream();

		const submittedAnswersMap = this.userAnswers();
		this.submissionSettledForAttempt = null;
		this.isQuizActive.set(false);
		this.isSubmittingQuiz.set(true);

		// Batch 3D-4 — watchers must be armed BEFORE the emit, so no response
		// (or disconnect) can ever arrive unobserved. Critically, this batch
		// also stops calling stopMonitoring() here: the socket must stay
		// alive for the whole primary submission lifecycle. Teardown is
		// deferred to finishSubmission(), invoked only once a terminal
		// outcome is reached — see armSubmissionWatchers/runRestFallbackSubmission.
		this.armSubmissionWatchers(attemptId, submittedAnswersMap);

		const emitted = this.antiCheatService.submitAssessmentAnswers(attemptId, submittedAnswersMap);

		if (!emitted) {
			// Synchronous transport-unavailable: the just-armed watchers can
			// never receive anything for this attempt — tear them down and go
			// straight to the fallback.
			this.clearSubmissionWatchers();
			this.runRestFallbackSubmission(attemptId, submittedAnswersMap);
		}
	}

	// Batch 3D-3 — watches the primary (socket) transport for exactly one of:
	// a matching success, a classified error, a mid-flight disconnect, or a
	// bounded timeout — then tears itself down so nothing can react twice.
	//
	// Batch 3D-4: success and terminal-error branches now settle via
	// finishSubmission() (clear watchers, THEN stopMonitoring/disconnect) —
	// the disconnect that produces can never reach submissionDisconnectSub
	// because it has already been unsubscribed by the time it fires. The
	// retryable branches (error/disconnect/timeout) only clear watchers and
	// hand off to the REST fallback; the socket itself is left connected but
	// unwatched — final cleanup happens once the fallback itself settles.
	private armSubmissionWatchers(attemptId: string, submittedAnswersMap: Record<string, string>) {
		this.clearSubmissionWatchers();

		this.submissionEvaluationSub = this.antiCheatService.evaluationComplete$.subscribe((res: any) => {
			if (res?.attemptId && res.attemptId !== attemptId) return;
			if (this.submissionSettledForAttempt === attemptId) return; // duplicate success event (the backend can emit this twice to the same socket via its direct + room broadcast)
			this.submissionSettledForAttempt = attemptId;
			this.isSubmittingQuiz.set(false);
			this.applyEvaluationResult(res);
			this.finishSubmission();
		});

		this.submissionErrorSub = this.antiCheatService.assessmentError$.subscribe((err: any) => {
			if (this.submissionSettledForAttempt === attemptId) return; // never overwrite a confirmed success
			if (err?.code && Specialties.RETRYABLE_SUBMISSION_ERROR_CODES.has(err.code)) {
				this.clearSubmissionWatchers();
				this.runRestFallbackSubmission(attemptId, submittedAnswersMap);
			} else {
				// Terminal business outcome (already finalized by a previous
				// successful submission, not found, auth/rate-limit, etc.) —
				// never worth a second submission attempt.
				this.submissionSettledForAttempt = attemptId;
				this.isSubmittingQuiz.set(false);
				this.quizGenerationError.set(err?.message || 'حدث خطأ أثناء معالجة التقييم الفني.');
				this.finishSubmission();
			}
		});

		this.submissionDisconnectSub = this.antiCheatService.socketDisconnected$.subscribe(() => {
			if (this.submissionSettledForAttempt === attemptId) return;
			this.clearSubmissionWatchers();
			this.runRestFallbackSubmission(attemptId, submittedAnswersMap);
		});

		this.submissionFallbackTimer = setTimeout(() => {
			if (this.submissionSettledForAttempt === attemptId) return;
			this.clearSubmissionWatchers();
			this.runRestFallbackSubmission(attemptId, submittedAnswersMap);
		}, Specialties.SUBMISSION_FALLBACK_TIMEOUT_MS);
	}

	private clearSubmissionWatchers() {
		this.submissionEvaluationSub?.unsubscribe();
		this.submissionEvaluationSub = null;
		this.submissionErrorSub?.unsubscribe();
		this.submissionErrorSub = null;
		this.submissionDisconnectSub?.unsubscribe();
		this.submissionDisconnectSub = null;
		if (this.submissionFallbackTimer) {
			clearTimeout(this.submissionFallbackTimer);
			this.submissionFallbackTimer = null;
		}
	}

	// Batch 3D-4 — the single place that tears down the socket after a
	// submission has reached a terminal outcome. Watchers (including
	// submissionDisconnectSub) are unsubscribed FIRST, synchronously, before
	// stopMonitoring() ever calls socket.disconnect() — so the resulting
	// 'disconnect' event has no live subscriber left to reach, regardless of
	// whether socket.io-client dispatches it synchronously or on a later
	// tick. This ordering guarantee (not a flag) is what prevents an
	// intentional post-settlement disconnect from ever being misread as a
	// new transport failure.
	private finishSubmission() {
		this.clearSubmissionWatchers();
		this.antiCheatService.stopMonitoring();
	}

	// Fallback: REST (/api/assessments/:attemptId/submit) — invoked only on a
	// genuine primary-transport failure, never in parallel with the socket.
	// Batch 3D-4: every leaf outcome now settles + calls finishSubmission(),
	// so the socket (left connected but unwatched since the primary was
	// abandoned) is always eventually cleaned up, and stopMonitoring()'s
	// disconnect can never race a REST completion that is still pending.
	private runRestFallbackSubmission(attemptId: string, submittedAnswersMap: Record<string, string>) {
		if (this.submissionSettledForAttempt === attemptId) return;

		this.specialtyService.submitAiAssessment(attemptId, submittedAnswersMap).subscribe({
			next: (res: any) => {
				if (this.submissionSettledForAttempt === attemptId) return;
				this.isSubmittingQuiz.set(false);
				this.submissionSettledForAttempt = attemptId;
				if (res.success && res.data) {
					const d = res.data;
					const totalQ = this.quizQuestions().length || 20;
					if (!Number.isFinite(d.score)) {
						// No real score arrived: never invent one.
						this.applyFallbackResults();
						this.finishSubmission();
						return;
					}
					const scoreVal = d.score;
					this.quizResult.set({
						passed: Boolean(d.isPassed),
						scorePercentage: scoreVal,
						correctAnswers: Number.isFinite(d.correctAnswers) ? d.correctAnswers : null,
						totalQuestions: totalQ,
						status: d.status || (d.isPassed ? 'APPROVED' : 'FAILED'),
						badgeGrantedAt: d.completedAt,
						feedbackAr: d.feedbackAr,
						strengths: d.strengths || [],
						weaknesses: d.weaknesses || [],
						detailedResults: [],
						message: res.message
					});
				} else {
					this.applyFallbackResults();
				}
				this.finishSubmission();
			},
			// Batch 4D: a canonical REST fallback failure is now a terminal
			// outcome. It no longer retries against the legacy
			// SpecialtyTestSession quiz/submit endpoint — that endpoint
			// requires a SpecialtyTestSession.id, which an AssessmentAttempt.id
			// can never match, so that retry was always guaranteed to fail.
			error: () => {
				if (this.submissionSettledForAttempt === attemptId) return;
				this.isSubmittingQuiz.set(false);
				this.submissionSettledForAttempt = attemptId;
				this.quizGenerationError.set('تعذر إرسال إجاباتك للتقييم. الرجاء المحاولة مرة أخرى.');
				this.finishSubmission();
			}
		});
	}

	private applyFallback20Questions() {
		const activeSubs = this.activeSubSpecialties();
		const subs = activeSubs.length > 0 ? activeSubs : ['تطوير الأنظمة', 'الهندسة التقنية', 'الأمان السيبراني'];
		const questions: QuizQuestion[] = [];

		const baseScenarios = [
			{
				q: 'ما هو التدبير الأمني ومعيار التوثيق الأحدث لضمان استمرار العمل دون انقضاء صلاحيات الرموز (Tokens) في بيئات الخدمات المصغرة؟',
				options: [
					'تخزين كلمات المرور صالحة للأبد في متصفح العميل بدون تشفير',
					'استخدام بنية JWT مع Refresh Token محمي داخل ملفات تعريف ارتباط آمنة (HttpOnly Cookies) وتطبيق تدوير الرموز',
					'الاعتماد على جلسات الذاكرة الفردية على خادم واحد دون مزامنة',
					'تعطيل تدابير الحماية اللاسلكية وبروتوكولات TLS لتسريع الاتصال'
				]
			},
			{
				q: 'عند توافق الأداء البطيء مع التحميل المتدفق للبيانات في الواجهات الأمامية، أي نمط تصميمي هو الأفضل تقنياً؟',
				options: [
					'جلب قاعدة البيانات كاملة إلى ذاكرة المتصفح عند بدء التطبيق',
					'تطبيق التمرير اللانهائي (Infinite Scrolling) مع الترقيم الافتراضي (Virtual Scrolling)',
					'تعطيل جدران الحماية وتقليل طبقة الأنماط التنسيقية',
					'إعادة تحميل الصفحة بالكامل عند الضغط على أي عنصر تحكم'
				]
			},
			{
				q: 'في حالة حدوث عطل تزامني (Race Condition) أثناء التعامل مع المعاملات المالية الحساسة، كيف تتفادى خسارة وتناقض البيانات؟',
				options: [
					'تجاهل القيود السجلية والاعتماد على إدخال القيم بأوامر مباشرة',
					'تطبيق أقفال قاعدة البيانات (Locking) والمعاملات الذرية (Atomic ACID Transactions)',
					'انتظار فترة ثابتة قدرها خمس ثوانٍ بين كل عملية وأخرى برمجياً',
					'حذف السجل وإعادة إنشائه بصلاحيات إدارية كاملة دون مراقبة الأخطاء'
				]
			},
			{
				q: 'ما هو أفضل منهج لاختبار توافق البرمجيات وكشف ثغرات الانحدار (Regression) قبل نشر الإصدارات الحية؟',
				options: [
					'إجراء الفحص اليدوي المرتاد من قبل مطور واحد قبل النشر مباشرة',
					'بناء خط أنابيب CI/CD يشمل اختبارات الوحدة والاختبار المتكامل التلقائي',
					'نشر التعديلات مباشرة على السيرفر الحي ومراقبة شكاوى العملاء',
					'تشفير قاعدة البيانات لمنع وصول أي اختبار أوتوماتيكي للمنظومة'
				]
			}
		];

		for (let i = 0; i < 20; i++) {
			const sub = subs[i % subs.length];
			const sc = baseScenarios[i % baseScenarios.length];
			const opts: QuizQuestionOption[] = sc.options.map((optText, optIdx) => ({
				id: String.fromCharCode(97 + optIdx),
				text: optText
			}));
			questions.push({
				id: `q${i + 1}`,
				subSpecialtyTag: sub,
				text: `[تخصص: ${sub}] ${sc.q}`,
				options: opts
			});
		}

		const sessionId = `sess-${Date.now()}`;
		this.usingStaticFallbackQuestions.set(true);
		// Initialize session immediately in streaming mode
		this.setupQuizSession(sessionId, [], 900, true);

		// Render the local fallback as a fast progressive stream.
		let streamIdx = 0;
		this.stopFallbackStream();
		const firstQuestion = questions[streamIdx++];
		this.quizQuestions.set([firstQuestion]);
		this.streamProgressCount.set(streamIdx);
		this.startTimerOnceQuestionsAreVisible();
		this.fallbackStreamInterval = setInterval(() => {
			if (streamIdx < questions.length && this.isQuizActive()) {
				const nextQ = questions[streamIdx];
				this.quizQuestions.update(curr => [...curr, nextQ]);
				streamIdx++;
				this.streamProgressCount.set(streamIdx);
				if (streamIdx >= questions.length) {
					this.isStreamingQuestions.set(false);
					this.stopFallbackStream();
				}
			} else {
				this.stopFallbackStream();
			}
		}, 60);
	}

	// Honest failure — this used to fabricate a guaranteed-passing 80% score
	// (and even marked answers as "correct" purely by question index,
	// ignoring what the user actually selected) whenever both the socket and
	// REST submission paths failed. No real grading ever happened in that
	// case, so it must never report a pass, a score, or a badge. Reuses the
	// existing "did not pass" UI branch — no new UI was introduced.
	private applyFallbackResults() {
		const total = this.quizQuestions().length || 20;

		this.quizResult.set({
			passed: false,
			scorePercentage: 0,
			correctAnswers: null,
			totalQuestions: total,
			status: 'SUBMISSION_FAILED',
			detailedResults: [],
			message: 'تعذر تسليم واحتساب نتيجة التقييم حالياً بسبب انقطاع الاتصال بالخادم. لم يتم احتساب أي درجة أو اعتماد تخصصك؛ يرجى إعادة المحاولة.'
		});
	}

	ngOnDestroy(): void {
		this.stopTimer();
		this.stopFallbackStream();
		this.clearSubmissionWatchers();
		this.antiCheatService.stopMonitoring();
	}
}
