import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { ProjectMiniChat } from '../../../../../sheards/project-mini-chat/project-mini-chat';
import { ClientRatingModal } from '../rating-modal/rating-modal';
import { RatingApiService } from '../../../../../core/services/rating-api.service';
import { RatingScore } from '../../../../../core/models/rating.model';

type WorkspaceTab = 'overview' | 'miles' | 'msgs' | 'files';
type SupportAction = 'edit' | 'dispute' | 'cancel' | null;

@Component({
	selector: 'app-project-details', standalone: true,
	imports: [CommonModule, FormsModule, RouterModule, ProjectMiniChat, ClientRatingModal],
	templateUrl: './project-details.html', styleUrl: './project-details.css',
})
export class ProjectDetails implements OnInit {
	private http = inject(HttpClient);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private ratingApi = inject(RatingApiService);
	project = signal<any>(null);
	isLoading = signal(true);
	error = signal('');
	saving = signal(false);
	activeTab = signal<WorkspaceTab>('overview');
	reviewStage = signal<any>(null);
	reviewDecision = signal<'approve' | 'revision'>('approve');
	supportAction = signal<SupportAction>(null);
	reviewNote = '';
	supportNote = '';
	private projectId = '';
	showRatingModal = signal(false);
	isSubmittingRating = signal(false);
	ratingError = signal('');
	ratingSuccess = signal('');
	ratingSubmitted = signal(false);

	ngOnInit() { this.route.params.subscribe(params => { this.projectId = params['id']; this.load(); }); }
	load() {
		this.isLoading.set(true); this.error.set('');
		this.http.get<any>(`${environment.url_api}/client/my-requests/${this.projectId}/workspace`).subscribe({
			next: response => {
				if (!response?.success || !response.data) this.error.set('تعذر تحميل مساحة العمل');
				else this.project.set(response.data);
				this.isLoading.set(false);
			},
			error: event => { this.error.set(event.error?.message || 'تعذر تحميل مساحة العمل'); this.isLoading.set(false); }
		});
	}
	setTab(tab: WorkspaceTab) { this.activeTab.set(tab); }
	approvedCount(data: any) { return data.stages.filter((stage: any) => stage.status === 'completed').length; }
	totalFiles(data: any) { return data.files.reduce((sum: number, group: any) => sum + group.files.length, 0); }
	latestThread(stage: any) { return stage.threads?.[stage.threads.length - 1] || null; }
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
		return data.aiInsights?.healthRating || 'جيد';
	}
	openReview(stage: any, decision: 'approve' | 'revision') { this.error.set(''); this.reviewStage.set(stage); this.reviewDecision.set(decision); this.reviewNote = ''; }
	closeReview() { if (!this.saving()) this.reviewStage.set(null); }
	submitReview() {
		const stage = this.reviewStage(); if (!stage) return;
		if (this.reviewDecision() === 'revision' && this.reviewNote.trim().length < 10) { this.error.set('اكتب ملاحظات تعديل واضحة لا تقل عن 10 أحرف'); return; }
		this.saving.set(true);
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/stages/${stage.id}/review`, { decision: this.reviewDecision(), note: this.reviewNote.trim() }).subscribe({
			next: () => { this.saving.set(false); this.reviewStage.set(null); this.load(); },
			error: event => { this.saving.set(false); this.error.set(event.error?.message || 'تعذر حفظ قرار المراجعة'); }
		});
	}
	openSupport(action: Exclude<SupportAction, null>) { this.supportNote = ''; this.supportAction.set(action); }
	closeSupport() { this.supportAction.set(null); }
	continueInConversation(data: any) { this.supportAction.set(null); this.openConversation(data); }
	openConversation(data: any) { this.router.navigate(['/client-overview/messages'], { queryParams: data.conversationId ? { conversationId: data.conversationId } : undefined }); }

	canRate(data: any): boolean {
		if (this.ratingSubmitted() || this.ratingSuccess()) return false;
		if (data?.canRate === true) return true;
		if (data?.hasRated === true) return false;
		const allCompleted = data?.stages?.length > 0 && data.stages.every((s: any) => s.status === 'completed');
		return data?.status === 'COMPLETED' || (data?.progress === 100 && allCompleted);
	}

	openRatingModal() {
		this.ratingError.set('');
		this.showRatingModal.set(true);
	}

	closeRatingModal() {
		if (this.isSubmittingRating()) return;
		this.showRatingModal.set(false);
		this.ratingError.set('');
	}

	submitRating(payload: { rating: RatingScore; comment?: string }) {
		if (this.isSubmittingRating()) return;
		this.isSubmittingRating.set(true);
		this.ratingError.set('');
		this.ratingApi.rateProvider(this.projectId, payload).subscribe({
			next: () => {
				this.isSubmittingRating.set(false);
				this.showRatingModal.set(false);
				this.ratingSubmitted.set(true);
				this.ratingSuccess.set('تم إرسال تقييمك بنجاح');
			},
			error: (err: any) => {
				this.isSubmittingRating.set(false);
				this.ratingError.set(err?.error?.message || 'تعذر إرسال التقييم، حاول مرة أخرى');
			},
		});
	}
}
