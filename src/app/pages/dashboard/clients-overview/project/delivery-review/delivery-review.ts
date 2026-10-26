import { CommonModule } from '@angular/common';
import { StageRatingEntry } from '../../../../../sheards/rating-entry/rating-entry.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { scrollFocus } from '../../../../../shared/forms/form-error-focus';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { MessageContext } from '../../../../../core/services/chat.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { formatAmount } from '../../../../../core/utils/currency';
import { formatWsText } from '../../../../../shared/ws-date/ws-date.pipe';
import { formatMoney } from '../../../../../core/utils/money.util';
import { deliveryHeading } from '../../../../../core/utils/stage-title.util';
import { deliveryFileOpenUrl, deliveryFileDownloadUrl, LEGACY_FILE_NOTE } from '../../../../../core/utils/delivery-file.util';

/** What the page shows for a stage, decided ONLY from the server's lifecycle eligibility (never from the stage count or COMPLETED alone). */
export type ReviewViewState = 'reviewable' | 'frozen' | 'decided' | 'settled' | 'undelivered' | 'closed' | 'blocked';

@Component({
	selector: 'app-delivery-review', standalone: true,
	imports: [CommonModule, FormsModule, RouterLink, StageRatingEntry],
	templateUrl: './delivery-review.html', styleUrl: './delivery-review.css',
})
export class DeliveryReview implements OnInit {
	private http = inject(HttpClient);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	readonly isCompany = () => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY;

	project = signal<any>(null);
	stage = signal<any>(null);
	isLoading = signal(true);
	error = signal('');
	saving = signal(false);
	reviewNote = '';
	// Request-revision form: records the note on the delivery and sends the stage back to the provider (POST .../review, decision 'revision').
	revisionOpen = signal(false);
	revisionNote = '';
	revisionError = signal('');
	/** True when revisionError explains the note field itself (too short / rejected by the server as invalid); network, 409, 5xx stay a plain message. */
	revisionFieldInvalid = signal(false);
	revisionSent = signal(false);
	/** Same floor the server enforces, so the client sees the reason before sending. */
	readonly REVISION_MIN_CHARS = 10;
	// P-SK-015 success modal state (real data known before approval; the review
	// endpoint itself doesn't echo them back — see approveDelivery() below)
	successData = signal<{ amount: number; providerName: string; stageTitle: string; txnId: string; invoiceId: string } | null>(null);
	private projectId = '';
	/** The key the rating status endpoints accept (project or contract id): the same one this page loads the workspace with. */
	rateKey() { return this.projectId; }
	private stageId = '';

	ngOnInit() {
		this.projectId = this.route.snapshot.paramMap.get('id') || '';
		this.stageId = this.route.snapshot.paramMap.get('stageId') || '';
		if (this.route.snapshot.queryParamMap?.get('action') === 'revision') this.revisionOpen.set(true);
		this.load();
	}

	load() {
		if (!this.projectId) { this.error.set('معرّف المشروع مفقود'); this.isLoading.set(false); return; }
		this.isLoading.set(true); this.error.set('');
		this.http.get<any>(`${environment.url_api}/client/my-requests/${this.projectId}/workspace`).subscribe({
			next: response => {
				if (!response?.success || !response.data) { this.error.set('تعذر تحميل مساحة العمل'); this.isLoading.set(false); return; }
				this.project.set(response.data);
				const found = response.data.stages?.find((s: any) => s.id === this.stageId) || null;
				this.stage.set(found);
				if (!found) this.error.set('تعذر العثور على المرحلة المطلوبة');
				this.isLoading.set(false);
			},
			error: event => { this.error.set(event.error?.message || 'تعذر تحميل مساحة العمل'); this.isLoading.set(false); }
		});
	}

	latestThread(stage: any) { return stage?.threads?.[stage.threads.length - 1] || null; }

	// Batch 5 — real, on-demand, advisory-only Gemini review of this delivery
	// (POST .../stages/:stageId/ai-review). It never approves/rejects the
	// delivery and never affects escrow — approveDelivery() below remains the
	// only action that does that. Idle until the client explicitly asks for it.
	aiReviewState = signal<'idle' | 'loading' | 'result' | 'error'>('idle');
	aiReview = signal<{
		summary: string;
		alignedPoints: string[];
		potentialGaps: string[];
		questionsForReviewer: string[];
		reviewedInputs: { deliveryText: boolean; stageRequirements: boolean; attachmentContent: boolean };
	} | null>(null);
	aiReviewError = signal('');

	requestAiReview() {
		const stage = this.stage();
		if (!stage || this.aiReviewState() === 'loading') return;
		this.aiReviewState.set('loading');
		this.aiReviewError.set('');
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/stages/${stage.id}/ai-review`, {}).subscribe({
			next: response => {
				if (response?.success && response.data) {
					this.aiReview.set(response.data);
					this.aiReviewState.set('result');
				} else {
					this.aiReviewError.set('تعذر إنشاء المراجعة الاستشارية بالذكاء الاصطناعي حالياً.');
					this.aiReviewState.set('error');
				}
			},
			error: event => {
				this.aiReview.set(null);
				this.aiReviewError.set(event.error?.message || 'تعذر إنشاء المراجعة الاستشارية بالذكاء الاصطناعي حالياً.');
				this.aiReviewState.set('error');
			}
		});
	}

	// No backend field exists for a review deadline (StageDelivery/ProjectStage have
	// no such column). Do not invent a day count — show "غير محدد" until a real
	// business rule/field is defined.
	reviewDeadlineText(): string { return 'غير محدد'; }

	submittedTimeAgo(stage: any): string {
		const last = this.latestThread(stage);
		if (last?.date) {
			const diff = Date.now() - new Date(last.date).getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));
			if (days <= 0) return 'اليوم';
			if (days === 1) return 'قبل يوم';
			if (days === 2) return 'قبل يومين';
			return `قبل ${days} أيام`;
		}
		return 'غير محدد';
	}

	stageFileCount(stage: any): number { return this.latestThread(stage)?.files?.length || 0; }

	formatFileSize(bytes?: number): string {
		if (!bytes || bytes <= 0) return '';
		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	formatNumber(value: number) { return formatMoney(value || 0); }
	/** an amount with the currency code of the stage / project it belongs to (absent = legacy USD) */
	money(value: number | null | undefined, currency?: string | null): string { return formatAmount(value || 0, currency ?? this.project()?.currency); }

	readonly legacyFileNote = LEGACY_FILE_NOTE;
	/** «تسليم المرحلة 1: ...» with the stage's own number prefix never duplicated. */
	heading(stage: any): string { return deliveryHeading(stage?.stageNumber, stage?.title); }
	openUrl(file: any): string | null { return deliveryFileOpenUrl(file); }
	downloadUrl(file: any): string | null { return deliveryFileDownloadUrl(file); }

	/** The stage's server-computed lifecycle (state + per-action eligibility with Arabic reasons); null only for an older backend. */
	lifecycleOf(stage: any): any { return stage?.lifecycle ?? null; }
	elig(stage: any, action: string): { allowed: boolean; reason: string | null; code: string | null } | null { return stage?.lifecycle?.eligibility?.[action] ?? null; }
	/**
	 * Ownership + state + eligibility are read BEFORE any button is shown. The workspace response carries the lifecycle with the stage, so the first
	 * paint already knows the answer (the skeleton stays until then): a form is never rendered and then removed.
	 */
	viewState(stage: any): ReviewViewState {
		const lc = this.lifecycleOf(stage);
		if (!lc) return stage?.status === 'submitted' ? 'reviewable' : stage?.status === 'completed' ? 'decided' : 'blocked'; // older backend: the stored status only
		if (this.project()?.closedBySettlement && !lc.decided) return 'settled';
		if (lc.decided) return 'decided';
		const approve = this.elig(stage, 'approve');
		if (approve?.allowed) return 'reviewable';
		if (approve?.code === 'ACTIVE_DISPUTE_FREEZE') return 'frozen';
		if (approve?.code === 'CLOSED_BY_SETTLEMENT') return 'settled';
		if (approve?.code === 'STAGE_NOT_DELIVERED' || approve?.code === 'STAGE_NOT_STARTED') return 'undelivered';
		if (approve?.code === 'CONTRACT_COMPLETED' || approve?.code === 'CONTRACT_CANCELLED' || approve?.code === 'CONTRACT_ENDED') return 'closed';
		return 'blocked';
	}
	/** The delivery is awaiting THIS client's decision (the buttons exist). In a dispute freeze the approval is shown disabled with the reason; a revision request stays possible. */
	canDecide(stage: any): boolean { const v = this.viewState(stage); return v === 'reviewable' || v === 'frozen'; }
	canApprove(stage: any): boolean { return this.viewState(stage) === 'reviewable'; }
	canRequestRevision(stage: any): boolean {
		const lc = this.lifecycleOf(stage);
		return lc ? this.elig(stage, 'requestRevision')?.allowed === true : stage?.status === 'submitted';
	}
	/** Why no decision is offered (null when one is). Specific: settled / contract ended / not delivered / not started / not the owner. */
	blockReason(stage: any): string | null {
		if (this.canDecide(stage)) return null;
		return this.elig(stage, 'approve')?.reason ?? null;
	}
	/** The recorded decision of an already-approved stage (the date comes from the stage itself). */
	decisionDate(stage: any): string | Date | null { return stage?.lifecycle?.decision?.decidedAt ?? stage?.completedDate ?? null; }
	formatDate(value: string | Date | null): string {
		if (!value) return '';
		return formatWsText(value, { day: 'numeric', month: 'long', year: 'numeric' });
	}
	/** The delivery exists and can be read (also after approval or a settlement, as history). */
	hasDelivery(stage: any): boolean { return !!this.latestThread(stage); }

	// Dispute freeze: while a dispute on this project is open the backend refuses approvals (423). The button stays visible but disabled with
	// the reason; chat, evidence and the provider's deliveries are untouched, and a revision request is still possible.
	freezeReason(): string | null { const f = this.project()?.disputeFreeze; return f?.frozen ? (f.reason || 'اعتماد المراحل وصرف الأموال موقوفان بسبب نزاع مفتوح على هذا المشروع') : null; }

	statusBadgeText(stage: any): string {
		switch (this.viewState(stage)) {
			case 'reviewable': return stage?.revisionResubmitted ? 'أُعيد التسليم، بانتظار اعتمادك' : 'بانتظار مراجعة العميل';
			case 'frozen': return 'بانتظار مراجعة العميل، والاعتماد موقوف بسبب نزاع';
			case 'decided': return 'تم اعتماد هذا التسليم';
			case 'settled': return this.project()?.statusLabel || 'أُغلق بتسوية نزاع';
			case 'undelivered': return stage?.status === 'pending' ? 'لم تبدأ بعد' : 'لم يُسلَّم بعد';
			case 'closed': return this.project()?.statusLabel || 'العقد منتهٍ';
			default: return stage?.status === 'revision' ? 'طلبت تعديلًا، بانتظار تسليم جديد من مقدم الخدمة' : stage?.status === 'in_progress' ? 'قيد التنفيذ' : 'لا يوجد تسليم بانتظار المراجعة';
		}
	}

	statusBadgeClass(stage: any): string {
		switch (this.viewState(stage)) {
			case 'reviewable': case 'frozen': return 'dr-pill-wait';
			case 'decided': return 'dr-pill-done';
			default: return stage?.status === 'revision' ? 'dr-pill-revision' : 'dr-pill-neutral';
		}
	}

	approveDelivery() {
		const stage = this.stage();
		if (!stage || this.saving()) return;
		if (this.freezeReason()) { this.error.set(this.freezeReason()!); return; }
		if (!this.canApprove(stage)) { this.error.set(this.blockReason(stage) || 'لا يمكن اعتماد هذه المرحلة حاليًا'); return; }
		this.saving.set(true); this.error.set('');
		// Capture real, already-known values now — the workspace is reloaded right
		// after a successful approval and this stage's status/threads will change.
		// The backend's review endpoint only ever returns { decision, stageId,
		// pointsAwarded } (see reviewDelivery() in project-progress.service.ts), so
		// there is no releasedAmount/providerName/transactionId to read from the
		// response — using the already-loaded real workspace data instead of
		// fabricating those fields.
		const data = this.project();
		const amount = stage.amount ?? 0;
		const providerName = data?.clientName || 'مقدم الخدمة';
		const stageTitle = stage.title || '';
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/stages/${stage.id}/review`, { decision: 'approve', note: this.reviewNote.trim() }).subscribe({
			next: () => {
				this.saving.set(false);
				this.successData.set({ amount, providerName, stageTitle, txnId: '', invoiceId: '' });
				// Refresh the real stage/project state in the background so the page
				// behind the success modal (and after refresh) reflects the true,
				// now-approved status rather than stale pre-approval data.
				this.load();
			},
			error: event => { this.saving.set(false); this.error.set(event.error?.message || 'تعذر حفظ قرار المراجعة'); this.refreshIfStateChanged(event); }
		});
	}

	/** The server refused because the state moved (409 / 423): re-read it quietly so the page stops offering what is no longer possible (the message stays). */
	private refreshIfStateChanged(event: any) {
		if (event?.status !== 409 && event?.status !== 423) return;
		this.http.get<any>(`${environment.url_api}/client/my-requests/${this.projectId}/workspace`).subscribe({
			next: response => { if (response?.success && response.data) { this.project.set(response.data); this.stage.set(response.data.stages?.find((s: any) => s.id === this.stageId) || null); } },
			error: () => { /* keep the page as it is; the refusal message is already shown */ }
		});
	}

	toggleRevision() {
		if (this.saving()) return;
		this.revisionError.set(''); this.revisionFieldInvalid.set(false);
		this.revisionOpen.update(v => !v);
	}

	requestRevision() {
		const stage = this.stage();
		if (!stage || this.saving() || !this.canRequestRevision(stage) || !this.canDecide(stage)) return;
		const note = this.revisionNote.trim();
		if (note.length < this.REVISION_MIN_CHARS) {
			this.revisionError.set(`اكتب ملاحظات التعديل بوضوح (${this.REVISION_MIN_CHARS} أحرف على الأقل)`);
			this.revisionFieldInvalid.set(true);
			setTimeout(() => { const el = document.getElementById('dr-rev-note'); if (el) scrollFocus(el); }, 0);
			return;
		}
		this.saving.set(true); this.revisionError.set(''); this.revisionFieldInvalid.set(false);
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/stages/${stage.id}/review`, { decision: 'revision', note }).subscribe({
			next: () => {
				this.saving.set(false);
				this.revisionSent.set(true);
				this.revisionOpen.set(false);
				this.revisionNote = '';
				// Reload the real state: the stage is now "revision requested" and waits for the provider.
				this.load();
			},
			error: event => {
				this.saving.set(false);
				this.revisionError.set(event.error?.message || 'تعذر إرسال طلب التعديل');
				// Only a 400/422 is about the note itself; everything else is a generic failure and must not paint the field red.
				this.revisionFieldInvalid.set(mapHttpError(event).kind === 'backend-validation');
				this.refreshIfStateChanged(event);
			}
		});
	}

	closeSuccessModal() {
		this.successData.set(null);
		this.backToProject();
	}

	// Navigate to the per-stage rating page (P-SK-017 stage mode).
	goToStageRating() {
		this.successData.set(null);
		this.router.navigate(['/client-overview/projects', this.projectId, 'stages', this.stageId, 'rating']);
	}

	openInvoice() {
		// Navigate to the invoice detail page if we have a real invoice id (from approve API or workspace data).
		// Otherwise fall back to the invoices list filtered by the current project so the client still lands on a relevant page.
		// TODO: backend /client/my-requests/:id/stages/:stageId/review should return invoiceId on approval so we can deep-link to the exact invoice.
		const sd = this.successData();
		const data = this.project();
		const invoiceId = sd?.invoiceId || data?.invoiceId || '';
		if (invoiceId) {
			this.router.navigate(['/client-overview/finance/invoices', invoiceId]);
			return;
		}
		// No invoice id available — go to invoices list with project context as query params (list page can filter/highlight).
		this.router.navigate(['/client-overview/finance/invoices'],
			{ queryParams: { projectId: this.projectId || undefined, stageId: this.stageId || undefined } });
	}

	openConversation(data: any) {
		if (!data) return;
		const stage = this.stage();
		const ctx: MessageContext = {
			type: 'DELIVERY',
			projectId: this.projectId,
			projectTitle: data.title || data.project || undefined,
			stageId: stage?.id || undefined,
			stageTitle: stage?.title || undefined,
			stageNumber: stage?.stageNumber || undefined,
			amount: stage?.amount || undefined
		};
		this.router.navigate(['/client-overview/projects', this.projectId], { queryParams: { tab: 'messages' }, state: { messageContext: ctx } });
	}

	backToProject() { this.router.navigate(['/client-overview/projects', this.projectId]); }
}
