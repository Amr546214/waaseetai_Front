import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { ProjectMiniChat } from '../../../../../sheards/project-mini-chat/project-mini-chat';
import { DisputeModal } from '../../../../../sheards/dispute-modal/dispute-modal';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { CreateDisputePayload } from '../../../../../core/models/dispute.model';
import { MessageContext } from '../../../../../core/services/chat.service';
import { RatingApiService } from '../../../../../core/services/rating-api.service';

type WorkspaceTab = 'overview' | 'miles' | 'msgs' | 'files';
type SupportAction = 'edit' | 'dispute' | 'cancel' | null;

@Component({
	selector: 'app-project-details', standalone: true,
	imports: [CommonModule, FormsModule, RouterModule, ProjectMiniChat, DisputeModal],
	templateUrl: './project-details.html', styleUrl: './project-details.css',
})
export class ProjectDetails implements OnInit {
	private http = inject(HttpClient);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private disputeApi = inject(DisputeApiService);
	private ratingApi = inject(RatingApiService);
	project = signal<any>(null);
	isLoading = signal(true);
	error = signal('');
	saving = signal(false);
	activeTab = signal<WorkspaceTab>('overview');
	// P-SK-015 inline delivery review state (replaces old modal)
	inlineReviewStage = signal<any>(null);
	reviewDecision = signal<'approve' | 'revision'>('approve');
	supportAction = signal<SupportAction>(null);
	reviewNote = '';
	supportNote = '';
	editType = 'إضافة مرحلة أو عنصر جديد';
	private projectId = '';
	showDisputeModal = signal(false);
	isSubmittingDispute = signal(false);
	disputeSuccess = signal('');
	disputeError = signal('');
	disputeSubmitted = signal(false);
	// Rating status — fetched from completed-projects endpoint (server-side Review table).
	hasRated = signal(false);
	finalProviderRating = signal<number | null>(null);
	finalProviderRatingComment = signal<string | null>(null);
	finalProviderRatedAt = signal<string | null>(null);

	ngOnInit() { this.route.params.subscribe(params => { this.projectId = params['id']; this.load(); }); }
	load() {
		this.isLoading.set(true); this.error.set('');
		this.http.get<any>(`${environment.url_api}/client/my-requests/${this.projectId}/workspace`).subscribe({
			next: response => {
				if (!response?.success || !response.data) this.error.set('تعذر تحميل مساحة العمل');
				else {
					this.project.set(response.data);
					// Fetch rating status from completed-projects endpoint (which checks Review table server-side).
					this.ratingApi.getClientRatingStatus(this.projectId).subscribe({
						next: status => {
							this.hasRated.set(status.hasRated);
							this.finalProviderRating.set(status.rating);
							this.finalProviderRatingComment.set(status.comment);
							this.finalProviderRatedAt.set(status.ratedAt);
						},
						error: () => { /* non-fatal: default to false */ },
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
	// Review deadline days fallback
	reviewDeadlineDays(stage: any): string {
		if (stage?.reviewDeadlineDays) return stage.reviewDeadlineDays + ' أيام';
		return '6 أيام';
	}
	// Submitted time fallback
	submittedTimeAgo(stage: any): string {
		if (stage?.submittedTimeAgo) return stage.submittedTimeAgo;
		const last = this.latestThread(stage);
		if (last?.date) {
			const diff = Date.now() - new Date(last.date).getTime();
			const days = Math.floor(diff / (1000 * 60 * 60 * 24));
			if (days <= 0) return 'اليوم';
			if (days === 1) return 'قبل يوم';
			return `قبل ${days} أيام`;
		}
		return 'قبل يوم';
	}
	formatNumber(value: number) { return Number(value || 0).toLocaleString('en-US'); }
	formatDate(value: string | Date | null) {
		if (!value) return '—';
		return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short' }).format(new Date(value));
	}
	statusHint(stage: any) {
		if (stage.status === 'completed') return `اكتملت واعتمدت${stage.completedDate ? ` · ${this.formatDate(stage.completedDate)}` : ''}`;
		if (stage.status === 'submitted') return `قيد المراجعة · ${stage.roundsCount} ${stage.roundsCount === 1 ? 'تسليم' : 'تسليمات'}، بانتظار قرارك`;
		if (stage.status === 'revision') return 'بانتظار إعادة التسليم بعد ملاحظاتك';
		if (stage.status === 'in_progress') return 'قيد العمل لدى مقدم الخدمة';
		return 'تبدأ بعد اعتماد المرحلة السابقة';
	}
	deadlineRating(data: any) {
		if (data.daysLeft <= 0 && data.progress < 100) return 'يحتاج متابعة';
		return this.currentAiInsights(data)?.healthRating || 'جيد';
	}
	// P-SK-015: navigate to full delivery review page (no modal). 'approve' opens the review page; 'revision' opens conversation.
	openReview(stage: any, decision: 'approve' | 'revision') {
		this.error.set('');
		if (decision === 'revision') {
			// "عندي ملاحظات، فتح نقاش" → navigate to conversation with stage context
			this.openConversation(this.project(), stage);
			return;
		}
		// 'approve' → navigate to full P-SK-015 delivery review page
		this.router.navigate(['/client-overview/projects', this.projectId, 'delivery-review', stage.id]);
	}
	closeReview() { if (!this.saving()) this.inlineReviewStage.set(null); }
	submitReview() {
		const stage = this.inlineReviewStage(); if (!stage) return;
		this.saving.set(true);
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/stages/${stage.id}/review`, { decision: this.reviewDecision(), note: this.reviewNote.trim() }).subscribe({
			next: () => { this.saving.set(false); this.inlineReviewStage.set(null); this.load(); },
			error: event => { this.saving.set(false); this.error.set(event.error?.message || 'تعذر حفظ قرار المراجعة'); }
		});
	}
	openSupport(action: Exclude<SupportAction, null>) { this.supportNote = ''; this.supportAction.set(action); }

	openDisputeModal() {
		if (this.disputeSubmitted()) return;
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
				this.disputeSuccess.set('تم فتح النزاع بنجاح، سيقوم فريق وسيط بمراجعة الحالة');
			},
			error: (err: any) => {
				this.isSubmittingDispute.set(false);
				this.disputeError.set(err?.error?.message || 'تعذر فتح النزاع، حاول مرة أخرى');
			},
		});
	}
	closeSupport() { this.supportAction.set(null); }
	continueInConversation(data: any) { if (!data) return; this.supportAction.set(null); this.openConversation(data); }
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
		} : data?.conversationId ? {
			type: 'PROJECT',
			projectId: this.projectId,
			projectTitle: data.title || data.project || undefined
		} : undefined;
		this.router.navigate(['/client-overview/messages'],
			{ queryParams: data.conversationId ? { conversationId: data.conversationId } : undefined, state: ctx ? { messageContext: ctx } : undefined });
	}

	canRate(data: any): boolean {
		// If the completed-projects endpoint confirms a review exists, never show the CTA.
		if (this.hasRated()) return false;
		// Legacy fallback: some workspace payloads may include hasRated/canRate directly.
		if (data?.hasRated === true) return false;
		if (data?.canRate === true) return true;
		const allCompleted = data?.stages?.length > 0 && data.stages.every((s: any) => s.status === 'completed');
		return data?.status === 'COMPLETED' || (data?.progress === 100 && allCompleted);
	}

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
}
