import { isRateLimitError } from '../../../../../core/utils/rate-limit.util';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { ProjectMiniChat } from '../../../../../sheards/project-mini-chat/project-mini-chat';
import { DisputeModal } from '../../../../../sheards/dispute-modal/dispute-modal';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { CreateDisputePayload } from '../../../../../core/models/dispute.model';
import { ChatService, MessageContext } from '../../../../../core/services/chat.service';
import { RatingSummary } from '../../../../../sheards/rating-summary/rating-summary.component';
import { sortAmendments, upsertAmendment } from '../../../../../core/utils/amendment-list';
import { RatingApiService } from '../../../../../core/services/rating-api.service';
import { RatingStatus } from '../../../../../core/models/rating.model';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { ClientCompanyTeamService } from '../../../../../core/services/client-company-team.service';
import { AMENDMENT_PROPOSED_CHANGE_LABEL, amendmentApprovedBadge, amendmentBudgetPart, amendmentEffectNote, amendmentNeedsPayment, amendmentActionBlockedReason } from '../../../../../core/constants/amendment-effect';
import { AmendmentActionsService } from '../../../../../core/services/amendment-actions.service';
import { AmendmentPaymentOtpComponent } from '../../../../../sheards/amendment-payment-otp/amendment-payment-otp.component';
import { ClientCompanyTeamMember } from '../../../../../core/models/client-company-team.model';
import { formatMoney } from '../../../../../core/utils/money.util';
import { deliveryFileOpenUrl } from '../../../../../core/utils/delivery-file.util';

type WorkspaceTab = 'overview' | 'miles' | 'msgs' | 'files';
type AmendKind = 'SCOPE' | 'BUDGET' | 'DURATION' | 'MIXED';

export const CLIENT_AMENDMENT_SUCCESS_TEXT = 'يصل الطلب إلى مقدم الخدمة، ولا يتغير السعر أو المدة أو الضمان أو محفظتك قبل موافقته؛ وعند موافقته يُطبَّق التعديل فورًا.';
export const CLIENT_AMENDMENT_STATUS_LABEL: Record<string, string> = { PENDING_OTHER_PARTY: 'بانتظار رد مقدم الخدمة', APPROVED: 'وافق مقدم الخدمة', REJECTED: 'رفضه مقدم الخدمة', CANCELLED: 'أُلغي' };
export const CLIENT_AMENDMENT_TYPE_LABEL: Record<string, string> = { SCOPE: 'تغيير النطاق', BUDGET: 'تعديل الميزانية', DURATION: 'تعديل المدة', MIXED: 'تعديل متعدد' };

@Component({
	selector: 'app-project-details', standalone: true,
	imports: [CommonModule, FormsModule, RouterModule, RatingSummary, ProjectMiniChat, DisputeModal, AmendmentPaymentOtpComponent],
	templateUrl: './project-details.html', styleUrl: './project-details.css',
})
export class ProjectDetails implements OnInit {
	private http = inject(HttpClient);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private chatService = inject(ChatService);
	private destroyRef = inject(DestroyRef);
	private disputeApi = inject(DisputeApiService);
	private ratingApi = inject(RatingApiService);
	private authStore = inject(AuthStore);
	private clientTeamService = inject(ClientCompanyTeamService);
	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

	// Batch 6 — real "الموظف المسؤول عن المتابعة" (responsible employee)
	// assignment, backed by Project.assignedEmployeeId. data().employee comes
	// from the real backend (GET workspace); this state is only for the
	// assignment picker UI. Backend remains authoritative — only ACTIVE
	// roster members are offered here, but the server independently
	// re-validates on write.
	showAssignPicker = signal(false);
	employeeOptions = signal<ClientCompanyTeamMember[]>([]);
	isLoadingEmployeeOptions = signal(false);
	isAssigning = signal(false);
	assignError = signal('');
	project = signal<any>(null);
	isLoading = signal(true);
	error = signal('');
	saving = signal(false);
	activeTab = signal<WorkspaceTab>('overview');
	// P-SK-015 inline delivery review state (replaces old modal)
	inlineReviewStage = signal<any>(null);
	reviewDecision = signal<'approve' | 'revision'>('approve');
	reviewNote = '';

	// Change request ("طلب تعديل"): a REAL request recorded by the backend (POST /client/projects/:projectId/amendments) that waits for the provider.
	// It never opens the chat instead, and it never claims the contract changes by itself.
	amendOpen = signal(false);
	amendKind: AmendKind = 'SCOPE'; amendTitle = ''; amendDescription = ''; amendBudget: number | null = null; amendDays: number | null = null;
	amendSaving = signal(false); amendError = signal(''); amendSuccess = signal(false);
	amendments = signal<any[]>([]); amendmentsLoading = signal(false); amendmentsError = signal('');
	readonly amendmentSuccessText = CLIENT_AMENDMENT_SUCCESS_TEXT;
	hasPendingAmendment = () => this.amendments().some(a => a.requestedByRole === 'CLIENT' && a.status === 'PENDING_OTHER_PARTY');
	protected projectId = '';
	showDisputeModal = signal(false);
	isSubmittingDispute = signal(false);
	disputeSuccess = signal('');
	disputeError = signal('');
	disputeSubmitted = signal(false);
	// Rating status — fetched from completed-projects endpoint (server-side Review table).
	hasRated = signal(false);
	ratingStatus = signal<RatingStatus | null>(null);
	finalProviderRating = signal<number | null>(null);
	finalProviderRatingComment = signal<string | null>(null);
	finalProviderRatedAt = signal<string | null>(null);

	ngOnInit() {
		this.route.params.subscribe(params => { this.projectId = params['id']; this.load(); });
		// ?tab=messages (notification links, the project-message buttons) opens the project's own messages tab
		this.route.queryParamMap.subscribe(q => { if (q.get('tab') === 'messages') this.activeTab.set('msgs'); });
		// a project event of this project (amendment answered / authorised / applied by the other party) refreshes the list; rows are keyed by id, never doubled
		this.chatService.projectEvent$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(e => { if (e?.amendmentId && this.amendOpen()) this.loadAmendments(); });
	}
	load() {
		this.isLoading.set(true); this.error.set('');
		this.http.get<any>(`${environment.url_api}/client/my-requests/${this.projectId}/workspace`).subscribe({
			next: response => {
				if (!response?.success || !response.data) this.error.set('تعذر تحميل مساحة العمل');
				else {
					this.project.set(response.data);
					// Rating eligibility + the saved review come from the server (never assumed). On a read error NO rating call-to-action is shown.
					this.ratingApi.getRatingStatus('client', this.projectId).subscribe({
						next: status => {
							this.ratingStatus.set(status);
							this.hasRated.set(!!status.review);
							this.finalProviderRating.set(status.review ? Number(status.review.rating) : null);
							this.finalProviderRatingComment.set(status.review?.comment ?? null);
							this.finalProviderRatedAt.set(status.review?.createdAt ?? null);
						},
						error: (e) => { if (!isRateLimitError(e)) this.ratingStatus.set(null); },
					});
				}
				this.isLoading.set(false);
			},
			error: event => { this.error.set(event.error?.message || 'تعذر تحميل مساحة العمل'); this.isLoading.set(false); }
		});
	}
	setTab(tab: WorkspaceTab) { this.activeTab.set(tab); }
	approvedCount(data: any) { return data.stages.filter((stage: any) => stage.status === 'completed').length; }
	totalFiles(data: any) { return data.files.reduce((sum: number, group: any) => sum + group.files.length, 0); }
	latestThread(stage: any) { return stage.threads?.[stage.threads.length - 1] || null; }
	// Find the current stage under review (submitted status)
	currentReviewStage(data: any): any {
		return data.stages.find((s: any) => s.status === 'submitted') || null;
	}
	// === Batch 8 — real, on-demand Gemini project health analysis ===
	// Replaces the previously-permanent aiInsights placeholder. Not fetched
	// automatically on page load — the user explicitly requests it via
	// analyzeProjectHealth(), and these helpers prefer that real result over
	// the honest static placeholder still returned inline on project().
	// aiInsights. On failure, healthAnalysisError is set and the placeholder
	// is NOT silently re-shown as if it were a real result.
	healthAnalysis = signal<any>(null);
	healthAnalysisLoading = signal(false);
	healthAnalysisError = signal(false);

	analyzeProjectHealth(): void {
		if (!this.projectId || this.healthAnalysisLoading()) return;
		this.healthAnalysisLoading.set(true);
		this.healthAnalysisError.set(false);
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/health`, {}).subscribe({
			next: (res) => {
				this.healthAnalysisLoading.set(false);
				if (res?.success && res.data) {
					this.healthAnalysis.set(res.data);
				} else {
					this.healthAnalysisError.set(true);
				}
			},
			error: () => {
				this.healthAnalysisLoading.set(false);
				this.healthAnalysisError.set(true);
			}
		});
	}

	private currentAiInsights(data: any): any {
		return this.healthAnalysis() || data?.aiInsights;
	}
	aiMatchPct(data: any): string {
		const v = this.currentAiInsights(data)?.matchPercentage;
		return v ? v + '٪' : 'غير متاح';
	}
	aiConfidence(data: any): string {
		const v = this.currentAiInsights(data)?.confidence;
		return v ? v + '٪' : 'غير متاح';
	}
	aiEarlyDays(data: any): string {
		const v = this.currentAiInsights(data)?.earlyDays;
		return v ? String(v) : '—';
	}
	aiRiskLevel(data: any): string {
		return this.currentAiInsights(data)?.riskLevel || 'غير محسوبة';
	}
	aiBullets(data: any): string[] {
		const bullets = this.currentAiInsights(data)?.bullets;
		if (bullets?.length) return bullets;
		return ['لا تتوفر تحليلات كافية بعد — ستظهر هنا بمجرد توفر بيانات كافية عن سير المشروع'];
	}
	// Quality check note for the current submitted stage. There is no
	// aiQualityNote (or any automated pass/fail check) field anywhere in the
	// backend, so a fixed "passed AI check" sentence here would claim an
	// inspection that never happened (same class of bug already fixed for
	// aiMatchPct/aiConfidence/aiEarlyDays/aiRiskLevel/aiBullets above). Honest
	// fallback only — a real, on-demand advisory review is available from the
	// "مراجعة التسليم بالذكاء الاصطناعي" action on the delivery review page.
	qualityNote(stage: any): string {
		if (stage?.aiQualityNote) return stage.aiQualityNote;
		return 'لا توجد ملاحظة جودة آلية لهذا التسليم بعد';
	}
	// Delivery files count for a stage
	stageFileCount(stage: any): number {
		const last = this.latestThread(stage);
		return last?.files?.length || 0;
	}
	formatNumber(value: number) { return formatMoney(value || 0); }
	formatDate(value: string | Date | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short' }).format(new Date(value));
	}
	/** Closed by a dispute settlement (the server's lifecycle flag, or the older adminSettled marker). */
	isSettled(data: any): boolean { return data?.closedBySettlement === true || !!data?.adminSettled; }
	openUrl(file: any): string | null { return deliveryFileOpenUrl(file); }
	/** A delivery is really waiting for the client (server lifecycle; older backend: the stored status). Never true for a settled / undelivered stage. */
	awaitingReview(stage: any): boolean {
		if (this.stageClosedBySettlement(stage)) return false;
		const lc = stage?.lifecycle;
		return lc ? lc.awaitingClientReview === true && !lc.closedBySettlement : stage?.status === 'submitted';
	}
	/** Per-action eligibility straight from the server (with the Arabic reason). */
	canApprove(stage: any): boolean { const e = stage?.lifecycle?.eligibility?.approve; return e ? e.allowed === true : stage?.status === 'submitted'; }
	canRevise(stage: any): boolean { const e = stage?.lifecycle?.eligibility?.requestRevision; return e ? e.allowed === true : stage?.status === 'submitted'; }
	blockReason(stage: any): string | null { return stage?.lifecycle?.eligibility?.approve?.reason ?? null; }
	/** Unreleased stage of a project closed by a dispute settlement: shown as such (derived by the server; nothing was approved). */
	stageClosedBySettlement(stage: any): boolean { return stage?.displayStatus === 'CLOSED_BY_SETTLEMENT'; }
	/** Header status of the project: the settlement label for a settled project, otherwise the server label. */
	headerStatusLabel(data: any): string { return data?.adminSettled?.label || data?.statusLabel; }
	amendmentBlockedReason(a: any): string | null { return amendmentActionBlockedReason(a); }
	statusHint(stage: any) {
		if (this.stageClosedBySettlement(stage)) return stage.displayStatusLabel || 'أُغلقت بالتسوية';
		if (stage.status === 'completed') return `اكتملت واعتمدت${stage.completedDate ? ` · ${this.formatDate(stage.completedDate)}` : ''}`;
		if (stage.status === 'submitted' && stage.revisionResubmitted) return `أعاد مقدم الخدمة التسليم بعد ملاحظاتك · ${stage.roundsCount} تسليمات، بانتظار قرارك`;
		if (stage.status === 'submitted') return `قيد المراجعة · ${stage.roundsCount} ${stage.roundsCount === 1 ? 'تسليم' : 'تسليمات'}، بانتظار قرارك`;
		if (stage.status === 'revision') return 'طلبت تعديلًا، بانتظار إعادة التسليم من مقدم الخدمة';
		if (stage.status === 'in_progress') return 'قيد العمل لدى مقدم الخدمة';
		return 'تبدأ بعد اعتماد المرحلة السابقة';
	}
	/** Money label of a stage: released, really held in escrow, or just its value (nothing is held before the escrow is funded). */
	stageMoneyLabel(stage: any): string {
		const amount = `${this.formatNumber(stage.amount)} $`;
		if (this.stageClosedBySettlement(stage)) return `قيمة المرحلة ${amount} (تعاقدية سابقة، وليست مبلغًا ينتظر الإفراج)`;
		if (stage.status === 'completed') return `أُفرج ${amount}`;
		return stage.amountHeld ? `محتجز ${amount}` : `قيمة المرحلة ${amount}`;
	}
	/** The contract is running (money held, work under way). Before that nothing counts down and nothing can be delivered. */
	isRunning(data: any): boolean { return data?.contractStatus === 'ACTIVE' || data?.contractStatus === 'COMPLETED' || data?.contractStatus === 'DISPUTED'; }
	/** Why the contract has not started (null when it did). */
	notStartedReason(data: any): string | null {
		if (this.isRunning(data)) return null;
		if (data?.escrowFunded) return 'وقّعت العقد وأودعت الضمان، وبانتظار توقيع مقدم الخدمة ليبدأ التنفيذ.';
		return 'العقد لم يبدأ بعد: لم يُوقَّع ولم يُودَع الضمان، فلا يُحتجز أي مبلغ ولا يبدأ التنفيذ.';
	}
	/** Dispute / change-request are only possible on a running contract (the server refuses them otherwise). */
	actionBlockedReason(data: any): string | null {
		return this.isRunning(data) ? null : 'متاح بعد بدء العقد (توقيع الطرفين وتمويل الضمان)';
	}
	/** Deadline status from the contract's own duration; no AI rating and no default "good". */
	deadlineRating(data: any) {
		if (!this.isRunning(data)) return 'لم يبدأ';
		if (data.adminSettled) return data.adminSettled.label;
		if (data.contractStatus === 'COMPLETED') return 'مكتمل';
		if (data.daysLeft <= 0 && data.progress < 100) return 'تجاوز المدة';
		return 'ضمن المدة';
	}
	// P-SK-015: navigate to the full delivery review page (no modal).
	/** Dispute freeze reason (Arabic) while approvals / releases are frozen by an open dispute; null otherwise. */
	freezeReason(data: any): string | null { const f = data?.disputeFreeze; return f?.frozen ? (f.reason || 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح على هذا المشروع') : null; }
	openReview(stage: any, decision: 'approve' | 'revision') {
		this.error.set('');
		if (decision === 'approve' && this.freezeReason(this.project())) { this.error.set(this.freezeReason(this.project())!); return; }
		// Both decisions happen on the delivery review page, which calls the real review endpoint (approve, or a recorded revision request).
		this.router.navigate(['/client-overview/projects', this.projectId, 'delivery-review', stage.id], decision === 'revision' ? { queryParams: { action: 'revision' } } : undefined);
	}
	closeReview() { if (!this.saving()) this.inlineReviewStage.set(null); }
	submitReview() {
		const stage = this.inlineReviewStage(); if (!stage) return;
		if (this.reviewDecision() === 'approve' && this.freezeReason(this.project())) { this.error.set(this.freezeReason(this.project())!); return; }
		this.saving.set(true);
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/stages/${stage.id}/review`, { decision: this.reviewDecision(), note: this.reviewNote.trim() }).subscribe({
			next: () => { this.saving.set(false); this.inlineReviewStage.set(null); this.load(); },
			error: event => { this.saving.set(false); this.error.set(event.error?.message || 'تعذر حفظ قرار المراجعة'); }
		});
	}
	openAmendments() {
		if (this.project() && this.actionBlockedReason(this.project())) return;
		this.amendKind = 'SCOPE'; this.amendTitle = ''; this.amendDescription = ''; this.amendBudget = null; this.amendDays = null;
		this.amendError.set(''); this.amendSuccess.set(false); this.amendCreated.set(null); this.amendFundingDone.set(false); this.amendOpen.set(true);
		this.loadAmendments();
	}
	closeAmendments() { if (!this.amendSaving()) this.amendOpen.set(false); }
	loadAmendments() {
		this.amendmentsLoading.set(true); this.amendmentsError.set('');
		this.http.get<any>(`${environment.url_api}/client/projects/amendments`).subscribe({
			next: res => {
				const all = Array.isArray(res?.data) ? res.data : [];
				this.amendments.set(sortAmendments(all.filter((a: any) => (a.projectId === this.projectId || a.contractId === this.projectId) && a.requestedByRole === 'CLIENT')));
				this.amendmentsLoading.set(false);
			},
			error: () => { this.amendmentsLoading.set(false); this.amendmentsError.set('تعذر تحميل طلباتك السابقة'); }
		});
	}
	/** Why the request cannot be sent yet (null = ready). */
	amendBlocker(): string | null {
		if (this.hasPendingAmendment()) return 'لديك طلب تعديل معلّق بانتظار رد مقدم الخدمة';
		if (!this.amendTitle.trim()) return 'أضف عنوانًا لطلب التعديل';
		if (this.amendKind === 'SCOPE' && !this.amendDescription.trim()) return 'اشرح التغيير المطلوب في النطاق';
		if (this.amendKind === 'BUDGET' && !(typeof this.amendBudget === 'number' && Number.isFinite(this.amendBudget) && this.amendBudget !== 0)) return 'أدخل فرق الميزانية (قيمة غير صفرية، سالبة للتخفيض)';
		if (this.amendKind === 'DURATION' && !(typeof this.amendDays === 'number' && Number.isInteger(this.amendDays) && this.amendDays !== 0)) return 'أدخل عدد الأيام (عدد صحيح غير صفري، سالب للتقصير)';
		if (this.amendKind === 'MIXED') {
			const dims = [!!this.amendDescription.trim(), typeof this.amendBudget === 'number' && this.amendBudget !== 0, typeof this.amendDays === 'number' && Number.isInteger(this.amendDays) && this.amendDays !== 0].filter(Boolean).length;
			if (dims < 2) return 'التعديل المتعدد يتطلب بُعدين على الأقل: نطاق أو ميزانية أو مدة';
		}
		return null;
	}
	amendReady() { return this.amendBlocker() === null && !this.amendSaving(); }
	submitAmendment() {
		const blocker = this.amendBlocker();
		if (blocker) { this.amendError.set(blocker); return; }
		if (this.amendSaving()) return;
		const payload: any = { type: this.amendKind, title: this.amendTitle.trim() };
		if (this.amendDescription.trim()) payload.description = this.amendDescription.trim();
		if ((this.amendKind === 'BUDGET' || this.amendKind === 'MIXED') && typeof this.amendBudget === 'number' && this.amendBudget !== 0) payload.budgetDelta = this.amendBudget;
		if ((this.amendKind === 'DURATION' || this.amendKind === 'MIXED') && typeof this.amendDays === 'number' && this.amendDays !== 0) payload.durationDeltaDays = this.amendDays;
		this.amendSaving.set(true); this.amendError.set('');
		this.http.post<any>(`${environment.url_api}/client/projects/${this.projectId}/amendments`, payload).subscribe({
			next: res => { this.amendSaving.set(false); this.amendCreated.set(res?.data ?? null); this.amendSuccess.set(true); this.amendments.update(list => upsertAmendment(list, res?.data)); this.loadAmendments(); },
			error: err => { this.amendSaving.set(false); this.amendError.set(err.error?.message || 'تعذر إرسال طلب التعديل'); }
		});
	}
	// The request just created: a budget INCREASE needs the client's payment authorization (OTP) before the provider can approve it. Nothing is charged here.
	amendCreated = signal<any | null>(null);
	amendFundingDone = signal(false);
	private actions = inject(AmendmentActionsService);
	createdNeedsFunding() { const c = this.amendCreated(); return !!c && amendmentNeedsPayment(c) && !c.fundingAuthorized && !this.amendFundingDone(); }
	createdAmount() { return amendmentBudgetPart(this.amendCreated()); }
	onFundingAuthorized() { this.amendFundingDone.set(true); this.loadAmendments(); }
	amendmentBadge(a: any): string { return a?.status === 'APPROVED' ? amendmentApprovedBadge(a) : ''; }
	needsFundingAuthorization(a: any) { return a?.requestedByRole === 'CLIENT' && a?.status === 'PENDING_OTHER_PARTY' && amendmentNeedsPayment(a) && !a?.fundingAuthorized; }
	cancelingId = signal<string | null>(null);
	cancelAmendment(a: any) {
		if (this.cancelingId() || a?.status !== 'PENDING_OTHER_PARTY') return;
		this.cancelingId.set(a.id); this.amendError.set('');
		this.actions.cancel('client', a.id).subscribe({
			next: () => { this.cancelingId.set(null); this.loadAmendments(); },
			error: err => { this.cancelingId.set(null); this.amendError.set(err.error?.message || 'تعذر إلغاء الطلب'); }
		});
	}
	readonly amendmentProposedLabel = AMENDMENT_PROPOSED_CHANGE_LABEL;
	amendmentEffectNote(a: any) { return amendmentEffectNote(a); }
	amendmentStatusLabel(s: string) { return CLIENT_AMENDMENT_STATUS_LABEL[s] || s; }
	amendmentTypeLabel(s: string) { return CLIENT_AMENDMENT_TYPE_LABEL[s] || s; }
	amendmentDeltas(a: any): string {
		const parts: string[] = [];
		if (a.budgetDelta !== null && a.budgetDelta !== undefined) parts.push(`${a.budgetDelta > 0 ? '+' : ''}${formatMoney(a.budgetDelta)} $`);
		if (a.durationDeltaDays !== null && a.durationDeltaDays !== undefined) parts.push(`${a.durationDeltaDays > 0 ? '+' : ''}${a.durationDeltaDays} يوم`);
		return parts.join(' · ');
	}

	openDisputeModal() {
		if (this.disputeSubmitted() || (this.project() && this.actionBlockedReason(this.project()))) return;
		this.disputeError.set('');
		this.showDisputeModal.set(true);
	}

	closeDisputeModal() {
		if (this.isSubmittingDispute()) return;
		this.showDisputeModal.set(false);
		this.disputeError.set('');
	}

	submitDispute(payload: CreateDisputePayload) {
		if (this.isSubmittingDispute()) return;
		this.isSubmittingDispute.set(true);
		this.disputeError.set('');
		this.disputeApi.createClientDispute(this.projectId, payload).subscribe({
			next: () => {
				this.isSubmittingDispute.set(false);
				this.showDisputeModal.set(false);
				this.disputeSubmitted.set(true);
				this.disputeSuccess.set('تم فتح النزاع بنجاح، وهو الآن بانتظار مراجعة الإدارة. تابع حالته من صفحة النزاعات.');
			},
			error: (err: any) => {
				this.isSubmittingDispute.set(false);
				this.disputeError.set(err?.error?.message || 'تعذر فتح النزاع، حاول مرة أخرى');
			},
		});
	}
	/** The dispute already open on this project, as the server reports it (read-only for the client; only the admin decides). */
	openDisputeLabel(data: any): string | null {
		return data?.disputeStatus === 'OPEN' ? 'نزاع مفتوح بانتظار مراجعة الإدارة' : data?.disputeStatus === 'UNDER_REVIEW' ? 'نزاع قيد مراجعة الإدارة' : null;
	}
	/** Project discussion lives in the project's own messages tab (never a new conversation in the general list). */
	openConversation(data: any, stage?: any) {
		if (!data) return;
		const ctx: MessageContext | undefined = stage ? {
			type: stage.deliveryStatus === 'SUBMITTED' ? 'DELIVERY' : 'STAGE',
			projectId: this.projectId,
			projectTitle: data.title || data.project || undefined,
			stageId: stage.id || undefined,
			stageTitle: stage.title || undefined,
			stageNumber: stage.stageNumber || undefined,
			amount: stage.amount || undefined
		} : undefined;
		this.activeTab.set('msgs');
		this.router.navigate(['/client-overview/projects', this.projectId], { queryParams: { tab: 'messages' }, state: ctx ? { messageContext: ctx } : undefined });
	}

	/** The rating call-to-action exists only when the SERVER says this user may rate (completed by delivery, not rated yet, not settled by a dispute). */
	canRate(_data?: any): boolean {
		return this.ratingStatus()?.canRate === true;
	}

	/** A project closed by a dispute settlement: no new rating, with the reason shown (an earlier saved rating stays visible). */
	settledNoRating(): boolean {
		const st = this.ratingStatus();
		return !!st?.adminSettled && !st.review;
	}

	viewMyRating() { this.router.navigate(['/client-overview/projects', this.projectId, 'rating']); }

	// Final provider/project rating display helpers (uses real backend value, no fakes).
	starsArray(): number[] { return [1, 2, 3, 4, 5]; }
	finalRatingValue(): number {
		const v = this.finalProviderRating();
		return v != null ? Number(v) : 0;
	}
	finalRatingDisplay(): string {
		const v = this.finalProviderRating();
		if (v == null) return '';
		// Show one decimal if non-integer, else .0
		const n = Number(v);
		return Number.isInteger(n) ? n.toFixed(1) : n.toFixed(1);
	}

	// P-SK-016: navigate to the final approval & closure page (design expects a full page before rating).
	openFinalApproval() {
		this.router.navigate(['/client-overview/projects', this.projectId, 'final-approval']);
	}

	// Batch 6 — real employee assignment picker (Project.assignedEmployeeId).
	openAssignPicker() {
		this.assignError.set('');
		this.showAssignPicker.set(true);
		if (this.employeeOptions().length === 0) this.loadEmployeeOptions();
	}

	closeAssignPicker() {
		if (this.isAssigning()) return;
		this.showAssignPicker.set(false);
	}

	loadEmployeeOptions() {
		this.isLoadingEmployeeOptions.set(true);
		this.clientTeamService.list().subscribe({
			next: res => {
				// Backend remains authoritative on write regardless — this is a
				// UX-only narrowing so the picker doesn't offer an ineligible
				// member in the first place.
				this.employeeOptions.set((res?.data || []).filter(m => m.status === 'ACTIVE'));
				this.isLoadingEmployeeOptions.set(false);
			},
			error: () => this.isLoadingEmployeeOptions.set(false)
		});
	}

	assignEmployee(employeeId: string | null) {
		if (this.isAssigning()) return;
		this.isAssigning.set(true);
		this.assignError.set('');
		this.http.put<any>(`${environment.url_api}/client/projects/${this.projectId}/assigned-employee`, { employeeId }).subscribe({
			next: res => {
				this.isAssigning.set(false);
				if (res?.success && res.data) {
					// Only update the real displayed state from the server's own
					// confirmed response — never optimistically before success.
					this.project.update(current => current ? { ...current, employee: res.data.employee } : current);
					this.showAssignPicker.set(false);
				} else {
					this.assignError.set('تعذر تحديث الموظف المسؤول');
				}
			},
			error: event => {
				this.isAssigning.set(false);
				this.assignError.set(event.error?.message || 'تعذر تحديث الموظف المسؤول');
			}
		});
	}

	unassignEmployee() {
		this.assignEmployee(null);
	}
}
