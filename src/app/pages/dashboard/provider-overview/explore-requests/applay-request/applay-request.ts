import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { io, Socket } from 'socket.io-client';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { Step1General } from './components/step1-general/step1-general';
import { Step2Pricing } from './components/step2-pricing/step2-pricing';
import { Step3Review } from './components/step3-review/step3-review';
import { Step4Success } from './components/step4-success/step4-success';

export interface Milestone {
	id: string;
	name: string;
	days: number | null;
	desc: string;
	pct: number | null;
}

export interface PortfolioItem {
	id: string;
	title: string;
	meta: string;
	badge: string;
	gradient: string;
	isBestMatch?: boolean;
	aiScore?: number;
	status?: string;
}

interface ProposalState {
	title: string;
	message: string;
	advantages: string[];
	outputs: string;
	portfolioIds: string[];
	milestones: Milestone[];
}

export interface ProfileAuditItem {
	title: string;
	subtitle: string;
	status: 'EXCELLENT' | 'GOOD' | 'WARNING' | string;
	badge: string;
}

export interface AiAuditResult {
	profileAudit: ProfileAuditItem[];
	triPartyComparison: {
		client: { budget: string; duration: string; milestones: string };
		provider: { budget: string; duration: string; milestones: string };
		aiRecommendation: { budget: string; duration: string; milestones: string };
	};
	triPartyNote: string;
	finalMetrics: {
		overallScore: number;
		profileMatch: number;
		messageClarity: number;
		priceCompetitiveness: number;
		timelineFeasibility: number;
		completeness: number;
	};
	acceptanceOdds: {
		statusText: string;
		description: string;
		topPercentage: string;
	};
}

@Component({
	selector: 'app-applay-request',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterLink, Step1General, Step2Pricing, Step3Review, Step4Success],
	templateUrl: './applay-request.html',
	styleUrl: './applay-request.css',
})
export class ApplayRequest implements OnInit, OnDestroy {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private http = inject(HttpClient);
	private authStore = inject(AuthStore);
	private providerApi = inject(ProviderApiService);
	private socket?: Socket;

	reqId = signal<string | null>(null);
	activeStep = signal<number>(1);

	// Project Details State (Dynamic binding instead of hardcoded strings)
	projectDetails = signal<any | null>(null);
	isLoadingProject = signal<boolean>(false);
	projectLoadError = signal<string | null>(null);

	// Step 1 State
	proposal = signal<ProposalState>({
		title: '',
		message: '',
		advantages: [],
		outputs: '',
		portfolioIds: [],
		milestones: [
			{ id: '1', name: '', days: null as any, desc: '', pct: null as any }
		]
	});

	newReq = signal<string>('');
	showAiSuggest = signal<boolean>(false);
	isFetchingAiSuggest = signal<boolean>(false);
	totalBudget = signal<number>(4500);

	// Step 3 State
	isScanning = signal<boolean>(true);
	auditProgressMessage = signal<string>('جاري استدعاء بيانات المشروع والملف المهني...');
	auditResult = signal<AiAuditResult | null>(null);

	ack1 = signal<boolean>(false);
	ack2 = signal<boolean>(false);
	ack3 = signal<boolean>(false);

	showAiMsgPanel = signal<boolean>(false);
	showAiPricePanel = signal<boolean>(false);
	skippedMsgRec = signal<boolean>(false);
	skippedPriceRec = signal<boolean>(false);

	// Step 4 State
	isSubmitting = signal<boolean>(false);
	showSuccess = signal<boolean>(false);

	// Dynamic Portfolio / Accreditations state
	isLoadingPortfolio = signal<boolean>(true);
	portfolioOptions = signal<PortfolioItem[]>([]);

	// Computed properties for Step 1 Validation & UI
	isStep1Valid = computed(() => {
		const p = this.proposal();
		return p.title.trim().length >= 3 && p.message.trim().length >= 30;
	});

	// Step 2 Computed
	totalPct = computed(() => {
		return this.proposal().milestones.reduce((sum, m) => sum + (Number(m.pct) || 0), 0);
	});

	totalDays = computed(() => {
		return this.proposal().milestones.reduce((sum, m) => sum + (Number(m.days) || 0), 0);
	});

	isStep2Valid = computed(() => {
		const p = this.proposal();
		if (this.totalPct() !== 100) return false;
		if (this.totalBudget() <= 0) return false;
		if (p.milestones.length === 0) return false;
		return p.milestones.every(m => m.name.trim() && m.days && Number(m.days) > 0 && m.pct && Number(m.pct) > 0);
	});

	titleLength = computed(() => this.proposal().title.length);
	messageLength = computed(() => this.proposal().message.length);
	outputsLength = computed(() => this.proposal().outputs.length);

	aiQuality = computed(() => {
		const len = this.messageLength();
		if (len === 0) return { class: 'poor', text: 'أضف وصفا لتحليل الجودة' };
		if (len < 50) return { class: 'poor', text: 'قصير جدا' };
		if (len < 100) return { class: 'medium', text: 'AI: وصف متوسط' };
		if (len < 200) return { class: 'good', text: 'AI: وصف جيد ✓' };
		return { class: 'great', text: 'AI: وصف ممتاز ✓' };
	});

	selectedPortfolioNames = computed(() => {
		const ids = this.proposal().portfolioIds;
		return this.portfolioOptions()
			.filter(p => ids.includes(p.id))
			.map(p => p.title)
			.join(' + ');
	});

	currentAudit = computed<AiAuditResult>(() => {
		return this.auditResult() || this.getUnavailableAudit();
	});

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id');
		this.reqId.set(id);

		if (id) {
			this.fetchProjectDetails(id);
		} else {
			this.projectLoadError.set('معرّف المشروع غير موجود');
		}

		this.loadAccreditationSamples();

		if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
			const draft = sessionStorage.getItem(`draft_proposal_v2_${this.reqId()}`);
			if (draft) {
				try {
					const parsed = JSON.parse(draft);
					const current = this.proposal();
					this.proposal.set({
						...current,
						...parsed,
						advantages: parsed.advantages || parsed.reqs || current.advantages,
						milestones: parsed.milestones || current.milestones
					});
				} catch (e) { }
			}
		}
	}

	fetchProjectDetails(projectId: string) {
		this.isLoadingProject.set(true);
		this.projectLoadError.set(null);
		this.http.get<any>(`${environment.url_api}/projects/${projectId}/summary`)
			.subscribe({
				next: (res) => {
					this.isLoadingProject.set(false);
					const proj = res.data || res;
					if (proj && proj.title) {
						this.projectDetails.set(proj);
						if (proj.budgetFixed) {
							this.totalBudget.set(Number(proj.budgetFixed));
						} else if (proj.budgetMin && proj.budgetMax) {
							this.totalBudget.set(Math.round((Number(proj.budgetMin) + Number(proj.budgetMax)) / 2));
						}
					} else {
						this.projectLoadError.set('تعذر التحقق من بيانات المشروع');
					}
				},
				error: (err) => {
					this.isLoadingProject.set(false);
					console.error('Could not load project details from server:', err);
					this.projectDetails.set(null);
					this.projectLoadError.set(err.error?.message || 'تعذر تحميل المشروع؛ لا يمكن تقديم عرض قبل التحقق منه');
				}
			});
	}

	saveDraft() {
		if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
			sessionStorage.setItem(`draft_proposal_v2_${this.reqId()}`, JSON.stringify(this.proposal()));
		}
	}

	onInput() {
		this.saveDraft();
	}

	updateTitle(val: string) {
		this.proposal.update(p => ({ ...p, title: val }));
		this.onInput();
	}

	updateMessage(val: string) {
		this.proposal.update(p => ({ ...p, message: val }));
		this.onInput();
	}

	updateOutputs(val: string) {
		this.proposal.update(p => ({ ...p, outputs: val }));
		this.onInput();
	}

	updateTotalBudget(val: number) {
		if (val && val >= 0) {
			this.totalBudget.set(val);
			this.onInput();
		}
	}

	// AI Suggestion via Backend API
	toggleAISuggest() {
		this.showAiSuggest.update(v => !v);
	}

	useAISuggest() {
		if (this.isFetchingAiSuggest()) return;
		this.isFetchingAiSuggest.set(true);

		const payload = {
			projectId: this.reqId() || 'proj-demo-101',
			currentTitle: this.proposal().title || 'عرض تقديم خدمة تطويرية',
			currentMessage: this.proposal().message || 'تفاصيل العمل والمراحل',
			advantages: this.proposal().advantages
		};

		this.http.post<any>(`${environment.url_api}/proposals/ai-suggest`, payload)
			.subscribe({
				next: (res) => {
					this.isFetchingAiSuggest.set(false);
					this.showAiSuggest.set(false);
					if (res.data) {
						const refinedTitle = res.data.suggestedTitle || this.proposal().title;
						const refinedMsg = res.data.suggestedMessage || res.data.content || 'أحتاج إلى تطوير متجر إلكتروني متكامل لعلامة تجارية في قطاع الأزياء. يشمل المشروع تصميم واجهة مستخدم عصرية RTL، صفحات منتجات، نظام دفع إلكتروني متوافق مع SAMA، لوحة إدارة، وتكامل مع منصات التوصيل المحلية.';
						const suggestedAdvs = res.data.suggestedAdvantages || [];
						this.proposal.update(p => ({
							...p,
							title: refinedTitle,
							message: refinedMsg,
							advantages: Array.from(new Set([...p.advantages, ...suggestedAdvs]))
						}));
						this.saveDraft();
					}
				},
				error: (err) => {
					this.isFetchingAiSuggest.set(false);
					this.showAiSuggest.set(false);
					console.error('AI Suggest API failed:', err);
					alert(err.error?.message || 'تعذر تشغيل اقتراح AI ولم يتم تغيير عرضك.');
				}
			});
	}

	// Advantages / Requirements
	addReq() {
		const val = this.newReq().trim();
		if (!val) return;
		if (this.proposal().advantages.length >= 10) return;
		this.proposal.update(p => ({ ...p, advantages: [...p.advantages, val] }));
		this.newReq.set('');
		this.saveDraft();
	}

	removeReq(idx: number) {
		this.proposal.update(p => {
			const newAdvs = [...p.advantages];
			newAdvs.splice(idx, 1);
			return { ...p, advantages: newAdvs };
		});
		this.saveDraft();
	}

	// Portfolio
	togglePortfolio(id: string, event: Event) {
		const isChecked = (event.target as HTMLInputElement).checked;
		this.proposal.update(p => {
			let ids = [...p.portfolioIds];
			if (isChecked && !ids.includes(id)) {
				ids.push(id);
			} else if (!isChecked) {
				ids = ids.filter(i => i !== id);
			}
			return { ...p, portfolioIds: ids };
		});
		this.saveDraft();
	}

	clearPortfolio() {
		this.proposal.update(p => ({ ...p, portfolioIds: [] }));
		this.saveDraft();
	}

	loadAccreditationSamples() {
		this.isLoadingPortfolio.set(true);
		this.providerApi.getAccreditationSamples().subscribe({
			next: (res) => {
				this.isLoadingPortfolio.set(false);
				const samples = res?.samples || (res?.data && res?.data?.samples) || [];
				if (Array.isArray(samples) && samples.length > 0) {
					const gradients = [
						'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
						'linear-gradient(135deg,#7B2FBE,#2B7FFF)',
						'linear-gradient(135deg,#FFB400,#FF8C69)',
						'linear-gradient(135deg,#0FA99A,#2BD4C7)'
					];

					const mapped: PortfolioItem[] = samples.map((s: any, idx: number) => {
						const specName = s.providerSpecialty?.specialty?.nameAr || s.providerSpecialty?.specialty?.name || 'تخصص معتمد';
						const techList = Array.isArray(s.technologiesUsed) ? s.technologiesUsed : [];
						const techStr = techList.length > 0 ? techList.slice(0, 3).join(' · ') : '';
						const scoreStr = s.aiScore ? `اعتماد AI ${Math.round(s.aiScore)}%` : 'معتمد AI';
						const metaParts = [specName, scoreStr];
						if (techStr) metaParts.push(techStr);

						return {
							id: s.id,
							title: s.title,
							meta: metaParts.join(' · '),
							badge: s.status === 'AI_VERIFIED' || s.status === 'APPROVED' ? '✓' : 'AI',
							gradient: gradients[idx % gradients.length],
							isBestMatch: idx === 0 || (s.aiScore && s.aiScore >= 90),
							aiScore: s.aiScore,
							status: s.status
						};
					});

					this.portfolioOptions.set(mapped);

					// Auto-select first sample if proposal draft has no portfolioIds yet
					if (this.proposal().portfolioIds.length === 0 && mapped.length > 0) {
						this.proposal.update(p => ({ ...p, portfolioIds: [mapped[0].id] }));
					}
				} else {
					this.portfolioOptions.set([]);
				}
			},
			error: (err) => {
				this.isLoadingPortfolio.set(false);
				console.warn('Could not fetch provider accreditation samples:', err);
				this.portfolioOptions.set([]);
			}
		});
	}

	getPortfolioItem(id: string): PortfolioItem | undefined {
		return this.portfolioOptions().find(p => p.id === id);
	}

	// Step 2 logic
	addMilestone() {
		this.proposal.update(p => {
			const newId = Date.now().toString();
			return {
				...p,
				milestones: [...p.milestones, { id: newId, name: '', days: null, desc: '', pct: null }]
			};
		});
		this.onInput();
	}

	removeMilestone(id: string) {
		this.proposal.update(p => ({
			...p,
			milestones: p.milestones.filter(m => m.id !== id)
		}));
		this.onInput();
	}

	updateMilestone(id: string, updates: Partial<Milestone>) {
		this.proposal.update(p => ({
			...p,
			milestones: p.milestones.map(m => m.id === id ? { ...m, ...updates } : m)
		}));
		this.onInput();
	}

	getAmount(pct: number | null): number {
		if (!pct) return 0;
		return Math.round((this.totalBudget() * pct) / 100);
	}

	get totalAmount(): number {
		return this.proposal().milestones.reduce((sum, m) => sum + this.getAmount(m.pct), 0);
	}

	// Step 3 logic
	toggleAck(n: number) {
		if (n === 1) this.ack1.update(v => !v);
		if (n === 2) this.ack2.update(v => !v);
		if (n === 3) this.ack3.update(v => !v);
	}

	isStep3Valid = computed(() => {
		return this.ack1() && this.ack2() && this.ack3();
	});

	applyAIEdit(type: string) {
		if (type === 'msg') this.showAiMsgPanel.update(v => !v);
		if (type === 'price') this.showAiPricePanel.update(v => !v);
	}

	skipRec(id: string) {
		if (id === 'msg-rec') this.skippedMsgRec.set(true);
		if (id === 'price-rec') this.skippedPriceRec.set(true);
	}

	acceptAiMsg() {
		this.showAiMsgPanel.set(false);
	}

	acceptAiPrice() {
		this.showAiPricePanel.set(false);
	}

	// Navigation
	nextStep() {
		const isValid = this.activeStep() === 1 ? this.isStep1Valid() : (this.activeStep() === 2 ? this.isStep2Valid() : (this.activeStep() === 3 ? this.isStep3Valid() : true));
		if (!isValid) {
			if (this.activeStep() === 2 && this.totalPct() !== 100) {
				alert(`إجمالي نسب دفعات المراحل يجب أن يساوي 100% (المجموع الحالي: ${this.totalPct()}%)`);
			}
			return;
		}
		this.saveDraft();
		const next = this.activeStep() + 1;
		this.activeStep.set(next);

		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}

		if (next === 3) {
			this.triggerAiAudit();
		}
	}

	triggerAiAudit() {
		this.isScanning.set(true);
		this.auditProgressMessage.set('جاري استدعاء بيانات المشروع والملف المهني...');

		if (!this.socket) {
			this.socket = io(environment.socketUrl, { withCredentials: true });
		}

		const payload = {
			projectId: this.reqId() || 'proj-demo-101',
			providerId: this.authStore.currentUser()?.id || 'prov-demo-101',
			proposalDraft: {
				title: this.proposal().title || 'عرض فني وتطويري',
				message: this.proposal().message,
				price: this.totalAmount || this.totalBudget() || 4500,
				durationDays: this.totalDays() || 14,
				milestonesCount: this.proposal().milestones.length || 2,
				selectedPortfolioIds: this.proposal().portfolioIds
			}
		};

		this.socket.off('ai_audit_progress');
		this.socket.off('ai_audit_result');

		this.socket.on('ai_audit_progress', (data: { status: string; message?: string }) => {
			if (data.message) {
				this.auditProgressMessage.set(data.message);
			} else {
				this.auditProgressMessage.set(`حالة الفحص الذكي: ${data.status}`);
			}
			if (data.status === 'COMPLETED') {
				this.isScanning.set(false);
			}
		});

		this.socket.once('ai_audit_result', (result: AiAuditResult) => {
			this.auditResult.set(result);
			this.isScanning.set(false);
		});

		this.socket.emit('trigger_ai_audit', payload);

		// Safety fallback if WebSocket takes too long or offline
		setTimeout(() => {
			if (this.isScanning()) {
				this.isScanning.set(false);
				if (!this.auditResult()) {
					this.auditResult.set(this.getUnavailableAudit());
				}
			}
		}, 4500);
	}

	getUnavailableAudit(): AiAuditResult {
		return {
			profileAudit: [{ title: 'تعذر إكمال فحص AI', subtitle: 'لم يتم إنشاء تقييم بديل أو درجات وهمية. يمكنك إعادة المحاولة.', status: 'WARNING', badge: 'غير متاح' }],
			triPartyComparison: {
				client: { budget: 'غير متاح', duration: 'غير متاح', milestones: 'غير متاح' },
				provider: { budget: `${this.totalAmount} ريال`, duration: `${this.totalDays()} يوم`, milestones: `${this.proposal().milestones.length} مرحلة` },
				aiRecommendation: { budget: 'لم يُحلل', duration: 'لم يُحلل', milestones: 'لم يُحلل' }
			},
			triPartyNote: 'خدمة التحليل غير متاحة حالياً؛ لم تُولد المنصة أي استنتاج بديل.',
			finalMetrics: { overallScore: 0, profileMatch: 0, messageClarity: 0, priceCompetitiveness: 0, timelineFeasibility: 0, completeness: 0 },
			acceptanceOdds: {
				statusText: 'لم يتم حساب احتمال القبول',
				description: 'أعد تشغيل الفحص للحصول على نتيجة حقيقية.',
				topPercentage: 'غير متاح'
			}
		};
	}

	prevStep() {
		if (this.activeStep() > 1) {
			this.activeStep.update(s => s - 1);
			if (typeof window !== 'undefined') {
				window.scrollTo({ top: 0, behavior: 'smooth' });
			}
		}
	}

	submitProposal() {
		if (!this.reqId() || !this.projectDetails() || !this.ack1() || !this.ack2() || !this.ack3() || this.isSubmitting()) {
			return;
		}

		this.isSubmitting.set(true);

		const payload: any = {
			title: this.proposal().title || 'عرض تنفيذ المشروع',
			message: this.proposal().message,
			advantages: this.proposal().advantages,
			outputs: this.proposal().outputs,
			portfolioIds: this.proposal().portfolioIds,
			totalPrice: this.totalBudget() || this.totalAmount,
			deliveryDays: this.totalDays(),
			milestones: this.proposal().milestones.map((m, index) => ({
				stepOrder: index + 1,
				title: m.name || `المرحلة ${index + 1}`,
				description: m.desc || m.name || 'تفاصيل المرحلة',
				days: Number(m.days || 1),
				percentage: Number(m.pct || 0),
				amount: this.getAmount(m.pct)
			})),
			agreedToTerms: this.ack1() && this.ack2(),
			agreedToEscrow: this.ack3()
		};

		const targetProjectId = this.reqId()!;

		this.http.post<any>(`${environment.url_api}/projects/${targetProjectId}/proposals`, payload)
			.subscribe({
				next: (res) => {
					this.isSubmitting.set(false);
					this.showSuccess.set(true);
					if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
						sessionStorage.removeItem(`draft_proposal_${this.reqId()}`);
					}
					console.log('✅ Proposal successfully submitted to DB and Client notified via Socket.io!', res);
				},
				error: (err) => {
					this.isSubmitting.set(false);
					console.error('Proposal submission failed:', err);
					alert(err.error?.message || 'تعذر إرسال العرض. لم يتم حفظه، يرجى المحاولة مرة أخرى.');
				}
			});
	}

	ngOnDestroy() {
		if (this.socket) {
			this.socket.disconnect();
		}
	}
}
