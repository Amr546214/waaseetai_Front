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
	showToast = signal<string>('');

	ngOnInit() {
		this.loadRequests();
	}

	loadRequests() {
		this.isLoading.set(true);
		this.profileApiService.getMyChangeRequests().subscribe({
			next: (res: any) => {
				const dataArray = res.data || res || [];
				
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
				this.isLoading.set(false);
			}
		});
	}

	setFilter(filter: string) {
		this.activeFilter.set(filter);
		this.loadRequests();
	}

	cancelRequest(id: string) {
		// BACKEND-BLOCKED (see BACKEND_BLOCKED_ISSUES.md): there is no
		// withdraw/cancel endpoint for CLIENT profile change requests.
		// ProfileApiService only exposes getMyChangeRequests() (GET
		// /profiles/my-change-requests), and that endpoint is itself backed by
		// a backend stub (profile.service.ts#getMyChangeRequests) that always
		// returns an empty array — the real query is commented out. The only
		// real "withdraw" endpoint that exists (POST
		// /marketer/profile/requests/:id/withdraw, used by the marketer-side
		// Requests page) operates on the affiliate/marketer profile model
		// (profileRequestsService.withdrawRequest looks up an
		// AffiliateProfile by userId) and has no equivalent for clients, so it
		// cannot be reused here. Until a client-facing endpoint exists, this
		// must NOT claim success or mutate local state to CANCELLED — that
		// would misrepresent a no-op as a real withdrawal.
		if (confirm(`هل أنت متأكد من سحب هذا الطلب؟`)) {
			this.displayToast('سحب الطلب غير متاح حالياً — قيد التفعيل قريباً');
		}
	}

	displayToast(msg: string) {
		this.showToast.set(msg);
		setTimeout(() => this.showToast.set(''), 3000);
	}
}
