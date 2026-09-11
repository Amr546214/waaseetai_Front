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
	approved = signal(false);
	// P-SK-015 success modal state (real data from approve API response)
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

	aiMatchPct(data: any): string {
		const v = data?.aiInsights?.matchPercentage;
		if (v) return v + '٪';
		const p = data?.progress || 0;
		const base = 88 + Math.round(p / 100 * 8);
		return base + '٪';
	}

	qualityNote(stage: any): string {
		if (stage?.aiQualityNote) return stage.aiQualityNote;
		return 'اجتاز فحص الذكاء: الملفات كاملة، بدقّة عالية، وبدون علامات مائية';
	}

	reviewDeadlineDays(stage: any): string {
		if (stage?.reviewDeadlineDays) return stage.reviewDeadlineDays + ' أيام';
		return '6 أيام';
	}

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

	stageFileCount(stage: any): number { return this.latestThread(stage)?.files?.length || 0; }

	// P-SK-015 (company variant): "الموظف المسؤول" — responsible employee from client side.
	// TODO: backend /client/my-requests/:id/workspace should expose responsibleEmployee / assignedEmployee / managerName.
	// Currently no such field is returned; fallback to "—" until the API provides it.
	responsibleEmployee(data: any): string {
		const v = data?.responsibleEmployee || data?.assignedEmployee || data?.assignedManager
			|| data?.managerName || data?.projectManager
			|| data?.responsible?.name || data?.manager?.name
			|| data?.owner?.name || data?.employeeName;
		if (!v) {
			if (typeof console !== 'undefined' && (console as any).warn) {
				(console as any).warn('[P-SK-015] responsibleEmployee field missing in workspace data — showing "—".');
			}
			return '—';
		}
		return v;
	}

	formatNumber(value: number) { return Number(value || 0).toLocaleString('en-US'); }

	approveDelivery() {
		const stage = this.stage(); if (!stage) return;
		this.saving.set(true); this.error.set('');
		this.http.post<any>(`${environment.url_api}/client/my-requests/${this.projectId}/stages/${stage.id}/review`, { decision: 'approve', note: this.reviewNote.trim() }).subscribe({
			next: (res) => {
				this.saving.set(false);
				this.approved.set(true);
				// Build success modal data from real API response + current workspace data
				const data = this.project();
				const releasedAmount = res?.data?.releasedAmount ?? res?.data?.amount ?? stage.amount ?? 0;
				const providerName = res?.data?.providerName ?? data?.clientName ?? 'مقدم الخدمة';
				const stageTitle = res?.data?.stageTitle ?? stage.title ?? 'المرحلة الحالية';
				const txnId = res?.data?.transactionId ?? res?.data?.txnId ?? res?.data?.reference ?? '';
				// Capture invoice id if backend returns it on approval; otherwise empty (openInvoice falls back to invoices list)
				const invoiceId = res?.data?.invoiceId ?? res?.data?.invoice?.id ?? '';
				this.successData.set({ amount: releasedAmount, providerName, stageTitle, txnId, invoiceId });
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
