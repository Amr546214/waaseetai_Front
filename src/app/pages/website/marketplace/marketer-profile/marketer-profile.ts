import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
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

	// P-MK-014 shows the first two letters of the first name in the avatar ("فه").
	initials(p: MarketerPublicProfile): string {
		const name = p.name?.trim();
		return name ? name.split(/\s+/)[0].slice(0, 2) : 'م';
	}

	private platformKey(platform: string): string {
		const key = (platform || '').toUpperCase();
		if (key.includes('INSTAGRAM')) return 'instagram';
		if (key.includes('YOUTUBE')) return 'youtube';
		if (key.includes('TIKTOK')) return 'tiktok';
		if (key.includes('SNAPCHAT')) return 'snapchat';
		if (key.includes('TWITTER') || key === 'X') return 'x';
		if (key.includes('WHATSAPP')) return 'whatsapp';
		if (key.includes('TELEGRAM')) return 'telegram';
		if (key.includes('LINKEDIN')) return 'linkedin';
		return 'other';
	}

	channelIcon(platform: string): string {
		const k = this.platformKey(platform);
		return k === 'other' ? 'ws-social-globe' : 'ws-social-' + k;
	}

	/** Platform name as the design writes it (e.g. "Instagram · …"). */
	platformLabel(platform: string): string {
		const labels: Record<string, string> = {
			instagram: 'Instagram', youtube: 'YouTube', tiktok: 'TikTok', snapchat: 'Snapchat',
			x: 'X', whatsapp: 'WhatsApp', telegram: 'Telegram', linkedin: 'LinkedIn',
		};
		return labels[this.platformKey(platform)] ?? platform;
	}

	/** Brand tile colours copied from P-MK-015's channel cards. `mini` = the
	 *  condensed "قنوات إضافية" rows, whose Instagram tile uses a 2-stop gradient. */
	channelIconStyle(platform: string, mini = false): string {
		switch (this.platformKey(platform)) {
			case 'instagram': return mini ? 'background:linear-gradient(135deg,#833ab4,#fd1d1d);color:#fff' : 'background:linear-gradient(135deg,#833ab4,#fd1d1d,#fcb045);color:#fff';
			case 'youtube': return 'background:#FF0000;color:#fff';
			case 'tiktok': return 'background:#010101;border:1px solid rgba(255,255,255,.1);color:#fff';
			case 'snapchat': return 'background:#FFFC00;color:#000';
			case 'x': return 'background:#000;border:1px solid rgba(255,255,255,.1);color:#fff';
			case 'whatsapp': return 'background:#25D366;color:#fff';
			case 'telegram': return 'background:#0088cc;color:#fff';
			case 'linkedin': return 'background:#0077B5;color:#fff';
			default: return 'background:var(--surface);border:1px solid var(--border);color:var(--txt-3)';
		}
	}

	/** The design's niche-tag row lists the broker's platforms three per tag
	 *  ("Instagram · YouTube · TikTok", "Snapchat · X · Telegram"). Built from
	 *  the real registered channels only. */
	platformTags(p: MarketerPublicProfile): string[] {
		const names = [...new Set(p.channels.map(c => this.platformLabel(c.platform)))];
		const tags: string[] = [];
		for (let i = 0; i < names.length; i += 3) tags.push(names.slice(i, i + 3).join(' · '));
		return tags;
	}

	platformCount(p: MarketerPublicProfile): number {
		return new Set(p.channels.map(c => this.platformKey(c.platform) === 'other' ? c.platform : this.platformKey(c.platform))).size;
	}

	metricsTotal(p: MarketerPublicProfile, key: 'visitors' | 'clients'): number {
		return (p.channelMetrics || []).reduce((acc, m) => acc + (Number(m[key]) || 0), 0);
	}

	/** Share button (design icon): native share sheet where available, else copy the link. */
	shareProfile() {
		if (typeof window === 'undefined') return;
		const url = window.location.href;
		const nav: any = navigator;
		if (nav.share) {
			nav.share({ title: document.title, url }).catch(() => undefined);
		} else if (nav.clipboard?.writeText) {
			nav.clipboard.writeText(url).catch(() => undefined);
		}
	}

	requestMarketing() {
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		this.router.navigate(['/client-overview/messages']);
	}

}
