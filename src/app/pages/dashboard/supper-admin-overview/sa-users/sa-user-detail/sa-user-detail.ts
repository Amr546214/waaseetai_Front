import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SaUsersService, AdminUserDetail } from '../sa-users.service';

type DetailTab = 'overview' | 'requests' | 'purchases' | 'disputes' | 'reports' | 'contracts' | 'payments';

@Component({
	selector: 'app-sa-user-detail',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './sa-user-detail.html',
	styleUrl: './sa-user-detail.css'
})
export class SaUserDetail implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private usersService = inject(SaUsersService);

	user = signal<AdminUserDetail | null>(null);
	loading = signal<boolean>(true);
	notFound = signal<boolean>(false);
	error = signal<string>('');
	activeTab = signal<DetailTab>('overview');

	SL: Record<string, string> = { active: 'نشط', suspended: 'موقوف', suspended_review: 'معلق مراجعة', pending_verification: 'معلق' };
	SC: Record<string, string> = { active: 's-active', suspended: 's-suspended', suspended_review: 's-pending', pending_verification: 's-pending' };
	LC: Record<string, string> = { Bronze: '#CD7F32', Silver: '#A8A9AD', Gold: '#D98A0B', Platinum: '#5DA0FF' };

	tabs: { key: DetailTab; label: string }[] = [
		{ key: 'overview', label: 'نظرة عامة' },
		{ key: 'requests', label: 'طلباته' },
		{ key: 'purchases', label: 'مشترياته' },
		{ key: 'disputes', label: 'نزاعاته' },
		{ key: 'reports', label: 'بلاغاته' },
		{ key: 'contracts', label: 'عقوده' },
		{ key: 'payments', label: 'مدفوعاته' },
	];

	ngOnInit(): void {
		this.route.paramMap.subscribe(params => {
			const id = params.get('id');
			if (!id) {
				this.notFound.set(true);
				this.loading.set(false);
				return;
			}
			this.fetchDetail(id);
		});
	}

	private fetchDetail(id: string): void {
		this.loading.set(true);
		this.notFound.set(false);
		this.error.set('');
		this.user.set(null);

		this.usersService.getUserDetail(id).subscribe({
			next: (res) => {
				this.loading.set(false);
				if (res?.success && res.data) {
					this.user.set(res.data);
				} else {
					this.notFound.set(true);
				}
			},
			error: (err) => {
				this.loading.set(false);
				if (err?.status === 404) {
					this.notFound.set(true);
				} else {
					this.error.set(err?.error?.message || 'تعذر تحميل ملف المستخدم، حاول مرة أخرى');
				}
			}
		});
	}

	retry(): void {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) this.fetchDetail(id);
	}

	setTab(tab: DetailTab): void {
		this.activeTab.set(tab);
	}

	tabCount(u: AdminUserDetail, tab: DetailTab): number | null {
		if (tab === 'disputes') return u.kpis.disputes || null;
		if (tab === 'reports') return u.kpis.reports || null;
		return null;
	}

	/** Revenue bar chart: scale each point to the max in the series. */
	revenueBarHeight(u: AdminUserDetail, value: number): number {
		const max = Math.max(...u.revenueHistory.map(p => p.value), 1);
		return Math.max(4, Math.round((value / max) * 100));
	}

	goBack(): void {
		this.router.navigate(['/supper-admin-overview/users']);
	}
}
