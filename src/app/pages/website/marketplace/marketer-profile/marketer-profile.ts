import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { MarketerPublicProfileService } from '../../../../core/services/marketer-public-profile.service';
import { MarketerPublicProfile } from '../../../../core/models/marketer-public-profile.model';

// Implementation Batch 3, Part A. Every field below is real (backed by
// GET /api/marketer/profile/public/:id) — the previous hardcoded
// "فهد الغامدي" mock (name, headline, bio, followers, engagementRate,
// monthlyReach, campaigns, per-channel followers/engagementRate/reachLabel/
// status, and the entire fake "audience" demographics block) has been
// removed entirely rather than kept as a fallback, since none of it has a
// real backend source.

@Component({
	selector: 'app-marketer-profile',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './marketer-profile.html',
	styleUrl: './marketer-profile.css'
})
export class MarketerProfileComponent implements OnInit {
	private platformId = inject(PLATFORM_ID);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private marketerPublicProfile = inject(MarketerPublicProfileService);

	profile = signal<MarketerPublicProfile | null>(null);
	loading = signal<boolean>(true);
	notFound = signal<boolean>(false);
	error = signal<string>('');
	activeTab = signal<'profile' | 'channels'>('profile');
	isFavorite = signal<boolean>(false);

	ngOnInit(): void {
		this.route.paramMap.subscribe(params => {
			const id = params.get('id');
			if (!id) {
				this.notFound.set(true);
				this.loading.set(false);
				return;
			}
			this.fetchProfile(id);
		});
	}

	private fetchProfile(id: string) {
		this.loading.set(true);
		this.notFound.set(false);
		this.error.set('');
		this.profile.set(null);

		this.marketerPublicProfile.getPublicProfile(id).subscribe({
			next: (res) => {
				this.loading.set(false);
				if (res.success && res.data) {
					this.profile.set(res.data);
					if (isPlatformBrowser(this.platformId)) {
						setTimeout(() => this.initParticles(), 0);
					}
				} else {
					this.notFound.set(true);
				}
			},
			error: (err) => {
				this.loading.set(false);
				if (err?.status === 404) {
					this.notFound.set(true);
				} else {
					this.error.set(err?.error?.message || 'تعذر تحميل الملف الشخصي، حاول مرة أخرى');
				}
			},
		});
	}

	retry() {
		const id = this.route.snapshot.paramMap.get('id');
		if (id) this.fetchProfile(id);
	}

	setTab(tab: 'profile' | 'channels') {
		this.activeTab.set(tab);
	}

	toggleFavorite() {
		this.isFavorite.set(!this.isFavorite());
	}

	displayName(p: MarketerPublicProfile): string {
		return p.name?.trim() || 'مسوّق تسويقي';
	}

	initials(p: MarketerPublicProfile): string {
		const name = p.name?.trim();
		return name ? name.charAt(0) : 'م';
	}

	channelIcon(platform: string): string {
		const key = platform.toUpperCase();
		if (key.includes('INSTAGRAM')) return 'ws-social-instagram';
		if (key.includes('YOUTUBE')) return 'ws-social-youtube';
		if (key.includes('TIKTOK')) return 'ws-social-tiktok';
		if (key.includes('TWITTER') || key === 'X') return 'ws-social-x';
		if (key.includes('SNAPCHAT')) return 'ws-social-snapchat';
		return 'ws-broker';
	}

	requestMarketing() {
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		this.router.navigate(['/client-overview/messages']);
	}

	private initParticles() {
		const pc = document.getElementById('particles-container');
		if (!pc || pc.children.length > 0) return;
		const n = window.innerWidth < 768 ? 11 : 25;
		for (let i = 0; i < n; i++) {
			const p = document.createElement('div');
			p.className = 'particle';
			p.style.cssText = 'left:' + Math.random() * 100 + '%;width:' + (Math.random() * 3 + 2) + 'px;height:' + (Math.random() * 3 + 2) + 'px;animation-duration:' + (Math.random() * 20 + 15) + 's;animation-delay:-' + (Math.random() * 20) + 's';
			pc.appendChild(p);
		}
	}
}
