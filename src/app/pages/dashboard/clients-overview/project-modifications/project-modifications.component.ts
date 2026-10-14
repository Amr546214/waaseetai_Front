import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { MessageContext } from '../../../../core/services/chat.service';
import { environment } from '../../../../../environments/environment';
import { formatMoney } from '../../../../core/utils/money.util';
import { AMENDMENT_PROPOSED_CHANGE_LABEL, AMENDMENT_REJECT_CONFIRM_TEXT, amendmentApproveText, amendmentApprovedBadge, amendmentEffect, amendmentEffectLines, amendmentEffectNote, amendmentNeedsPayment, amendmentBudgetPart } from '../../../../core/constants/amendment-effect';
import { AmendmentActionsService } from '../../../../core/services/amendment-actions.service';
import { AmendmentPaymentOtpComponent } from '../../../../sheards/amendment-payment-otp/amendment-payment-otp.component';

// Matches the real GET /client/projects/amendments response shape exactly
// (see waseetai-backend ProjectAmendmentService#listAmendments) — no field
// here is fabricated on the frontend.
interface Amendment {
	id: string;
	projectId: string;
	projectTitle: string;
	contractId: string;
	contractRef: string;
	providerId: string;
	providerName: string;
	requestedByRole: 'CLIENT' | 'PROVIDER';
	type: 'SCOPE' | 'BUDGET' | 'DURATION' | 'MIXED';
	title: string;
	description: string | null;
	budgetDelta: number | null;
	durationDeltaDays: number | null;
	status: 'PENDING_OTHER_PARTY' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
	createdAt: string;
	updatedAt: string;
	respondedAt: string | null;
	conversationId: string | null;
	effect?: 'APPLIED' | 'RECORD_ONLY' | 'PENDING' | 'NONE';
	effectNote?: string;
	appliedAt?: string | null;
	needsClientPayment?: boolean;
	fundingAuthorized?: boolean;
	fundingAuthorizedUntil?: string | null;
	contractPrice?: number | null;
	contractDurationDays?: number | null;
}

interface FilterTab {
	id: string;
	label: string;
	count: number;
}

interface TimelineStep {
	label: string;
	state: 'done' | 'active' | 'pending';
}

@Component({
	selector: 'app-project-modifications',
	standalone: true,
	imports: [CommonModule, RouterModule, AmendmentPaymentOtpComponent],
	templateUrl: './project-modifications.component.html',
	styleUrl: './project-modifications.component.css'
})
export class ProjectModificationsComponent implements OnInit {
	private authStore = inject(AuthStore);
	private http = inject(HttpClient);
	private router = inject(Router);
	private actions = inject(AmendmentActionsService);

	isCompanyMode = computed(() => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY);

	isLoading = signal(true);
	hasError = signal(false);
	amendments = signal<Amendment[]>([]);
	activeFilter = signal<string>('all');

	// Per-amendment "responding" guard — disables its approve/reject buttons
	// while a request is in flight and prevents a second concurrent call.
	respondingId = signal<string | null>(null);
	respondError = signal<string>('');
	// Set to the amendment id whose "متابعة النقاش" click had no real
	// conversationId, so we can show an honest inline notice on that one
	// card only — never silently navigate to an unrelated chat.
	conversationErrorId = signal<string | null>(null);

	ngOnInit(): void {
		this.fetchAmendments();
	}

	fetchAmendments(): void {
		this.isLoading.set(true);
		this.hasError.set(false);
		this.http.get<any>(`${environment.url_api}/client/projects/amendments`).subscribe({
			next: response => {
				if (!response?.success || !Array.isArray(response.data)) {
					this.hasError.set(true);
					this.isLoading.set(false);
					return;
				}
				this.amendments.set(response.data as Amendment[]);
				this.isLoading.set(false);
			},
			error: () => {
				this.hasError.set(true);
				this.isLoading.set(false);
			}
		});
	}

	tabs = computed<FilterTab[]>(() => {
		const list = this.amendments();
		return [
			{ id: 'all', label: 'الكل', count: list.length },
			{ id: 'open', label: 'نشطة', count: list.filter(a => a.status === 'PENDING_OTHER_PARTY').length },
			{ id: 'closed', label: 'مُعتمدة', count: list.filter(a => a.status === 'APPROVED').length },
			{ id: 'rejected', label: 'مرفوضة', count: list.filter(a => a.status === 'REJECTED').length }
		];
	});

	// Only categories that map to a real backend status/role combination —
	// there is no "جار تقييم الذكاء" tile, because no AI evaluation exists.
	stats = computed(() => {
		const list = this.amendments();
		const pendingProvider = list.filter(a => a.requestedByRole === 'CLIENT' && a.status === 'PENDING_OTHER_PARTY').length;
		const pendingYou = list.filter(a => a.requestedByRole === 'PROVIDER' && a.status === 'PENDING_OTHER_PARTY').length;
		const approved = list.filter(a => a.status === 'APPROVED').length;
		return [
			{ icon: 'edit', iconClass: 'inv-ic-amber', value: String(pendingProvider), label: 'بانتظار رد المقدّم' },
			{ icon: 'person', iconClass: 'inv-ic-blue', value: String(pendingYou), label: 'بانتظار موافقتك' },
			{ icon: 'check', iconClass: 'inv-ic-green', value: String(approved), label: 'مُعتمدة' }
		];
	});

	filteredAmendments = computed<Amendment[]>(() => {
		const filter = this.activeFilter();
		const list = this.amendments();
		if (filter === 'open') return list.filter(a => a.status === 'PENDING_OTHER_PARTY');
		if (filter === 'closed') return list.filter(a => a.status === 'APPROVED');
		if (filter === 'rejected') return list.filter(a => a.status === 'REJECTED');
		return list;
	});

	setFilter(filter: string): void {
		this.activeFilter.set(filter);
	}

	// Real workflow steps derived from requestedByRole + status only — no
	// "تقييم الذكاء" step, because no real AI process exists for this domain.
	timelineSteps(am: Amendment): TimelineStep[] {
		const raisedLabel = am.requestedByRole === 'CLIENT' ? 'رفع الطلب' : 'رفع المقدّم';
		const waitingLabel = am.requestedByRole === 'CLIENT' ? 'بانتظار رد المقدّم' : 'بانتظار موافقتك';
		const isPending = am.status === 'PENDING_OTHER_PARTY';
		const outcomeLabel = am.status === 'APPROVED' ? (amendmentEffect(am) === 'APPLIED' ? 'طُبّق على العقد' : 'موافقة مُسجَّلة') : am.status === 'REJECTED' ? 'مرفوض' : am.status === 'CANCELLED' ? 'ملغى' : 'القرار النهائي';
		return [
			{ label: raisedLabel, state: 'done' },
			{ label: waitingLabel, state: isPending ? 'active' : 'done' },
			{ label: outcomeLabel, state: isPending ? 'pending' : 'done' }
		];
	}

	iconType(am: Amendment): 'disp' | 'canc' | 'done' {
		if (am.status === 'APPROVED') return 'done';
		if (am.status === 'REJECTED' || am.status === 'CANCELLED') return 'canc';
		return am.requestedByRole === 'PROVIDER' ? 'canc' : 'disp';
	}

	statusLabel(am: Amendment): string {
		if (am.status === 'APPROVED') return amendmentApprovedBadge(am);
		if (am.status === 'REJECTED') return 'مرفوض';
		if (am.status === 'CANCELLED') return 'مُلغى';
		return am.requestedByRole === 'CLIENT' ? 'بانتظار رد المقدّم' : 'بانتظار موافقتك';
	}

	typeLabel(am: Amendment): string {
		if (am.type === 'SCOPE') return 'تعديل نطاق';
		if (am.type === 'BUDGET') return 'تعديل ميزانية';
		if (am.type === 'DURATION') return 'تعديل مدة';
		return 'تعديل متعدد';
	}

	formatBudgetDelta(value: number | null): string {
		if (value === null || value === 0) return 'بلا تغيير';
		const sign = value > 0 ? '+' : '-';
		return `${sign}${formatMoney(Math.abs(value))} $`;
	}

	formatDurationDelta(value: number | null): string {
		if (value === null || value === 0) return 'بلا تغيير';
		const sign = value > 0 ? '+' : '-';
		return `${sign}${Math.abs(value)} ${Math.abs(value) === 1 ? 'يوم' : 'أيام'}`;
	}

	// Only a provider-raised, still-pending amendment can be approved/rejected
	// by this client — a client never approves their own request.
	canRespond(am: Amendment): boolean {
		return am.requestedByRole === 'PROVIDER' && am.status === 'PENDING_OTHER_PARTY';
	}

	readonly proposedChangeLabel = AMENDMENT_PROPOSED_CHANGE_LABEL;
	effectNote(am: Amendment): string { return amendmentEffectNote(am); }
	effectLines(am: Amendment) { return amendmentEffectLines(am); }
	needsPayment(am: Amendment): boolean { return amendmentNeedsPayment(am); }
	confirmText(am: Amendment, decision: 'approve' | 'reject'): string { return decision === 'approve' ? amendmentApproveText(am, 'client') : AMENDMENT_REJECT_CONFIRM_TEXT; }
	approveAmount(am: Amendment): number { return amendmentBudgetPart(am); }

	// Approving APPLIES the amendment (contract / escrow / stages / wallet) in one step, so the confirmation shows the financial effect first.
	// A budget increase additionally needs the client's payment code (the OTP step); nothing is shown as done before the API answered.
	pendingDecision = signal<{ id: string; decision: 'approve' | 'reject' } | null>(null);
	otpFor = signal<{ id: string; mode: 'respond' | 'authorize' } | null>(null);
	askDecision(am: Amendment, decision: 'approve' | 'reject'): void {
		if (this.respondingId()) return;
		this.respondError.set('');
		this.otpFor.set(null);
		this.pendingDecision.set({ id: am.id, decision });
	}
	cancelDecision(): void { this.pendingDecision.set(null); this.otpFor.set(null); }
	confirmDecision(am: Amendment): void {
		const p = this.pendingDecision();
		if (!p || p.id !== am.id) return;
		if (p.decision === 'approve' && this.needsPayment(am)) { this.otpFor.set({ id: am.id, mode: 'respond' }); return; }
		this.pendingDecision.set(null);
		this.respond(am, p.decision);
	}
	onOtpDone(): void { this.pendingDecision.set(null); this.otpFor.set(null); this.respondError.set(''); this.fetchAmendments(); }

	// A client-raised budget increase: the client authorizes the payment (OTP) first; the provider's approval then applies it and debits the wallet.
	canAuthorizeFunding(am: Amendment): boolean {
		return am.requestedByRole === 'CLIENT' && am.status === 'PENDING_OTHER_PARTY' && this.needsPayment(am) && !am.fundingAuthorized;
	}
	startAuthorize(am: Amendment): void { this.respondError.set(''); this.pendingDecision.set(null); this.otpFor.set({ id: am.id, mode: 'authorize' }); }
	canCancel(am: Amendment): boolean { return am.requestedByRole === 'CLIENT' && am.status === 'PENDING_OTHER_PARTY'; }
	cancelRequest(am: Amendment): void {
		if (this.respondingId()) return;
		this.respondingId.set(am.id);
		this.respondError.set('');
		this.actions.cancel('client', am.id).subscribe({
			next: () => { this.respondingId.set(null); this.fetchAmendments(); },
			error: event => { this.respondingId.set(null); this.respondError.set(event.error?.message || 'تعذر إلغاء الطلب'); }
		});
	}

	respond(am: Amendment, decision: 'approve' | 'reject'): void {
		if (this.respondingId()) return;
		this.respondingId.set(am.id);
		this.respondError.set('');
		this.actions.clientRespond(am.id, decision).subscribe({
			next: () => {
				this.respondingId.set(null);
				// Reload real data rather than faking the new status locally.
				this.fetchAmendments();
			},
			error: event => {
				this.respondingId.set(null);
				this.respondError.set(event.error?.message || 'تعذر حفظ القرار');
			}
		});
	}

	ctaLabel(am: Amendment): string {
		return am.status === 'PENDING_OTHER_PARTY' ? 'متابعة النقاش' : 'عرض النقاش';
	}

	openDiscussion(am: Amendment): void {
		this.conversationErrorId.set(null);
		if (!am.conversationId) {
			this.conversationErrorId.set(am.id);
			return;
		}
		const ctx: MessageContext = { type: 'PROJECT', projectId: am.projectId, projectTitle: am.projectTitle };
		this.router.navigate(['/client-overview/messages'], { queryParams: { conversationId: am.conversationId }, state: { messageContext: ctx } });
	}
}
