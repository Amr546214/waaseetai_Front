import { Component, signal, computed, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { io, Socket } from 'socket.io-client';
import { AuthStore } from '../../../../../core/store/auth.store';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';
import { Step1General } from './components/step1-general/step1-general';
import { Step2Pricing } from './components/step2-pricing/step2-pricing';
import { Step3Review } from './components/step3-review/step3-review';
import { Step4Success } from './components/step4-success/step4-success';
import { aiSuggestInputError } from './ai-suggest-input';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';

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
	// Only overallScore (WaseetAI proposal-quality) is real. The backend sends acceptance odds as the fixed
	// 'غير مدعوم' and every other final metric as null, so none of them is modelled or displayed here.
	finalMetrics: {
		overallScore: number | null;
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
	private notify = inject(UiNotificationService);
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
	isFetchingAiSuggest = signal<boolean>(false);
	// no invented default price: it starts empty (0) and is filled from the project's own budget, or by the provider
	totalBudget = signal<number>(0);

	// Step 3 State
	isScanning = signal<boolean>(true);
	auditProgressMessage = signal<string>('جاري استدعاء بيانات المشروع والملف المهني...');
	auditResult = signal<AiAuditResult | null>(null);

	ack1 = signal<boolean>(false);
	ack2 = signal<boolean>(false);
	ack3 = signal<boolean>(false);


	// Step 4 State
	isSubmitting = signal<boolean>(false);
	/** Why the last send failed, shown NEXT TO the send button (the entries, milestones and acknowledgements stay as they are). */
	submitError = signal<{ message: string; code: string | null; link?: { text: string; url: string[] }; backToStep?: number; outcomeUnknown?: boolean } | null>(null);
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

		if (typeof window !== 'undefined') {
			const storageKey = `draft_proposal_v2_${this.reqId()}`;
			const draft = localStorage.getItem(storageKey) || sessionStorage.getItem(storageKey);
			if (draft) {
				try {
					const parsed = JSON.parse(draft);
					const current = this.proposal();
					const cleaned = {
						...current,
						...parsed,
						title: this.formatProposalText(parsed.title ?? current.title, true),
						message: this.formatProposalText(parsed.message ?? current.message, false),
						advantages: (parsed.advantages || parsed.reqs || current.advantages || []).map((a: string) => this.formatProposalText(a, true)),
						milestones: parsed.milestones || current.milestones
					};
					this.proposal.set(cleaned);
					if (typeof parsed.totalBudget === 'number' && parsed.totalBudget > 0) {
						this.totalBudget.set(parsed.totalBudget);
					}
					if (parsed.auditResult) {
						this.auditResult.set(parsed.auditResult);
						this.isScanning.set(false);
					}
					if (typeof parsed.ack1 === 'boolean') this.ack1.set(parsed.ack1);
					if (typeof parsed.ack2 === 'boolean') this.ack2.set(parsed.ack2);
					if (typeof parsed.ack3 === 'boolean') this.ack3.set(parsed.ack3);

					const urlStep = Number(this.route.snapshot.queryParamMap.get('step'));
					const savedStep = Number(parsed.activeStep);
					const targetStep = (urlStep >= 1 && urlStep <= 4) ? urlStep : ((savedStep >= 1 && savedStep <= 4) ? savedStep : 1);
					this.activeStep.set(targetStep);
					this.syncStepQueryParam(targetStep);
				} catch (e) { }
			} else {
				const urlStep = Number(this.route.snapshot.queryParamMap.get('step'));
				if (urlStep >= 1 && urlStep <= 4) {
					this.activeStep.set(urlStep);
				}
			}
		}

		if (id) {
			this.fetchProjectDetails(id);
		} else {
			this.projectLoadError.set('معرّف المشروع غير موجود');
		}

		this.loadAccreditationSamples();
	}

	private syncStepQueryParam(step: number) {
		this.router.navigate([], {
			relativeTo: this.route,
			queryParams: { step },
			queryParamsHandling: 'merge',
			replaceUrl: true
		});
	}

	private formatProposalText(text: string | null | undefined, isSingleLine = false): string {
		if (!text) return '';
		if (isSingleLine) {
			return text
				.replace(/\*\*(.*?)\*\*/g, '$1')
				.replace(/__(.*?)__/g, '$1')
				.replace(/^#{1,6}\s+/gm, '')
				.replace(/^\s*[-*•▸]\s+/gm, '')
				.replace(/`/g, '')
				.replace(/\s+/g, ' ')
				.trim();
		}

		let cleaned = text
			.replace(/\r\n/g, '\n')
			// Turn Markdown headers into section titles on their own line
			.replace(/(?:^|\s+)#{1,6}\s*([^\n]+)/g, '\n\n▸ $1\n')
			// Turn bold headers like **عنوان:** into a section line
			.replace(/\*\*([^*]+?:)\*\*/g, '\n\n▸ $1\n')
			// Strip remaining **bold** and __bold__
			.replace(/\*\*(.*?)\*\*/g, '$1')
			.replace(/__(.*?)__/g, '$1')
			.replace(/`/g, '');

		// 1. Ensure greeting is followed by a blank line (even if attached without space like "تحية طيبة،لقد")
		cleaned = cleaned.replace(/^(تحية طيبة(?:\s+وبعد)?[،,:]?|السلام عليكم(?:\s+ورحمة الله وبركاته)?[،,:]?|مرحباً[،,:]?)\s*/u, '$1\n\n');

		// 2. Break before numbered items even when attached to : or . (e.g. ":1. " or ".2. ")
		cleaned = cleaned.replace(/:\s*(?=1\.\s*)/g, ':\n\n');
		cleaned = cleaned.replace(/([.؛!؟])\s*(?=[1-9]\.\s*)/g, '$1\n');
		cleaned = cleaned.replace(/\s+(?=[1-9]\.\s+)/g, '\n');
		cleaned = cleaned.replace(/^([1-9]\.)\s+/gm, '$1 ');

		// 3. Put inline dash bullets (. - or : - or ؛ - ) on their own lines
		cleaned = cleaned.replace(/([.:؛،])\s*-\s+/g, '$1\n• ');
		cleaned = cleaned.replace(/^\s*[-*]\s+/gm, '• ');

		// 4. Break before transition / intro-to-list / closing sentences even when attached directly after a period
		cleaned = cleaned.replace(/\.\s*(?=(?:نقترح|أقترح|سأعمل|سنعمل|تتضمن خطة|خطة العمل|أنا على ثقة|يسعدني|أتطلع|أتشرف|بانتظار)\s)/g, '.\n\n');

		// 5. Fix any remaining period immediately followed by an Arabic letter without space
		cleaned = cleaned.replace(/\.([أإآابتثجحخدذرزسشصضطظعغفقكلمنهوي])/g, '. $1');

		return cleaned.replace(/\n{3,}/g, '\n\n').trim();
	}

	private buildSynchronizedMilestones(message: string, targetDaysInput?: number | null): Milestone[] {
		const targetDays = Math.max(1, Math.round(Number(targetDaysInput || this.projectDetails()?.deliveryDays) || 5));
		const lines = (message || '').split('\n').map(l => l.trim()).filter(Boolean);
		const parsedSteps: Array<{ name: string; desc: string }> = [];

		for (const line of lines) {
			const match = line.match(/^[1-9]\.\s*([^:：]+?)(?:\s*\(\d+\s*(?:يوم|أيام)\))?\s*[:：]\s*(.+)$/);
			if (match) {
				parsedSteps.push({
					name: this.formatProposalText(match[1], true).slice(0, 80),
					desc: this.formatProposalText(match[2], true).slice(0, 200)
				});
			}
		}

		if (parsedSteps.length === 0) {
			const advs = this.proposal().advantages || [];
			for (const adv of advs.slice(0, 4)) {
				const cleanAdv = this.formatProposalText(adv, true);
				if (cleanAdv) {
					parsedSteps.push({
						name: cleanAdv.split(/[،,:]/)[0].trim().slice(0, 60) || 'مرحلة تنفيذ',
						desc: cleanAdv
					});
				}
			}
		}

		if (parsedSteps.length === 0) {
			parsedSteps.push(
				{ name: 'تحليل المتطلبات وتصميم الواجهة الأمامية (UI/UX)', desc: 'تصميم واجهات المستخدم المتجاوبة وتجربة التصفح' },
				{ name: 'تطوير الواجهة الخلفية وقاعدة البيانات', desc: 'برمجة لوحة التحكم وإدارة المنتجات والمخزون والطلبات' },
				{ name: 'ربط سلة التسوق والدفع والاختبار النهائي', desc: 'تكامل الدفع واختبار الأداء والسرعة والتسليم النهائي' }
			);
		}

		const maxCount = Math.min(parsedSteps.length, targetDays, 5);
		const selected = parsedSteps.slice(0, maxCount);
		const n = selected.length;
		const baseDays = Math.floor(targetDays / n);
		let remDays = targetDays - baseDays * n;
		const basePct = Math.floor(100 / n);
		let remPct = 100 - basePct * n;

		const milestones: Milestone[] = selected.map((st, idx) => {
			const d = baseDays + (remDays > 0 ? 1 : 0);
			if (remDays > 0) remDays--;
			const p = basePct + (remPct >= 5 ? 5 : remPct);
			if (remPct > 0) remPct = Math.max(0, remPct - 5);
			return {
				id: String(idx + 1),
				name: st.name,
				desc: st.desc,
				days: Math.max(1, d),
				pct: p
			};
		});

		const pctSum = milestones.reduce((sum, m) => sum + (Number(m.pct) || 0), 0);
		if (milestones.length > 0 && pctSum !== 100) {
			milestones[0].pct = (Number(milestones[0].pct) || 0) + (100 - pctSum);
		}

		return milestones;
	}

	private syncIncompleteMilestones(targetDaysInput?: number | null) {
		const current = this.proposal();
		const hasIncomplete = !current.milestones?.length || current.milestones.some(m => !m.name?.trim() || !(Number(m.days) > 0) || !(Number(m.pct) > 0));
		if (hasIncomplete && (current.message?.trim() || current.advantages?.length)) {
			const synced = this.buildSynchronizedMilestones(current.message, targetDaysInput);
			this.proposal.update(p => ({
				...p,
				outputs: p.outputs?.trim() ? p.outputs : synced.map((m, i) => `${i + 1}. ${m.name}`).join(' — '),
				milestones: synced
			}));
			this.saveDraft();
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
						if (!(this.totalBudget() > 0)) {
							if (proj.budgetFixed) {
								this.totalBudget.set(Number(proj.budgetFixed));
							} else if (proj.budgetMin && proj.budgetMax) {
								this.totalBudget.set(Math.round((Number(proj.budgetMin) + Number(proj.budgetMax)) / 2));
							}
						}
						this.syncIncompleteMilestones(proj.deliveryDays);
						if (this.activeStep() === 3 && !this.auditResult()) {
							this.triggerAiAudit();
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
		if (typeof window !== 'undefined' && this.reqId()) {
			const storageKey = `draft_proposal_v2_${this.reqId()}`;
			const snapshot = JSON.stringify({
				...this.proposal(),
				activeStep: this.activeStep(),
				totalBudget: this.totalBudget(),
				auditResult: this.auditResult(),
				ack1: this.ack1(),
				ack2: this.ack2(),
				ack3: this.ack3()
			});
			try { sessionStorage.setItem(storageKey, snapshot); } catch {}
			try { localStorage.setItem(storageKey, snapshot); } catch {}
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
	useAISuggest() {
		if (this.isFetchingAiSuggest()) return;
		const current = this.proposal();
		if (!this.reqId()) {
			this.notify.error('معرّف المشروع غير موجود');
			return;
		}
		const inputError = aiSuggestInputError(current.title, current.message);
		if (inputError) {
			this.notify.warning(inputError);
			return;
		}
		this.isFetchingAiSuggest.set(true);

		const payload = {
			projectId: this.reqId()!,
			currentTitle: current.title || '',
			currentMessage: current.message || ''
		};

		this.http.post<any>(`${environment.url_api}/proposals/ai-suggest`, payload)
			.subscribe({
				next: (res) => {
					this.isFetchingAiSuggest.set(false);
					if (res.data) {
						const refinedTitle = this.formatProposalText(res.data.suggestedTitle || this.proposal().title, true);
						const refinedMsg = this.formatProposalText(res.data.suggestedMessage || this.proposal().message, false);
						const suggestedAdvs = (res.data.suggestedAdvantages || []).map((a: string) => this.formatProposalText(a, true));
						const suggestedOutputs = res.data.suggestedOutputs ? this.formatProposalText(res.data.suggestedOutputs, true) : '';
						if (typeof res.data.suggestedTotalPrice === 'number' && res.data.suggestedTotalPrice > 0 && !(this.totalBudget() > 0)) {
							this.totalBudget.set(res.data.suggestedTotalPrice);
						}
						const aiMilestones: Milestone[] = Array.isArray(res.data.suggestedMilestones) && res.data.suggestedMilestones.length > 0
							? res.data.suggestedMilestones.map((m: any, idx: number) => ({
								id: String(idx + 1),
								name: this.formatProposalText(m.name, true),
								desc: this.formatProposalText(m.desc, true),
								days: Math.max(1, Number(m.days) || 1),
								pct: Math.max(1, Number(m.pct) || 100)
							}))
							: this.buildSynchronizedMilestones(refinedMsg, this.projectDetails()?.deliveryDays);

						this.proposal.update(p => ({
							...p,
							title: refinedTitle,
							message: refinedMsg,
							outputs: suggestedOutputs || p.outputs || aiMilestones.map((m, i) => `${i + 1}. ${m.name}`).join(' — '),
							advantages: Array.from(new Set([...p.advantages, ...suggestedAdvs])),
							milestones: aiMilestones
						}));
						this.saveDraft();
					}
				},
				error: (err) => {
					this.isFetchingAiSuggest.set(false);
					console.error('AI Suggest API failed:', err);
					this.notify.error(err.error?.message || 'تعذر تشغيل اقتراح AI ولم يتم تغيير عرضك.');
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
						// Batch 5: no "معتمد AI" claim when no real AI score exists.
						const scoreStr = s.aiScore ? `اعتماد AI ${Math.round(s.aiScore)}%` : null;
						const metaParts: string[] = [specName];
						if (scoreStr) metaParts.push(scoreStr);
						if (techStr) metaParts.push(techStr);

						return {
							id: s.id,
							title: s.title,
							meta: metaParts.join(' · '),
							badge: s.status === 'AI_VERIFIED' || s.status === 'APPROVED' ? '✓' : 'AI',
							gradient: gradients[idx % gradients.length],
							// Batch 5: was `idx === 0 || ...` and rendered as "الأقرب
							// للطلب" — no comparison against the request ever ran,
							// so the first sample was simply declared the closest.
							// Now flags only a real high stored AI accreditation score.
							isBestMatch: typeof s.aiScore === 'number' && s.aiScore >= 90,
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
		this.saveDraft();
	}

	isStep3Valid = computed(() => {
		return this.ack1() && this.ack2() && this.ack3();
	});

	// Navigation
	nextStep() {
		const isValid = this.activeStep() === 1 ? this.isStep1Valid() : (this.activeStep() === 2 ? this.isStep2Valid() : (this.activeStep() === 3 ? this.isStep3Valid() : true));
		if (!isValid) {
			if (this.activeStep() === 2 && this.totalPct() !== 100) {
				this.notify.warning(`إجمالي نسب دفعات المراحل يجب أن يساوي 100% (المجموع الحالي: ${this.totalPct()}%)`);
			} else if (this.activeStep() === 2) {
				this.notify.warning('يرجى تحديد السعر والمدة المطلوبة لكل مرحلة');
			}
			return;
		}
		const next = this.activeStep() + 1;
		this.activeStep.set(next);
		this.syncStepQueryParam(next);
		this.saveDraft();

		if (typeof window !== 'undefined') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}

		if (next === 3) {
			this.triggerAiAudit();
		}
	}

	triggerAiAudit() {
		// Real values only — no placeholder project/provider/price/duration is ever sent.
		const projectId = this.reqId();
		const providerId = this.authStore.currentUser()?.id;
		const title = this.proposal().title?.trim();
		const message = this.proposal().message?.trim();
		const price = this.totalAmount || this.totalBudget();
		const durationDays = this.totalDays();
		if (!projectId || !providerId || !title || !message || !(price > 0) || !(durationDays > 0)) {
			this.auditResult.set(this.getUnavailableAudit());
			this.isScanning.set(false);
			return;
		}

		this.isScanning.set(true);
		this.auditProgressMessage.set('جاري مراجعة جودة العرض...');

		if (!this.socket) {
			let token: string | null = null;
			if (typeof window !== 'undefined') {
				token = localStorage.getItem('waseet_token') || localStorage.getItem('access_token') || localStorage.getItem('token');
				if (!token && typeof document !== 'undefined') {
					token = document.cookie.match(/(?:^|;\s*)waseet_token=([^;]+)/)?.[1] || null;
				}
			}
			this.socket = io(environment.socketUrl, { withCredentials: true, auth: { token } });
		}

		const payload = {
			projectId,
			providerId,
			proposalDraft: {
				title,
				message,
				price,
				durationDays,
				milestonesCount: this.proposal().milestones.length,
				selectedPortfolioIds: this.proposal().portfolioIds
			}
		};

		this.socket.off('ai_audit_progress');
		this.socket.off('ai_audit_result');

		this.socket.on('ai_audit_progress', (data: { status: string; message?: string }) => {
			if (data.message) {
				this.auditProgressMessage.set(data.message);
			} else {
				this.auditProgressMessage.set(`حالة المراجعة: ${data.status}`);
			}
			if (data.status === 'COMPLETED') {
				this.isScanning.set(false);
			}
			// Honest failure — the backend never sends a fabricated ai_audit_result
			// in this case; show the existing empty/unavailable state immediately
			// instead of waiting out the 4.5s safety timeout below.
			if (data.status === 'FAILED') {
				this.isScanning.set(false);
				if (!this.auditResult()) {
					this.auditResult.set(this.getUnavailableAudit());
				}
			}
		});

		this.socket.once('ai_audit_result', (result: AiAuditResult) => {
			this.auditResult.set(result);
			this.isScanning.set(false);
			this.saveDraft();
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
		}, 25000);
	}

	getUnavailableAudit(): AiAuditResult {
		return {
			profileAudit: [{ title: 'تعذر إكمال مراجعة الجودة', subtitle: 'لم يتم إنشاء تقييم بديل أو درجات وهمية. يمكنك المتابعة وتقديم العرض بشكل طبيعي.', status: 'WARNING', badge: 'غير متاح' }],
			triPartyComparison: {
				client: { budget: 'غير متاح', duration: 'غير متاح', milestones: 'غير متاح' },
				provider: { budget: `${this.totalAmount} $`, duration: `${this.totalDays()} يوم`, milestones: `${this.proposal().milestones.length} مرحلة` },
				aiRecommendation: { budget: 'غير مدعوم', duration: 'غير مدعوم', milestones: 'غير مدعوم' }
			},
			triPartyNote: 'يقيّم هذا الفحص نص العرض وخطته وسعره كما كُتبت فقط، ولا يقيس توافقه مع المشروع ولا عدالة السعر مقارنة بميزانية العميل. مراجعة الجودة غير متاحة حالياً ولم تُولد المنصة أي استنتاج بديل.',
			finalMetrics: { overallScore: null }
		};
	}

	prevStep() {
		if (this.activeStep() > 1) {
			const prev = this.activeStep() - 1;
			this.activeStep.set(prev);
			this.syncStepQueryParam(prev);
			this.saveDraft();
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
		this.submitError.set(null);

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
					if (typeof window !== 'undefined') {
						const storageKey = `draft_proposal_v2_${this.reqId()}`;
						try { sessionStorage.removeItem(storageKey); } catch {}
						try { localStorage.removeItem(storageKey); } catch {}
					}
					console.log('✅ Proposal successfully submitted to DB and Client notified via Socket.io!', res);
				},
				error: (err) => {
					this.isSubmitting.set(false);
					this.handleSubmitError(err);
				}
			});
	}

	/** Every refusal names its reason and what to do next; a lost answer is never treated as "not sent": the server refuses a second copy (409 PROPOSAL_ALREADY_SUBMITTED), so pressing send again is safe. */
	private handleSubmitError(err: any) {
		const mapped = mapHttpError(err, { fallback: 'تعذر إرسال العرض. لم يتم حفظه، يرجى المحاولة مرة أخرى.' });
		const code = mapped.code ?? null;
		if (code === 'PROPOSAL_ALREADY_SUBMITTED') {
			// the offer IS saved (earlier tap / lost answer): say so, point to it, and drop the draft so it cannot be sent again
			if (typeof window !== 'undefined') {
				const storageKey = `draft_proposal_v2_${this.reqId()}`;
				try { sessionStorage.removeItem(storageKey); } catch {}
				try { localStorage.removeItem(storageKey); } catch {}
			}
			this.submitError.set({ message: mapped.message, code, link: { text: 'فتح عروضي', url: ['/provider-overview/offers'] } });
			return;
		}
		if (code === 'PROVIDER_DASHBOARD_LOCKED') {
			this.submitError.set({ message: mapped.message, code, link: { text: 'إكمال البيانات المطلوبة', url: ['/provider-overview/profile/data'] } });
			return;
		}
		if (code === 'MILESTONES_PERCENT_SUM') {
			this.submitError.set({ message: mapped.message, code, backToStep: 2 });
			return;
		}
		if (code === 'PROJECT_NOT_OPEN') {
			this.submitError.set({ message: mapped.message, code, link: { text: 'استكشاف طلبات أخرى', url: ['/provider-overview/explore-requests'] } });
			return;
		}
		this.submitError.set({ message: mapped.outcomeUnknown ? 'انقطع الاتصال قبل أن نعرف إن كان عرضك وصل.' : mapped.message, code, outcomeUnknown: mapped.outcomeUnknown });
	}

	goBackToStep(step: number) {
		this.submitError.set(null);
		this.activeStep.set(step);
		if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	ngOnDestroy() {
		if (this.socket) {
			this.socket.disconnect();
		}
	}
}
