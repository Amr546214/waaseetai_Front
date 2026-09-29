import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { MessageContext } from '../../../../../core/services/chat.service';

@Component({
	selector: 'app-final-approval',
	standalone: true,
	imports: [CommonModule],
	templateUrl: './final-approval.html',
	styleUrl: './final-approval.css',
})
export class FinalApproval implements OnInit {
	private http = inject(HttpClient);
	private route = inject(ActivatedRoute);
	private router = inject(Router);

	project = signal<any>(null);
	isLoading = signal(true);
	error = signal('');
	confirming = signal(false);
	showConfirmModal = signal(false);
	private projectId = '';

	ngOnInit() {
		this.projectId = this.route.snapshot.paramMap.get('id') || '';
		if (!this.projectId) {
			this.error.set('معرّف المشروع مفقود');
			this.isLoading.set(false);
			return;
		}
		this.load();
	}

	load() {
		this.isLoading.set(true);
		this.error.set('');
		this.http.get<any>(`${environment.url_api}/client/my-requests/${this.projectId}/workspace`).subscribe({
			next: response => {
				if (!response?.success || !response.data) {
					this.error.set('تعذر تحميل مساحة العمل');
					this.isLoading.set(false);
					return;
				}
				this.project.set(response.data);
				this.isLoading.set(false);
			},
			error: event => {
				this.error.set(event?.error?.message || 'تعذر تحميل مساحة العمل');
				this.isLoading.set(false);
			},
		});
	}

	// === Data helpers (reuse real workspace fields, no fakes) ===
	latestThread(stage: any) { return stage?.threads?.[stage.threads.length - 1] || null; }

	providerName(): string {
		const data = this.project();
		return data?.clientName || data?.providerName || data?.provider?.name || 'مقدم الخدمة';
	}
	projectTitle(): string {
		const data = this.project();
		return data?.title || data?.project || 'المشروع';
	}
	contractRef(): string {
		const data = this.project();
		return data?.contractRef || data?.contractCode || '—';
	}
	orderCode(): string {
		const data = this.project();
		return data?.code || data?.orderCode || data?.id || '';
	}
	clientInitial(): string {
		const data = this.project();
		return data?.clientInitial || (this.providerName().charAt(0) || 'م');
	}
	totalAmount(): number {
		const data = this.project();
		return Number(data?.price ?? data?.amount ?? data?.totalAmount ?? 0);
	}
	releasedAmount(): number {
		const data = this.project();
		if (!data?.stages) return 0;
		return data.stages
			.filter((s: any) => s.status === 'completed' || s.status === 'APPROVED')
			.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
	}
	finalPayment(): number {
		const data = this.project();
		if (!data?.stages?.length) return 0;
		const last = data.stages[data.stages.length - 1];
		return Number(last?.amount || 0);
	}
	stagesCount(): number { return this.project()?.stages?.length || 0; }
	completedStagesCount(): number {
		const stages = this.project()?.stages || [];
		return stages.filter((s: any) => s.status === 'completed' || s.status === 'APPROVED').length;
	}
	revisionRounds(): number {
		const stages = this.project()?.stages || [];
		return stages.reduce((sum: number, s: any) => {
			const rounds = Number(s.roundsCount || 0);
			return sum + (rounds > 1 ? rounds - 1 : 0);
		}, 0);
	}
	formatNumber(value: number) { return Number(value || 0).toLocaleString('en-US'); }
	formatDate(value: string | Date | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short' }).format(new Date(value));
	}
	stageFileCount(stage: any): number { return this.latestThread(stage)?.files?.length || 0; }
	stageFiles(stage: any): any[] { return this.latestThread(stage)?.files || []; }
	// Honest fallback only — there is no real backend match-percentage source
	// for this page, so a fixed "95٪" here would fabricate a computed value
	// (same class of bug already fixed for the sibling project-details.ts).
	aiMatchPct(stage: any): string {
		const v = stage?.aiInsights?.matchPercentage || stage?.aiMatchPct;
		return v ? v + '٪' : 'غير متاح';
	}
	// There is no aiQualityNote (or any automated pass/fail check) field
	// anywhere in the backend, so a fixed "passed AI check" sentence here
	// would claim an inspection that never happened. A real, on-demand
	// advisory review is available from the "مراجعة التسليم بالذكاء
	// الاصطناعي" action on the delivery review page.
	qualityNote(stage: any): string {
		if (stage?.aiQualityNote) return stage.aiQualityNote;
		return 'لا توجد ملاحظة جودة آلية لهذا التسليم بعد';
	}
	statusHint(stage: any) {
		if (stage.status === 'completed' || stage.status === 'APPROVED') return `اعتُمدت${stage.completedDate ? ` · ${this.formatDate(stage.completedDate)}` : ''}`;
		if (stage.status === 'submitted' || stage.status === 'SUBMITTED') return `سُلّم${stage.submittedDate ? ` · ${this.formatDate(stage.submittedDate)}` : ''} · بانتظار اعتمادك النهائي`;
		if (stage.status === 'revision' || stage.status === 'REVISION_REQUESTED') return 'بانتظار إعادة التسليم';
		if (stage.status === 'in_progress' || stage.status === 'IN_PROGRESS') return 'قيد العمل';
		return 'بانتظار المرحلة السابقة';
	}
	isStageCompleted(stage: any): boolean {
		return stage.status === 'completed' || stage.status === 'APPROVED';
	}
	isFinalStage(index: number): boolean {
		const stages = this.project()?.stages || [];
		return index === stages.length - 1;
	}
	// Stage rating helpers (from backend workspace response)
	hasClientRating(stage: any): boolean {
		return Boolean(stage?.hasClientRating);
	}
	clientRating(stage: any): number {
		return Number(stage?.clientRating || 0);
	}
	clientRatingComment(stage: any): string {
		return stage?.clientRatingComment || '';
	}
	revisionCount(stage: any): number {
		const rounds = Number(stage?.roundsCount || 0);
		return rounds > 1 ? rounds - 1 : 0;
	}
	// Auto-acceptance warning helpers (P-SK-016 fs-warn) — derived from backend fields when present
	autoAcceptDeadline(): string {
		const data = this.project();
		return data?.autoAcceptDeadline || data?.finalReviewDeadline || '';
	}
	autoAcceptDaysLeft(): number {
		const deadline = this.autoAcceptDeadline();
		if (!deadline) return 0;
		const ms = new Date(deadline).getTime() - Date.now();
		return Math.max(0, Math.ceil(ms / 86400000));
	}
	autoAcceptDaysPassed(): number {
		const total = this.autoAcceptTotalWindow();
		if (!total) return 0;
		return Math.max(0, total - this.autoAcceptDaysLeft());
	}
	autoAcceptTotalWindow(): number {
		const data = this.project();
		return Number(data?.autoAcceptWindowDays || 5);
	}
	autoAcceptProgressPct(): number {
		const total = this.autoAcceptTotalWindow();
		if (!total) return 0;
		return Math.min(100, Math.round((this.autoAcceptDaysPassed() / total) * 100));
	}
	showAutoAcceptWarn(): boolean {
		return Boolean(this.autoAcceptDeadline()) && this.autoAcceptDaysLeft() > 0;
	}

	// === Per-stage rating actions ===
	// Navigate to the dedicated stage rating page (P-SK-017 stage mode).
	// Inline panel is intentionally avoided in favor of a routed page, per design flow.
	openStageRating(stage: any) {
		this.router.navigate(['/client-overview/projects', this.projectId, 'stages', stage.id, 'rating']);
	}
	starsArray(): number[] { return [1, 2, 3, 4, 5]; }

	// === Final approval actions ===
	openConfirm() { this.showConfirmModal.set(true); }
	closeConfirm() {
		if (this.confirming()) return;
		this.showConfirmModal.set(false);
	}

	confirmAndRate() {
		if (this.confirming()) return;
		this.confirming.set(true);
		// Honest note (see BACKEND_BLOCKED_ISSUES.md → "Final project approval /
		// escrow release is not wired to a real endpoint"): there is no backend
		// endpoint anywhere in this app that finalizes a project or releases the
		// held final-stage escrow amount. Every service was checked
		// (ProjectApiService, ClientFinanceService, RatingApiService, and every
		// HTTP call under clients-overview) — the only endpoint that affects
		// escrow is POST .../stages/:stageId/review, and it only accepts a
		// stage that is still 'submitted'. This page is only reachable once
		// every stage — including the final one — is already 'completed' (see
		// canRate() in project-details.ts), so that endpoint cannot validly be
		// called again from here. Rather than fabricate a fake "funds released"
		// success (or block the real, working rating flow below by disabling
		// this button), this action only records the client's confirmation
		// locally and proceeds to rating; the confirmation/summary copy in
		// final-approval.html has been corrected to stop claiming this click
		// releases funds.
		this.router.navigate(['/client-overview/projects', this.projectId, 'rating']);
	}

	openConversation() {
		const data = this.project();
		if (!data) return;
		const ctx: MessageContext = {
			type: 'DELIVERY',
			projectId: this.projectId,
			projectTitle: data.title || data.project || undefined,
		};
		this.router.navigate(['/client-overview/messages'],
			{ queryParams: data.conversationId ? { conversationId: data.conversationId } : undefined, state: { messageContext: ctx } });
	}

	back() { this.router.navigate(['/client-overview/projects', this.projectId]); }
	retry() { this.error.set(''); this.load(); }
}
