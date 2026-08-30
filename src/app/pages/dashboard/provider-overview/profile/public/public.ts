import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';

@Component({
	selector: 'app-profile-public',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './public.html',
})
export class Public implements OnInit {
	private providerProfileService = inject(ProviderProfileService);
	private router = inject(Router);

	currentTab = signal<string>('info');
	showBanner = signal<boolean>(true);

	profileData = signal<any | null>(null);
	isLoading = signal<boolean>(true);

	ngOnInit() {
		this.loadPublicProfile();
	}

	loadPublicProfile() {
		this.isLoading.set(true);
		// Fetch for self-preview (no providerId specified defaults to req.user.id)
		this.providerProfileService.getPublicProfile().subscribe({
			next: (res) => {
				if (res.success) {
					this.profileData.set(res.data);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Failed to load public profile', err);
				this.isLoading.set(false);
			}
		});
	}

	setTab(tab: string) {
		this.currentTab.set(tab);
	}

	closeBanner() {
		this.showBanner.set(false);
	}

	editProfile() {
		this.router.navigate(['/provider-overview/profile/data']);
	}
}
