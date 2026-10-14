import { LevelBadgeComponent } from '../../../../../shared/levels/level-badge.component';
import { Component, signal, computed, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { ThemeService } from '../../../../../core/services/theme.service';
import { ChatService } from '../../../../../core/services/chat.service';
import { resolveProviderLevelBadgeStyle } from '../../../../../core/utils/provider-level-style.util';

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
	price: string;
	duration: string;
	description: string;
	plan: string;
	files: { name: string; url: string }[];
	isBestMatch?: boolean;
	/** What the client may do with this offer RIGHT NOW, from the server; `blockedReason` is the server's reason when select / negotiate is not allowed. Absent = not stated (the server still enforces). */
	actions?: { canSelect: boolean; canNegotiate: boolean; canChat: boolean; blockedReason: string | null; chatBlockedReason: string | null } | null;
	/** The provider's counter offer waiting for the client's answer (accept / decline), from the structured negotiation messages. */
	negotiation?: { state: 'NONE' | 'REQUEST_SENT' | 'COUNTER_PENDING'; counter: { messageId: string; price: number | null; deliveryDays: number | null; notes: string } | null } | null;
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

	/** Stage -> status pill style (the label itself comes from the server). */
	private static readonly STAGE_CLASS: Record<string, string> = {
		DRAFT: 'op-draft', OPEN: 'op-active', OFFERS_RECEIVED: 'op-active', UNDER_NEGOTIATION: 'op-pending',
		AWAITING_CLIENT_SIGNATURE: 'op-pending', AWAITING_FUNDING: 'op-pending', AWAITING_PROVIDER_SIGNATURE: 'op-pending',
		ACTIVE: 'op-active', COMPLETED: 'op-done', CANCELLED: 'op-cancel', DISPUTED: 'op-dispute'
	};

	request = signal<any>({
		title: 'جارٍ التحميل...',
		status: 'جارٍ التحميل',
		statusClass: 'op-pending',
		statusCode: 'OPEN',
		stage: '',
		selectedOfferId: null as string | null,
		budget: 'غير محدد',
		specialty: 'غير محدد',
		duration: 'غير محدد',
		publishedAt: '',
		description: 'جارٍ تحميل تفاصيل الطلب والبيانات من قاعدة البيانات...',
		files: []
	});

	offers = signal<Offer[]>([]);

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
					// the server derives the stage from the request + its contract + the offers; the old guess from the request status alone is only the fallback
					const stage = String(data.stage || '');
					this.request.set({
						title: data.title || '',
						status: data.stageLabel || data.statusText || statusLabels[statusCode] || statusCode,
						statusCode,
						stage,
						selectedOfferId: data.selectedOfferId || null,
						statusClass: RequestDetails.STAGE_CLASS[stage] || data.statusClass || 'op-active',
						budget: formattedBudget,
						specialty: formattedSpecialty,
						duration: data.expectedDurationDays ? `${data.expectedDurationDays} أيام` : (data.durationText || 'غير محدد'),
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
							const isBest = prop.aiBadge !== null && (prop.aiMatchPercent >= 90 || prop.aiMatchScore >= 90);
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
								isBestMatch: isBest,
								price: prop.totalPrice ? `${prop.totalPrice} $` : (prop.bidAmount ? `${prop.bidAmount} $` : ''),
								duration: prop.deliveryDays ? `${prop.deliveryDays} أيام` : (prop.durationText || ''),
								description: prop.coverLetter || prop.message || prop.description || '',
								plan: prop.outputs || prop.workPlan || '',
								files: prop.attachments || [],
								milestones: prop.milestones || [],
								actions: prop.actions || null,
								negotiation: prop.negotiation || null,
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
	isSendingNegotiation = signal<boolean>(false);
	/** The offer whose counter offer is being answered right now (blocks double clicks). */
	answeringOfferId = signal<string | null>(null);

	private errorText(err: any, fallback: string): string {
		return err?.error?.message || fallback;
	}

	/** Why select / negotiate is not available for this offer (server's reason); null = available. */
	offerBlockedReason(offer: Offer): string | null {
		return offer.actions?.blockedReason ?? null;
	}
	canSelectOffer(offer: Offer): boolean {
		return offer.actions ? offer.actions.canSelect : true;
	}
	canNegotiateOffer(offer: Offer): boolean {
		return offer.actions ? offer.actions.canNegotiate : true;
	}
	canChatOffer(offer: Offer): boolean {
		return offer.actions ? offer.actions.canChat : true;
	}
	hasPendingCounter(offer: Offer): boolean {
		return offer.negotiation?.state === 'COUNTER_PENDING' && !!offer.negotiation.counter;
	}

	// Negotiation logic
	// Only a live offer can be negotiated (same rule as the server: SUBMITTED / PENDING / UNDER_NEGOTIATION). Returns the visible Arabic reason when it cannot.
	negotiationBlockReason(offer: Offer): string | null {
		switch (String(offer.status || '').toUpperCase()) {
			case 'CANCELLED': return 'لا يمكن التفاوض على هذا العرض لأن مقدم الخدمة سحبه';
			case 'REJECTED': return 'لا يمكن التفاوض على هذا العرض لأنه مرفوض';
			case 'ACCEPTED': return 'لا يمكن التفاوض على هذا العرض لأنه مقبول بالفعل';
			case 'PENDING_SIGNATURE': return 'لا يمكن التفاوض على هذا العرض لأنه مختار وبانتظار التوقيع';
			case 'DRAFT':
			case 'IN_AI_REVIEW': return 'لا يمكن التفاوض على هذا العرض في حالته الحالية';
			default: return null;
		}
	}

	negDuration = signal<string>('');

	/** The reason the negotiate button is off: the offer's own state (same rule as the server) or the server's reason for the whole request. */
	negotiateDisabledReason(offer: Offer): string | null {
		return this.negotiationBlockReason(offer) || (this.canNegotiateOffer(offer) ? null : (this.offerBlockedReason(offer) || 'لا يمكن التفاوض على هذا العرض حاليًا'));
	}

	openNegotiation(offer: Offer) {
		const blocked = this.negotiateDisabledReason(offer);
		if (blocked) {
			this.showToast(blocked);
			return;
		}
		this.selectedOffer.set(offer);
		this.negProvider.set(offer.providerName);
		this.negPrice.set((offer.price || '').replace(' $', '').trim());
		this.negDuration.set('');
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

	onNegDurationInput(event: Event) {
		this.negDuration.set((event.target as HTMLInputElement).value);
	}

	onNegMessageInput(event: Event) {
		const val = (event.target as HTMLTextAreaElement).value;
		this.negMessage.set(val);
	}

	/** What the request form allows: a clear number for price / duration, a note for plan / other. Returns the Arabic reason when it is not valid, null when it is. */
	negValidationError(): string | null {
		const plain = (v: string) => v.replace(/[\s,$]/g, '');
		if (this.negType() === 'price') {
			const n = Number(plain(this.negPrice()));
			if (!plain(this.negPrice()) || !Number.isFinite(n) || n <= 0) return 'أدخل السعر المقترح رقمًا صحيحًا';
		} else if (this.negType() === 'dur') {
			const n = Number(plain(this.negDuration()));
			if (!plain(this.negDuration()) || !Number.isInteger(n) || n < 1) return 'أدخل المدة المقترحة بالأيام رقمًا صحيحًا';
		} else if (!this.negMessage().trim()) {
			return 'اكتب ملاحظتك لمقدم الخدمة';
		}
		return null;
	}

	sendNegotiation() {
		const offer = this.selectedOffer();
		if (!offer) {
			this.closeNegotiation();
			return;
		}
		if (this.isSendingNegotiation()) return;
		const invalid = this.negValidationError();
		if (invalid) {
			this.showToast(invalid);
			return;
		}

		const providerId = offer.providerId || offer.provider?.id || offer.id;
		const negCategory = this.negType() === 'price' ? 'السعر' : (this.negType() === 'dur' ? 'المدة' : (this.negType() === 'plan' ? 'الخطة' : 'تفاوض عام'));
		const plain = (v: string) => v.replace(/[\s,$]/g, '');

		// only the field being negotiated carries a number: a "duration" request must not look like a price request
		const negPayload = {
			isNegotiation: true,
			negType: this.negType(),
			negTypeName: negCategory,
			price: this.negType() === 'price' ? plain(this.negPrice()) : '',
			duration: this.negType() === 'dur' ? plain(this.negDuration()) : '',
			notes: this.negMessage().trim(),
			status: 'PENDING'
		};

		this.isSendingNegotiation.set(true);
		this.chatService.initiateConversation({
			projectId: this.requestId().replace('#', ''),
			providerId: providerId,
			offerId: offer.id,
			negotiationPayload: negPayload
		}).subscribe({
			next: (res) => {
				this.isSendingNegotiation.set(false);
				const cid = res?.data?.id;
				if (!cid) {
					this.showToast('تعذر فتح غرفة التفاوض، حاول مرة أخرى');
					return;
				}
				this.closeNegotiation();
				this.router.navigate(['/client-overview/messages'], { queryParams: { conversationId: cid } });
			},
			error: (err) => {
				this.isSendingNegotiation.set(false);
				this.closeNegotiation();
				this.showToast(this.errorText(err, 'تعذر إرسال طلب التفاوض، حاول مرة أخرى'));
				// the reason may be a state change (offer withdrawn / chosen): reload so the buttons match the server
				this.fetchRequestDetails(this.requestId());
			}
		});
	}

	startChat(offer: Offer) {
		if (!this.canChatOffer(offer)) {
			this.showToast(offer.actions?.chatBlockedReason || 'المحادثة غير متاحة حاليًا');
			return;
		}
		const providerId = offer.providerId || offer.provider?.id || offer.id;
		this.chatService.initiateConversation({
			projectId: this.requestId().replace('#', ''),
			providerId: providerId,
			offerId: offer.id
		}).subscribe({
			next: (res) => {
				const cid = res?.data?.id;
				if (!cid) {
					this.showToast('تعذر فتح المحادثة، حاول مرة أخرى');
					return;
				}
				this.router.navigate(['/client-overview/messages'], { queryParams: { conversationId: cid } });
			},
			error: (err) => {
				this.showToast(this.errorText(err, 'تعذر فتح المحادثة، حاول مرة أخرى'));
			}
		});
	}

	acceptOffer(offer: Offer) {
		if (this.isSelectingOffer()) return;
		if (!this.canSelectOffer(offer)) {
			this.showToast(this.offerBlockedReason(offer) || 'لا يمكن اختيار هذا العرض حاليًا');
			return;
		}
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
					this.showToast(this.errorText(err, 'تعذر اختيار العرض، حاول مرة أخرى'));
					this.fetchRequestDetails(this.requestId());
				}
			});
	}

	/** Accept / decline the provider's newest counter offer. Accepting really changes the offer's price and duration on the server (before any contract). */
	answerCounter(offer: Offer, action: 'accept' | 'decline') {
		const counter = offer.negotiation?.counter;
		if (!counter || this.answeringOfferId()) return;
		this.answeringOfferId.set(offer.id);
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.requestId()}/offers/${offer.id}/counter/${action}`, { messageId: counter.messageId })
			.subscribe({
				next: (res) => {
					this.answeringOfferId.set(null);
					this.showToast(res?.message || (action === 'accept' ? 'تم قبول العرض المضاد' : 'تم رفض العرض المضاد'));
					this.fetchRequestDetails(this.requestId());
				},
				error: (err) => {
					this.answeringOfferId.set(null);
					this.showToast(this.errorText(err, 'تعذر تنفيذ الإجراء، حاول مرة أخرى'));
					this.fetchRequestDetails(this.requestId());
				}
			});
	}

	acceptCounter(offer: Offer) { this.answerCounter(offer, 'accept'); }
	declineCounter(offer: Offer) { this.answerCounter(offer, 'decline'); }

	isOfferSelectionClosed(): boolean {
		return ['PENDING_SIGNATURE', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(this.request().statusCode);
	}

	/** The state message of a request whose offer selection is closed - from the server's stage, so a request waiting for funding never reads as running. */
	requestStateMessage(): string {
		switch (this.request().stage) {
			case 'AWAITING_CLIENT_SIGNATURE': return 'تم اختيار العرض، بانتظار توقيعك وتمويل الضمان';
			case 'AWAITING_FUNDING': return 'تم اختيار العرض، بانتظار تمويل الضمان';
			case 'AWAITING_PROVIDER_SIGNATURE': return 'وقّعت العقد، بانتظار توقيع مقدم الخدمة';
			case 'ACTIVE': return 'تم توقيع العقد من الطرفين وتمويل الضمان، المشروع قيد التنفيذ';
			case 'DISPUTED': return 'يوجد نزاع مفتوح على هذا المشروع';
		}
		switch (this.request().statusCode) {
			case 'PENDING_SIGNATURE': return 'تم اختيار العرض، ويجري استكمال التوقيع والضمان';
			case 'IN_PROGRESS': return 'المشروع قيد التنفيذ';
			case 'COMPLETED': return 'تم إكمال المشروع وإغلاق استقبال العروض';
			case 'CANCELLED': return 'تم إلغاء الطلب';
			default: return 'استقبال العروض متوقف';
		}
	}

	/** The one real next step for a closed request: continue the contract (signature / funding) or open the running project; null = nothing to do here. */
	closedStateAction(): { label: string; run: () => void } | null {
		const id = this.requestId();
		switch (this.request().stage) {
			case 'AWAITING_CLIENT_SIGNATURE':
			case 'AWAITING_FUNDING': {
				const offerId = this.selectedOfferLegacyId();
				if (!offerId) return null;
				return { label: 'متابعة التوقيع والضمان', run: () => this.router.navigate(['/client-overview/my-requests', id, 'contract'], { queryParams: { offerId } }) };
			}
			case 'ACTIVE':
			case 'DISPUTED':
				return { label: 'متابعة المشروع', run: () => this.goToActiveProject() };
			default:
				return null;
		}
	}

	/** The chosen offer as this page knows it (the legacy mirror id the contract page expects). */
	private selectedOfferLegacyId(): string | null {
		return this.offers().find(o => ['PENDING_SIGNATURE', 'ACCEPTED'].includes(o.status))?.id ?? null;
	}

	goToActiveProject() {
		this.router.navigate(['/client-overview/projects/active']);
	}
}
