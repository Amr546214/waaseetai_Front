import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProviderApiService } from '../../../../../core/services/provider-api.service';

// Batch 7: this page used to be 100% hardcoded fiction — 7 fabricated
// deliveries attributed to 3 made-up team members (فهد العتيبي, ريم
// الدوسري, سارة الزهراني) with fake "AI match" percentages (94/97/91/99/
// 96/97/94), no HttpClient anywhere in the file. There is no team-member/
// company-employee model anywhere in the Prisma schema — a provider account
// (individual or company) is a single user — so a real per-employee
// breakdown cannot be built without a schema change (flagged separately,
// out of scope for this batch). This now shows the provider's own real
// StageDelivery rows via GET /provider/company/deliveries: real project,
// phase, status, date, contract, and file data, with no fabricated AI score
// and no invented team-member attribution.
export interface CompanyDelivery {
	id: string;
	projectTitle: string;
	phaseLabel: string;
	status: 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED';
	statusLabel: string;
	submittedAt: string;
	contractRef: string;
	amountLabel: string;
	files: string[];
	note: string;
	period: 'week' | 'month' | 'older';
}

function derivePeriod(submittedAt: string): 'week' | 'month' | 'older' {
	const submitted = new Date(submittedAt).getTime();
	const now = Date.now();
	const days = (now - submitted) / (1000 * 60 * 60 * 24);
	if (days <= 7) return 'week';
	if (days <= 30) return 'month';
	return 'older';
}

@Component({
	selector: 'app-team-deliveries',
	standalone: true,
	imports: [CommonModule, RouterLink, FormsModule],
	templateUrl: './team-deliveries.html',
	styleUrl: './team-deliveries.css'
})
export class TeamDeliveries implements OnInit {
	private providerApi = inject(ProviderApiService);

	activePeriod = signal<'all' | 'week' | 'month'>('all');
	activeStatus = signal<'all' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED'>('all');
	searchQuery = signal<string>('');
	selectedDelivery = signal<CompanyDelivery | null>(null);
	toastMessage = signal<string>('');
	isLoading = signal<boolean>(true);
	private toastTimer: ReturnType<typeof setTimeout> | null = null;

	deliveries = signal<CompanyDelivery[]>([]);

	ngOnInit(): void {
		this.providerApi.getCompanyDeliveries().subscribe({
			next: (res: any) => {
				if (res?.success && Array.isArray(res.data)) {
					this.deliveries.set(res.data.map((d: any) => ({ ...d, period: derivePeriod(d.submittedAt) })));
				}
				this.isLoading.set(false);
			},
			error: () => {
				this.isLoading.set(false);
			}
		});
	}

	kpis = computed(() => {
		const list = this.deliveries();
		return {
			thisMonth: list.filter(d => d.period === 'week' || d.period === 'month').length,
			pending: list.filter(d => d.status === 'SUBMITTED').length,
			approved: list.filter(d => d.status === 'APPROVED').length
		};
	});

	filteredDeliveries = computed(() => {
		let list = this.deliveries();
		if (this.activePeriod() !== 'all') list = list.filter(d => d.period === this.activePeriod());
		if (this.activeStatus() !== 'all') list = list.filter(d => d.status === this.activeStatus());
		const q = this.searchQuery().trim().toLowerCase();
		if (q) list = list.filter(d => d.projectTitle.toLowerCase().includes(q));
		return list;
	});

	setPeriod(period: 'all' | 'week' | 'month'): void { this.activePeriod.set(period); }
	setStatus(status: 'all' | 'SUBMITTED' | 'REVISION_REQUESTED' | 'APPROVED'): void { this.activeStatus.set(status); }

	openDetail(delivery: CompanyDelivery): void {
		this.selectedDelivery.set(delivery);
	}

	closeDetail(): void {
		this.selectedDelivery.set(null);
	}

	messageClient(): void {
		this.showToast('تم فتح محادثة مع العميل');
	}

	private showToast(msg: string): void {
		this.toastMessage.set(msg);
		if (this.toastTimer) clearTimeout(this.toastTimer);
		this.toastTimer = setTimeout(() => this.toastMessage.set(''), 3000);
	}
}
