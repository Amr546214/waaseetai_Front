import { LevelBadgeComponent } from '../../../../../shared/levels/level-badge.component';
import { Component, signal, computed, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ChatService } from '../../../../../core/services/chat.service';
import { resolveProviderLevelBadgeStyle } from '../../../../../core/utils/provider-level-style.util';
import { assistantMarkdown } from '../../../../../core/help/assistant-content';

interface OfferProviderFit { overallFit: 'HIGH' | 'MEDIUM' | 'LOW'; summary: string; matchPoints: { text: string; basedOn: string[] }[]; gaps: { text: string; basedOn: string[] }[]; }
interface OfferSuitability { status: string; summary: string; }

interface Offer {
	id: string;
	status: string;
	providerId?: string;
	provider?: { id: string; name: string };
	providerName: string;
	providerInitials: string;
	// Batch 5 (truthfulness pass) — the REAL gamification progression level
	// (DashboardService/client-requests.service.ts::resolveProviderProgression),
	// never the accreditation `badge` field. null when the provider genuinely
	// has no progression data — never fabricated.
	providerLevel: string | null;
	levelColor: string;
	specialty: string;
	projectsCount: number;
	// null = genuinely not provided by the backend — never a fabricated
	// default. Templates must show "غير متاح" rather than a fake value.
	rating: number | null;
	matchScore: number | null;
	qualityScore?: number | null;
	providerFit?: OfferProviderFit | null;
	budgetSuitability?: OfferSuitability | null;
	deadlineSuitability?: OfferSuitability | null;
	recommendationRank?: number | null;
	recommendationBasis?: string[];
	price: string;
	duration: string;
	description: string;
	plan: string;
	files: { name: string; url: string }[];
	isBestMatch?: boolean;
	milestones?: {
		id?: string;
		stepOrder?: number;
		title: string;
		description?: string;
		days?: number;
		durationText?: string;
		percentage?: number;
		amount?: number;
		amountFormatted?: string;
	}[];
	// Every field here is only ever populated from a genuine backend AI
	// value — null (never a hardcoded phrase like "مطابق لتقديرات السوق")
	// when the backend didn't return one. Templates show "غير متاح".
	aiAnalysis: {
		/** WaseetAI proposal-quality review (plan/price/days of the proposal only). */
		qualityTag?: string | null;
		qualitySummary?: string | null;
		fairPrice: string | null;
		priceNote: string | null;
		priceNoteType: 'fair' | 'warn';
		fairDuration: string | null;
		durationNote: string | null;
		durationNoteType: 'fair' | 'warn';
		verdict: string | null;
		verdictType: 'fair' | 'warn';
	};
}

@Component({
	selector: 'app-request-details',
	standalone: true,
	imports: [CommonModule, RouterModule, LevelBadgeComponent],
	templateUrl: './request-details.html',
	styleUrl: './request-details.css',
	encapsulation: ViewEncapsulation.None
})
export class RequestDetails implements OnInit {
	/** Arabic label for the quality tag WaseetAI returns (English words); unknown tags are shown as received. */
	private static readonly QUALITY_TAG_AR: Record<string, string> = {
		excellent: 'ممتاز', strong: 'قوي', good: 'جيد', average: 'متوسط', acceptable: 'مقبول', weak: 'ضعيف', poor: 'ضعيف'
	};
	qualityTagAr(tag: string | null | undefined): string | null {
		if (!tag) return null;
		return RequestDetails.QUALITY_TAG_AR[String(tag).trim().toLowerCase()] ?? String(tag);
	}

	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private http = inject(HttpClient);
	public themeService = inject(ThemeService);
	private chatService = inject(ChatService);

	requestId = signal<string>('');
	isLoading = signal<boolean>(true);

	request = signal<any>({
		title: 'جارٍ التحميل...',
		status: 'نشط',
		statusClass: 'op-active',
		statusCode: 'OPEN',
		budget: 'غير محدد',
		specialty: 'غير محدد',
		duration: 'غير محدد',
		publishedAt: '',
		description: 'جارٍ تحميل تفاصيل الطلب والبيانات من قاعدة البيانات...',
		files: []
	});

	offers = signal<Offer[]>([]);
	offerSort = signal<'newest' | 'suitability'>('newest');
	hasRecommendations = computed(() => this.offers().some(offer => offer.recommendationRank != null));
	displayedOffers = computed(() => this.offerSort() === 'newest' ? this.offers() : [...this.offers()].sort((a, b) => (a.recommendationRank ?? Number.MAX_SAFE_INTEGER) - (b.recommendationRank ?? Number.MAX_SAFE_INTEGER)));
	formatProjectDescription(text: string): string { return assistantMarkdown(text); }
	setOfferSort(value: string): void { this.offerSort.set(value === 'suitability' ? 'suitability' : 'newest'); }
	fitLabel(fit: OfferProviderFit | null | undefined): string { return fit ? ({ HIGH: 'ملاءمة مرتفعة', MEDIUM: 'ملاءمة متوسطة', LOW: 'ملاءمة محدودة' }[fit.overallFit]) : 'لم يُراجع الملف بعد'; }
	fitEvidenceLabel(paths: string[]): string {
		const labels: Record<string, string> = {
			'project.title': 'عنوان الطلب', 'project.description': 'وصف الطلب', 'project.requirements': 'متطلبات الطلب',
			'project.requiredSkills': 'المهارات المطلوبة', 'project.category': 'تخصص الطلب', 'project.subSpecialties': 'تخصصات الطلب', 'project.outputs': 'المخرجات المطلوبة',
			'project.budgetMin': 'الميزانية المطلوبة', 'project.budgetMax': 'الميزانية المطلوبة', 'project.budgetFixed': 'الميزانية المطلوبة', 'project.deliveryDays': 'مدة الطلب',
			'provider.skills': 'مهارات المقدم', 'provider.specialties': 'تخصصات المقدم المعتمدة', 'provider.declaredSpecialties': 'تخصصات ملف المقدم',
			'provider.headline': 'عنوان ملف المقدم', 'provider.bio': 'نبذة المقدم', 'provider.portfolioItems': 'الأعمال المسجلة في الملف',
			'provider.yearsOfExperience': 'الخبرة المسجلة في الملف', 'provider.level': 'مستوى المقدم',
			'proposal.title': 'عنوان العرض', 'proposal.message': 'نص العرض', 'proposal.outputs': 'مخرجات العرض', 'proposal.advantages': 'تفاصيل العرض', 'proposal.milestones': 'خطة العرض'
		};
		return [...new Set(paths.map(path => {
			const normalized = path.replace(/\[\d*\]/g, '');
			const field = Object.keys(labels).find(key => normalized === key || normalized.startsWith(`${key}.`));
			return field ? labels[field] : 'البيانات المسجلة';
		}))].join('، ');
	}
	suitabilityLabel(value: OfferSuitability | null | undefined): string {
		return value ? ({ WITHIN_RANGE: 'ضمن الميزانية', BELOW_RANGE: 'أقل من الميزانية', ABOVE_RANGE: 'يتجاوز الميزانية', WITHIN_DEADLINE: 'ضمن المدة المطلوبة', EXCEEDS_DEADLINE: 'يتجاوز المدة المطلوبة', UNKNOWN: 'بيانات غير كافية' } as Record<string, string>)[value.status] ?? 'غير متاح' : 'غير متاح';
	}
	private readProviderFit(value: any): OfferProviderFit | null {
		if (!value || value.source !== 'LLM' || !['HIGH', 'MEDIUM', 'LOW'].includes(value.overallFit) || typeof value.summary !== 'string' || !value.summary.trim()) return null;
		const points = (rows: unknown) => Array.isArray(rows) ? rows.filter(row => row && typeof row.text === 'string' && Array.isArray(row.basedOn)).slice(0, 6).map(row => ({ text: row.text.slice(0, 300), basedOn: row.basedOn.filter((item: unknown) => typeof item === 'string' && item.trim()).slice(0, 6).map((item: string) => item.slice(0, 120)) })) : [];
		return { overallFit: value.overallFit, summary: value.summary.slice(0, 700), matchPoints: points(value.matchPoints), gaps: points(value.gaps) };
	}
	private readSuitability(value: any): OfferSuitability | null { return value && typeof value.status === 'string' && typeof value.summary === 'string' ? { status: value.status, summary: value.summary.slice(0, 700) } : null; }

	// Compare mode state
	isCompareMode = signal<boolean>(false);
	selectedForCompare = signal<string[]>([]);
	// The actual comparison output (Compare Offers' final destination).
	// Reuses the same offers already loaded for this request — no second
	// proposal data source and no extra API call.
	showComparisonView = signal<boolean>(false);
	comparisonOffers = computed<Offer[]>(() => {
		const selectedNames = this.selectedForCompare();
		return this.offers().filter(o => selectedNames.includes(o.providerName));
	});
	comparisonNamesText = computed<string>(() => this.comparisonOffers().map(o => o.providerName).join('، '));

	// Toast state
	showToastSignal = signal<boolean>(false);
	toastMessage = signal<string>('');

	// Negotiation modal state
	showNegModal = signal<boolean>(false);
	negProvider = signal<string>('');
	negPrice = signal<string>('');
	negType = signal<'price' | 'dur' | 'plan' | 'other'>('price');
	negMessage = signal<string>('');

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) {
			this.requestId.set(id);
			this.fetchRequestDetails(id);
		}
	}

	fetchRequestDetails(id: string) {
		this.isLoading.set(true);
		this.http.get<any>(`${environment.url_api}/client/my-requests/${id}`).subscribe({
			next: (res) => {
				if (res && res.success && res.data) {
					const data = res.data;
					let formattedBudget = '';
					if (data.budget) {
						if (data.budget.type === 'RANGE' && data.budget.min && data.budget.max) {
							formattedBudget = `${data.budget.min.toLocaleString()} - ${data.budget.max.toLocaleString()} $`;
						} else if (data.budget.type === 'FIXED' && data.budget.min) {
							formattedBudget = `${data.budget.min.toLocaleString()} $`;
						} else {
							formattedBudget = 'غير محدد';
						}
					}

					let formattedDate = '';
					if (data.createdAt) {
						const d = new Date(data.createdAt);
						formattedDate = d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
					}

					let formattedSpecialty = data.specialty?.nameAr || data.category?.nameAr || '';
					if (data.subSpecialties && data.subSpecialties.length > 0) {
						formattedSpecialty += ` - ${data.subSpecialties.join('، ')}`;
					}

					const statusCode = String(data.status || 'OPEN');
					const statusLabels: Record<string, string> = {
						OPEN: 'مفتوح لاستقبال العروض',
						PENDING_SIGNATURE: 'بانتظار استكمال التوقيع',
						IN_PROGRESS: 'قيد التنفيذ',
						COMPLETED: 'مكتمل',
						CANCELLED: 'ملغي'
					};
					this.request.set({
						title: data.title || '',
						status: data.statusText || statusLabels[statusCode] || statusCode,
						statusCode,
						statusClass: data.statusClass || 'op-active',
						budget: formattedBudget,
						specialty: formattedSpecialty,
						duration: data.expectedDurationDays ? `${data.expectedDurationDays} أيام` : (data.durationText || ''),
						publishedAt: formattedDate || data.publishedTime || data.createdAt || '',
						description: data.description || '',
						files: data.attachments || []
					});

					if (data.proposals && data.proposals.length > 0) {
						const selectionClosed = ['PENDING_SIGNATURE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(statusCode);
						const visibleProposals = selectionClosed
							? data.proposals.filter((prop: any) => ['PENDING_SIGNATURE', 'ACCEPTED'].includes(String(prop.status)))
							: data.proposals.filter((prop: any) => String(prop.status) !== 'REJECTED');
						const mappedOffers = visibleProposals.map((prop: any) => {
							const providerName = prop.provider?.name || (prop.provider?.firstName ? `${prop.provider.firstName} ${prop.provider.lastName}` : 'مقدم خدمة');
							const initials = providerName.split(' ').map((n: string) => n[0] || '').join('').substring(0, 2);
							const providerFit = this.readProviderFit(prop.aiProviderFit);
							const recommendationRank = providerFit && Number.isInteger(prop.aiRecommendationRank) && prop.aiRecommendationRank > 0 ? prop.aiRecommendationRank : null;
							const qualityScore = typeof prop.aiQualityScore === 'number' && Number.isFinite(prop.aiQualityScore) && prop.aiQualityScore >= 0 && prop.aiQualityScore <= 100 ? prop.aiQualityScore : null;
							return {
								id: prop.id,
								status: String(prop.status || 'SUBMITTED'),
								providerId: prop.provider?.id || prop.providerId || prop.id,
								provider: { id: prop.provider?.id || prop.providerId || prop.id, name: providerName },
								providerName: providerName,
								providerInitials: initials || 'مـ',
								providerLevel: prop.provider?.providerLevel ?? null,
								levelColor: resolveProviderLevelBadgeStyle(prop.provider?.providerLevel ?? null).color,
								specialty: prop.provider?.category || prop.provider?.specialty || 'خدمات',
								projectsCount: prop.provider?.completedProjects ?? 0,
								// Never a fabricated default (e.g. a fake 5.0 or 85%) — null
								// when the backend genuinely has no value, so the template can
								// show "غير متاح" instead of a confident-looking fake figure.
								rating: prop.provider?.rating ?? null,
								matchScore: prop.aiMatchPercent ?? prop.aiMatchScore ?? null,
								isBestMatch: recommendationRank === 1,
								qualityScore, providerFit, recommendationRank,
								budgetSuitability: this.readSuitability(prop.budgetSuitability),
								deadlineSuitability: this.readSuitability(prop.deadlineSuitability),
								recommendationBasis: Array.isArray(prop.aiRecommendationBasis) ? prop.aiRecommendationBasis.filter((item: unknown) => typeof item === 'string').slice(0, 6) : [],
								price: prop.totalPrice ? `${prop.totalPrice} $` : (prop.bidAmount ? `${prop.bidAmount} $` : ''),
								duration: prop.deliveryDays ? `${prop.deliveryDays} أيام` : (prop.durationText || ''),
								description: prop.coverLetter || prop.message || prop.description || '',
								plan: prop.outputs || prop.workPlan || '',
								files: prop.attachments || [],
								milestones: prop.milestones || [],
								aiAnalysis: prop.aiFeedback ? {
									qualityTag: this.qualityTagAr(prop.aiQualityTag),
									qualitySummary: prop.aiQualitySummary || null,
									fairPrice: prop.aiFeedback.fairPrice || prop.aiPriceTag || null,
									priceNote: prop.aiFeedback.priceNote || prop.aiPriceTag || null,
									priceNoteType: (prop.aiFeedback.priceNoteType || prop.aiPriceTag || '').includes('أعلى') ? 'warn' : 'fair',
									fairDuration: prop.aiFeedback.fairDuration || null,
									durationNote: prop.aiFeedback.durationNote || null,
									durationNoteType: prop.aiFeedback.durationNoteType || 'fair',
									verdict: prop.aiFeedback.verdict || this.qualityTagAr(prop.aiQualityTag) || null,
									verdictType: prop.aiFeedback.verdictType || (prop.aiQualityTag ? 'fair' : 'warn')
								} : {
									qualityTag: this.qualityTagAr(prop.aiQualityTag),
									qualitySummary: prop.aiQualitySummary || null,
									// No hardcoded "مطابق لتقديرات السوق" / "مناسب لحجم العمل" /
									// "العرض متوافق مع متطلبات المشروع" fallbacks — those asserted
									// a specific AI verdict that was never actually computed.
									// Only genuine backend fields are used; anything missing is
									// null and rendered as "غير متاح".
									fairPrice: prop.aiFairPriceRange || null,
									priceNote: prop.aiPriceMatchStatus || prop.aiPriceTag || null,
									priceNoteType: (prop.aiPriceMatchStatus || prop.aiPriceTag || '').includes('أعلى') ? 'warn' : 'fair',
									fairDuration: null,
									durationNote: null,
									durationNoteType: 'fair',
									verdict: prop.aiBadge || this.qualityTagAr(prop.aiQualityTag) || null,
									verdictType: prop.aiBadge || prop.aiQualityTag ? 'fair' : 'warn'
								}
							};
						});
						this.offers.set(mappedOffers);
					} else {
						this.offers.set([]);
					}
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Error fetching request details from database:', err);
				if (err.status === 401) {
					this.router.navigate(['/auth/login']);
				}
				this.isLoading.set(false);
			}
		});
	}

	goBack() {
		this.router.navigate(['/client-overview/my-requests']);
	}

	// Compare logic
	toggleCompare() {
		const newVal = !this.isCompareMode();
		this.isCompareMode.set(newVal);
		if (!newVal) {
			this.selectedForCompare.set([]);
		}
	}

	toggleSelectOffer(offerName: string, event?: Event) {
		if (!this.isCompareMode()) return;
		if (event) event.stopPropagation();
		const current = this.selectedForCompare();
		if (current.includes(offerName)) {
			this.selectedForCompare.set(current.filter(n => n !== offerName));
		} else {
			if (current.length < 3) {
				this.selectedForCompare.set([...current, offerName]);
			} else {
				this.showToast('يمكنك مقارنة 3 عروض كحد أقصى');
			}
		}
	}

	isSelected(offerName: string): boolean {
		return this.selectedForCompare().includes(offerName);
	}

	confirmCompare() {
		if (this.selectedForCompare().length < 2) return;
		this.showComparisonView.set(true);
	}

	closeComparisonView() {
		this.showComparisonView.set(false);
	}

	cancelCompare() {
		this.selectedForCompare.set([]);
		this.isCompareMode.set(false);
	}

	// Toast logic
	showToast(msg: string) {
		this.toastMessage.set(msg);
		this.showToastSignal.set(true);
		setTimeout(() => {
			this.showToastSignal.set(false);
		}, 3500);
	}

	selectedOffer = signal<Offer | null>(null);
	isSelectingOffer = signal<boolean>(false);

	// Negotiation logic
	openNegotiation(offer: Offer) {
		this.selectedOffer.set(offer);
		this.negProvider.set(offer.providerName);
		this.negPrice.set((offer.price || '').replace(' $', '').trim());
		this.negType.set('price');
		this.negMessage.set('');
		this.showNegModal.set(true);
	}

	closeNegotiation() {
		this.showNegModal.set(false);
	}

	setNegType(type: 'price' | 'dur' | 'plan' | 'other') {
		this.negType.set(type);
	}

	onNegPriceInput(event: Event) {
		const val = (event.target as HTMLInputElement).value;
		this.negPrice.set(val);
	}

	onNegMessageInput(event: Event) {
		const val = (event.target as HTMLTextAreaElement).value;
		this.negMessage.set(val);
	}

	sendNegotiation() {
		const offer = this.selectedOffer();
		if (!offer) {
			this.closeNegotiation();
			return;
		}

		this.showToast('جاري تحويلك لغرفة التفاوض المباشر في وسيط AI...');
		this.closeNegotiation();

		const providerId = offer.providerId || offer.provider?.id || offer.id;
		const negCategory = this.negType() === 'price' ? 'السعر' : (this.negType() === 'dur' ? 'المدة' : (this.negType() === 'plan' ? 'الخطة' : 'تفاوض عام'));
		const priceText = this.negPrice() ? `${this.negPrice()} $` : offer.price;

		const negPayload = {
			isNegotiation: true,
			negType: this.negType(),
			negTypeName: negCategory,
			price: this.negPrice() || offer.price?.replace(' $', '').trim() || '',
			notes: this.negMessage() || '',
			status: 'PENDING'
		};

		this.chatService.initiateConversation({
			projectId: this.requestId().replace('#', ''),
			providerId: providerId,
			offerId: offer.id,
			negotiationPayload: negPayload
		}).subscribe({
			next: (res) => {
				const cid = res?.data?.id || 'c1';
				this.router.navigate(['/client-overview/messages'], { queryParams: { conversationId: cid } });
			},
			error: (err) => {
				console.error('Error initiating negotiation chat:', err);
				this.router.navigate(['/client-overview/messages'], { queryParams: { conversationId: 'c1' } });
			}
		});
	}

	startChat(offer: Offer) {
		const providerId = offer.providerId || offer.provider?.id || offer.id;
		this.showToast('جاري إنشاء وتحويلك لغرفة المحادثة الخاصة بالمشروع...');
		this.chatService.initiateConversation({
			projectId: this.requestId().replace('#', ''),
			providerId: providerId,
			offerId: offer.id
		}).subscribe({
			next: (res) => {
				const cid = res?.data?.id || 'c1';
				this.router.navigate(['/client-overview/messages'], { queryParams: { conversationId: cid } });
			},
			error: (err) => {
				console.error('Error initiating chat:', err);
				this.router.navigate(['/client-overview/messages'], { queryParams: { conversationId: 'c1' } });
			}
		});
	}

	acceptOffer(offer: Offer) {
		if (this.isSelectingOffer()) return;
		this.isSelectingOffer.set(true);
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.requestId()}/offers/select`, { offerId: offer.id })
			.subscribe({
				next: (res) => {
					this.isSelectingOffer.set(false);
					if (!res?.success) {
						this.showToast(res?.message || 'تعذر اختيار العرض');
						return;
					}
					this.router.navigate(['/client-overview/my-requests', this.requestId(), 'contract'], {
						queryParams: { offerId: offer.id }
					});
				},
				error: (err) => {
					this.isSelectingOffer.set(false);
					this.showToast(err.error?.message || 'تعذر اختيار العرض، حاول مرة أخرى');
				}
			});
	}

	isOfferSelectionClosed(): boolean {
		return ['PENDING_SIGNATURE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(this.request().statusCode);
	}

	requestStateMessage(): string {
		switch (this.request().statusCode) {
			case 'PENDING_SIGNATURE': return 'تم اختيار العرض، ويجري استكمال التوقيع والضمان';
			case 'IN_PROGRESS': return 'تم توقيع العقد من الطرفين — المشروع قيد التنفيذ';
			case 'COMPLETED': return 'تم إكمال المشروع وإغلاق استقبال العروض';
			case 'CANCELLED': return 'تم إلغاء الطلب';
			default: return 'استقبال العروض متوقف';
		}
	}

	goToActiveProject() {
		this.router.navigate(['/client-overview/projects/active']);
	}
}
