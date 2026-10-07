import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MarketerKycRequest, MarketerKycService } from '../../../../../core/services/marketer-kyc.service';
import { KycDocumentLink } from '../../../../../sheards/kyc-document-link/kyc-document-link';
import { mapHttpError } from '../../../../../core/forms/http-error';

export const REJECT_REASON_MIN = 3;
export const REJECT_REASON_MAX = 500;

/**
 * Admin queue of marketer identity documents (GET /api/admin/brokers/kyc-requests): view the document through the access-link endpoint
 * (key marketer_kyc_document + the owner's userId, audited by the backend), approve, or reject with a REQUIRED reason (the marketer is
 * notified with it). The reference of the stored file is never shown: the backend never returns it.
 */
@Component({
	selector: 'app-sa-broker-kyc-requests',
	standalone: true,
	imports: [CommonModule, FormsModule, KycDocumentLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: './sa-broker-kyc-requests.html',
	styleUrl: './sa-broker-kyc-requests.css',
})
export class SaBrokerKycRequests implements OnInit {
	private readonly api = inject(MarketerKycService);

	readonly items = signal<MarketerKycRequest[]>([]);
	readonly total = signal(0);
	readonly loading = signal(false);
	readonly loadError = signal('');
	readonly actionError = signal('');
	readonly notice = signal('');
	readonly busyId = signal<string | null>(null);

	readonly rejecting = signal<MarketerKycRequest | null>(null);
	readonly reason = signal('');
	readonly reasonTouched = signal(false);
	readonly reasonMin = REJECT_REASON_MIN;
	readonly reasonMax = REJECT_REASON_MAX;

	ngOnInit(): void { this.load(); }

	load(): void {
		this.loading.set(true);
		this.loadError.set('');
		this.api.listRequests(1, 50).subscribe({
			next: page => { this.items.set(page.items); this.total.set(page.pagination.total); this.loading.set(false); },
			error: err => { this.loading.set(false); this.loadError.set(mapHttpError(err, { fallback: 'تعذر تحميل طلبات التوثيق' }).message); },
		});
	}

	approve(item: MarketerKycRequest): void {
		if (this.busyId()) return;
		this.actionError.set(''); this.notice.set('');
		this.busyId.set(item.affiliateId);
		this.api.approve(item.affiliateId).subscribe({
			next: () => { this.busyId.set(null); this.notice.set(`تم اعتماد هوية ${item.name || 'الوسيط'}`); this.remove(item); },
			error: err => { this.busyId.set(null); this.actionError.set(mapHttpError(err, { fallback: 'تعذر اعتماد الطلب' }).message); this.load(); },
		});
	}

	openReject(item: MarketerKycRequest): void {
		this.actionError.set(''); this.notice.set('');
		this.reason.set(''); this.reasonTouched.set(false);
		this.rejecting.set(item);
	}
	cancelReject(): void { this.rejecting.set(null); }

	reasonError(): string {
		const len = this.reason().trim().length;
		if (len < REJECT_REASON_MIN) return 'سبب الرفض مطلوب (3 أحرف على الأقل)';
		if (len > REJECT_REASON_MAX) return 'سبب الرفض طويل جدًا (500 حرف كحد أقصى)';
		return '';
	}

	confirmReject(): void {
		const item = this.rejecting();
		this.reasonTouched.set(true);
		if (!item || this.reasonError() || this.busyId()) return;
		this.busyId.set(item.affiliateId);
		this.api.reject(item.affiliateId, this.reason().trim()).subscribe({
			next: () => { this.busyId.set(null); this.rejecting.set(null); this.notice.set(`تم رفض مستند ${item.name || 'الوسيط'} وإشعاره بالسبب`); this.remove(item); },
			error: err => { this.busyId.set(null); this.rejecting.set(null); this.actionError.set(mapHttpError(err, { fallback: 'تعذر رفض الطلب' }).message); this.load(); },
		});
	}

	private remove(item: MarketerKycRequest): void {
		this.items.update(list => list.filter(i => i.affiliateId !== item.affiliateId));
		this.total.update(n => Math.max(0, n - 1));
	}
}
