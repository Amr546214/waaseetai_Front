import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

interface PendingDeliveryItem {
	projectId: string;
	projectTitle: string;
	stageId: string;
	stageNumber: number;
	stageTitle: string;
	amount: number;
	submittedAt: string;
	providerName: string;
	filesCount: number;
	contractRef: string;
}

@Component({
	selector: 'app-review-list',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './review-list.html',
	styleUrl: './review-list.css',
})
export class ReviewList implements OnInit {
	private http = inject(HttpClient);

	isLoading = signal(true);
	hasError = signal(false);
	items = signal<PendingDeliveryItem[]>([]);

	ngOnInit() {
		this.fetchPendingDeliveries();
	}

	fetchPendingDeliveries() {
		this.isLoading.set(true);
		this.hasError.set(false);

		this.http.get<any>(`${environment.url_api}/client/my-requests/pending-deliveries`).subscribe({
			next: response => {
				if (!response?.success || !Array.isArray(response.data)) {
					this.hasError.set(true);
					this.isLoading.set(false);
					return;
				}
				this.items.set(response.data as PendingDeliveryItem[]);
				this.isLoading.set(false);
			},
			error: () => {
				this.hasError.set(true);
				this.isLoading.set(false);
			}
		});
	}

	formatNumber(value: number) {
		return Number(value || 0).toLocaleString('en-US');
	}

	// Real elapsed time from the delivery's actual submittedAt — no fallback
	// placeholder, since the backend always provides this field for a real
	// pending delivery (see project-progress.service.ts#getPendingReviewDeliveries).
	submittedTimeAgo(item: PendingDeliveryItem): string {
		const submitted = new Date(item.submittedAt).getTime();
		if (!Number.isFinite(submitted)) return '';
		const days = Math.floor((Date.now() - submitted) / (1000 * 60 * 60 * 24));
		if (days <= 0) return 'اليوم';
		if (days === 1) return 'قبل يوم';
		if (days === 2) return 'قبل يومين';
		return `قبل ${days} أيام`;
	}
}
