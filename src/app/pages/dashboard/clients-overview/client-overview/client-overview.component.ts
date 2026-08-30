import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { DashboardStore } from '../../../../core/store/dashboard.store';
import { AuthStore } from '../../../../core/store/auth.store';

@Component({
	selector: 'app-client-overview',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './client-overview.component.html',
	styleUrl: './client-overview.component.css'
})
export class ClientOverviewComponent implements OnInit {
	public dashboardStore = inject(DashboardStore);
	public authStore = inject(AuthStore);
	private router = inject(Router);

	isProfileBannerDismissed = false;

	ngOnInit(): void {
		setTimeout(() => {
			this.dashboardStore.fetchDashboardStats();
		});

		try {
			if (sessionStorage.getItem('ws-profile-dismissed')) {
				this.isProfileBannerDismissed = true;
			}
		} catch (e) { }
	}

	getInitials(name: string): string {
		if (!name) return 'م';
		const parts = name.trim().split(' ');
		if (parts.length >= 2) {
			return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.substring(0, 2);
		}
		return name.substring(0, 2);
	}

	closeProfileBanner() {
		this.isProfileBannerDismissed = true;
		try {
			sessionStorage.setItem('ws-profile-dismissed', '1');
		} catch (e) { }
	}

	goToProposal(projectId: string) {
		this.router.navigate(['/client-overview/my-requests', projectId]);
	}

	getAvatarStyle(index: number): string {
		const styles = [
			'background:linear-gradient(135deg,rgba(43,212,199,.18),rgba(43,127,255,.12));color:var(--teal-txt,#2BD4C7);border:2px solid #2ECC8A',
			'background:linear-gradient(135deg,rgba(43,127,255,.18),rgba(43,127,255,.10));color:#5DA0FF;border:2px solid #5DA0FF',
			'background:linear-gradient(135deg,rgba(43,212,199,.16),rgba(43,127,255,.12));color:var(--teal-txt,#2BD4C7);border:2px solid #2BD4C7'
		];
		return styles[index % styles.length];
	}

	getLevelBadgeStyle(index: number): string {
		const styles = [
			'font-size:9px;font-weight:800;color:#2ECC8A;background:rgba(46,204,138,.12);border:1px solid rgba(46,204,138,.25);border-radius:7px;padding:1px 6px',
			'font-size:9px;font-weight:800;color:#5DA0FF;background:rgba(93,160,255,.12);border:1px solid rgba(93,160,255,.25);border-radius:7px;padding:1px 6px',
			'font-size:9px;font-weight:800;color:#2BD4C7;background:rgba(43,212,199,.12);border:1px solid rgba(43,212,199,.25);border-radius:7px;padding:1px 6px'
		];
		return styles[index % styles.length];
	}

	getLevelColor(index: number): string {
		const colors = ['#2ECC8A', '#5DA0FF', '#2BD4C7'];
		return colors[index % colors.length];
	}

	getLevelLabel(index: number): string {
		const labels = ['خبير', 'متقن', 'أخصائي', 'محترف', 'مبكر'];
		return labels[index % labels.length];
	}
}
