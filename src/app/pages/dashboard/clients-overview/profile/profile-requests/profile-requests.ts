import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { ProfileApiService } from '../../../../../core/services/profile-api.service';

@Component({
	selector: 'app-profile-requests',
	standalone: true,
	imports: [CommonModule, DatePipe, DecimalPipe],
	templateUrl: './profile-requests.html',
})
export class ProfileRequests implements OnInit {
	private profileApiService = inject(ProfileApiService);

	activeFilter = signal<string>('ALL');
	requestsData = signal<any | null>(null);
	isLoading = signal<boolean>(true);
	/** The read failed (401/429/5xx/network): never shown as zero counters / "no requests". */
	loadError = signal<boolean>(false);
	showToast = signal<string>('');

	ngOnInit() {
		this.loadRequests();
	}

	loadRequests() {
		this.isLoading.set(true);
		this.loadError.set(false);
		this.profileApiService.getMyChangeRequests().subscribe({
			next: (res: any) => {
				const dataArray = res?.data ?? res;
				if (!Array.isArray(dataArray)) {
					this.requestsData.set(null);
					this.loadError.set(true);
					this.isLoading.set(false);
					return;
				}
				
				const filter = this.activeFilter();
				const filteredReqs = filter === 'ALL' ? dataArray : dataArray.filter((r: any) => r.status === filter);
				
				const kpi = {
					totalRequests: dataArray.length,
					inAiReviewCount: dataArray.filter((r: any) => r.status === 'IN_AI_REVIEW').length,
					pendingHumanCount: dataArray.filter((r: any) => r.status === 'PENDING_HUMAN_REVIEW').length,
					approvedCount: dataArray.filter((r: any) => r.status === 'APPROVED').length,
					rejectedCount: dataArray.filter((r: any) => r.status === 'REJECTED').length
				};

				this.requestsData.set({
					kpi,
					requests: filteredReqs
				});
				
				this.isLoading.set(false);
			},
			error: (err: any) => {
				console.error('Failed to load requests', err);
				this.requestsData.set(null);
				this.loadError.set(true);
				this.isLoading.set(false);
			}
		});
	}

	setFilter(filter: string) {
		this.activeFilter.set(filter);
		this.loadRequests();
	}

	cancelRequest(id: string) {
		if (!confirm('هل أنت متأكد من سحب هذا الطلب؟')) return;
		this.profileApiService.cancelMyChangeRequest(id).subscribe({
			next: (res: any) => {
				if (res?.success) {
					this.displayToast('تم سحب الطلب');
					this.loadRequests();
				} else {
					this.displayToast(res?.message || 'تعذر سحب الطلب');
				}
			},
			error: (err: any) => this.displayToast(err?.error?.message || 'تعذر سحب الطلب، حاول مرة أخرى')
		});
	}

	displayToast(msg: string) {
		this.showToast.set(msg);
		setTimeout(() => this.showToast.set(''), 3000);
	}
}
