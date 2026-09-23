import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';
import { MessageContext } from '../../../../../core/services/chat.service';

@Component({
	selector: 'app-delivery-review', standalone: true,
	imports: [CommonModule, FormsModule, RouterLink],
	templateUrl: './delivery-review.html', styleUrl: './delivery-review.css',
})
export class DeliveryReview implements OnInit {
	private http = inject(HttpClient);
	private route = inject(ActivatedRoute);
	private router = inject(Router);

	project = signal<any>(null);
	stage = signal<any>(null);
	isLoading = signal(true);
	error = signal('');
	saving = signal(false);
	reviewNote = '';
	// P-SK-015 success modal state (real data known before approval; the review
	// endpoint itself doesn't echo them back — see approveDelivery() below)
	successData = signal<{ amount: number; providerName: string; stageTitle: string; txnId: string; invoiceId: string } | null>(null);
	private projectId = '';
	private stageId = '';

	ngOnInit() {
		this.projectId = this.route.snapshot.paramMap.get('id') || '';
		this.stageId = this.route.snapshot.paramMap.get('stageId') || '';
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

	// There is no AI quality-review backend for stage deliveries (confirmed: no such
	// field/column/service exists anywhere in the backend). Showing a fabricated
	// percentage or a "passed" message here would misrepresent an automated check
	// that never ran, so this section always renders an honest "unavailable" state.
	// If a real AI review pipeline is added later, wire it here instead of faking it.
	readonly aiReviewAvailable = false;

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

	formatNumber(value: number) { return Number(value || 0).toLocaleString('en-US'); }

	// The delivery is only awaiting THIS client's decision while the stage is
	// still SUBMITTED (stageLabels maps ProjectStageStatus.SUBMITTED -> 'submitted'
	// on the backend). Deriving this from the real, reloaded stage status — rather
	// than a local "just approved" flag — keeps a direct/refreshed URL honest about
	// whether approving is actually still possible.
	canDecide(stage: any): boolean { return stage?.status === 'submitted'; }

	statusBadgeText(stage: any): string {
		switch (stage?.status) {
			case 'submitted': return 'بانتظار اعتمادك';
			case 'completed': return 'تم اعتماد هذا التسليم';
			case 'revision': return 'بانتظار تسليم جديد من مقدم الخدمة';
			case 'in_progress': return 'قيد التنفيذ';
			default: return 'لا يوجد تسليم بانتظار المراجعة';
		}
	}

	statusBadgeClass(stage: any): string {
		switch (stage?.status) {
			case 'submitted': return 'dr-pill-wait';
			case 'completed': return 'dr-pill-done';
			case 'revision': return 'dr-pill-revision';
			default: return 'dr-pill-neutral';
		}
	}

	approveDelivery() {
		const stage = this.stage();
		if (!stage || this.saving()) return;
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
			error: event => { this.saving.set(false); this.error.set(event.error?.message || 'تعذر حفظ قرار المراجعة'); }
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
		this.router.navigate(['/client-overview/messages'],
			{ queryParams: data.conversationId ? { conversationId: data.conversationId } : undefined, state: { messageContext: ctx } });
	}

	backToProject() { this.router.navigate(['/client-overview/projects', this.projectId]); }
}
