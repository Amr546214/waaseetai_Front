import { CommonModule } from '@angular/common';
import { RatingEntry, StageRatingEntry } from '../../../../../sheards/rating-entry/rating-entry.component';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { MessageContext } from '../../../../../core/services/chat.service';
import { formatMoney } from '../../../../../core/utils/money.util';
import { stageHeading } from '../../../../../core/utils/stage-title.util';
import { deliveryFileOpenUrl, deliveryFileDownloadUrl } from '../../../../../core/utils/delivery-file.util';

@Component({
	selector: 'app-final-approval',
	standalone: true,
	imports: [CommonModule, RatingEntry, StageRatingEntry],
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
	private projectId = '';
	rateKey() { return this.projectId; }

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
	/** Money released through STAGE APPROVALS only (the server's financial summary); never the settlement's own release. */
	releasedAmount(): number {
		const data = this.project();
		const fin = this.financial();
		if (fin) return Number(fin.releasedByStageApprovals || 0);
		if (!data?.stages) return 0;
		return data.stages
			.filter((s: any) => s.status === 'completed' || s.status === 'APPROVED')
			.reduce((sum: number, s: any) => sum + Number(s.amount || 0), 0);
	}
	// === Server lifecycle (single source of truth) ===
	financial(): any { return this.project()?.financial ?? null; }
	settlement(): any { return this.financial()?.settlement ?? null; }
	/** Closed by an admin financial dispute decision: never "completed", never a fake 100%. */
	settled(): boolean { return this.project()?.closedBySettlement === true; }
	heading(stage: any, index: number): string { return stageHeading(stage?.stageNumber || index + 1, stage?.title); }
	openUrl(file: any): string | null { return deliveryFileOpenUrl(file); }
	downloadUrl(file: any): string | null { return deliveryFileDownloadUrl(file); }
	closedStage(stage: any): boolean { return stage?.displayStatus === 'CLOSED_BY_SETTLEMENT'; }
	badgeText(): string {
		const data = this.project();
		if (this.settled()) return data?.statusLabel || 'أُغلق بتسوية نزاع';
		if (this.allStagesCompleted()) return 'اكتملت كل المراحل';
		if (data?.contractStatus === 'CANCELLED') return 'العقد ملغى';
		return 'المشروع قيد التنفيذ';
	}
	stageMoneyText(stage: any): string {
		const amount = `${this.formatNumber(stage?.amount)} $`;
		if (this.isStageCompleted(stage)) return `أُفرِج ${amount}`;
		if (this.closedStage(stage)) return `قيمة المرحلة ${amount} (تعاقدية سابقة، وليست مبلغًا ينتظر الإفراج)`;
		return stage?.amountHeld === false ? `قيمة المرحلة ${amount}` : `محتجز ${amount}`;
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
	formatNumber(value: number) { return formatMoney(value || 0); }
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
		return 'لا توجد ملاحظة جودة لهذا التسليم بعد';
	}
	statusHint(stage: any) {
		if (this.closedStage(stage)) return stage.displayStatusLabel || 'أُغلقت بالتسوية';
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
	// === Per-stage rating actions ===
	// Navigate to the dedicated stage rating page (P-SK-017 stage mode).
	// Inline panel is intentionally avoided in favor of a routed page, per design flow.
	openStageRating(stage: any) {
		this.router.navigate(['/client-overview/projects', this.projectId, 'stages', stage.id, 'rating']);
	}
	starsArray(): number[] { return [1, 2, 3, 4, 5]; }

	// === Summary page: no finalize action ===
	// The real completion (contract COMPLETED, escrow released) happens in POST .../stages/:stageId/review when the LAST stage is approved.
	// This page only summarises; the single action is moving on to the rating.
	allStagesCompleted(): boolean {
		if (this.settled()) return false; // a settled project is never «all stages complete»
		const total = this.stagesCount();
		return total > 0 && this.completedStagesCount() === total;
	}
	remainingAmount(): number {
		return Math.max(0, Math.round((this.totalAmount() - this.releasedAmount()) * 100) / 100);
	}
	continueToRating() {
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
