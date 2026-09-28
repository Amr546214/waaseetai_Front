import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { ClientPublicProfileService } from '../../../../core/services/client-public-profile.service';
import { ClientPublicProfile } from '../../../../core/models/client-public-profile.model';

// Implementation Batch 6. Every field below is real (backed by
// GET /api/client/profile/public/:id) — the previous hardcoded mock
// (name, location, interests, budgetRange/avgSpend, preferredCategories,
// project history with prices, reviews the client supposedly wrote, and
// the entire fabricated "aiTrust" block — overall/payment/commitment
// 94/97/89 plus a hardcoded "97% payment rate, trusted client"
// recommendation string) has been removed entirely rather than kept as a
// fallback, since none of it has a real backend source. There is no
// Gemini call in this feature at all — every stat is a deterministic
// count/average, and an honest facts-only profile is preferable to a
// fabricated score.

@Component({
	selector: 'app-client-profile',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './client-profile.html',
	styleUrl: './client-profile.css'
})
export class ClientProfileComponent implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private clientPublicProfile = inject(ClientPublicProfileService);

	profile = signal<ClientPublicProfile | null>(null);
	loading = signal<boolean>(true);
	notFound = signal<boolean>(false);
	error = signal<string>('');

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

		this.clientPublicProfile.getPublicProfile(id).subscribe({
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

	displayName(p: ClientPublicProfile): string {
		return p.name?.trim() || 'عميل وسيط';
	}

	initials(p: ClientPublicProfile): string {
		const name = p.name?.trim();
		return name ? name.charAt(0) : 'ع';
	}

	location(p: ClientPublicProfile): string {
		return [p.city, p.country].filter(Boolean).join('، ') || '';
	}

	memberSinceYear(p: ClientPublicProfile): string {
		try { return new Date(p.memberSince).getFullYear().toString(); } catch { return ''; }
	}

	/** P-MK-016 identity line: "جدة، المملكة العربية السعودية · عضو منذ 2023". */
	identityLine(p: ClientPublicProfile): string {
		const year = this.memberSinceYear(p);
		return [this.location(p), year ? 'عضو منذ ' + year : ''].filter(Boolean).join(' · ');
	}

	reviewDate(iso: string): string {
		try { return new Intl.DateTimeFormat('ar-SA', { month: 'long', year: 'numeric' }).format(new Date(iso)); } catch { return ''; }
	}

	/** P-MK-016 renders review stars as text (★★★★☆) in the kahr colour. */
	starText(rating: number): string {
		const full = Math.max(0, Math.min(5, Math.floor(rating)));
		return '★'.repeat(full) + '☆'.repeat(5 - full);
	}

	ratingLabel(rating: number): string {
		return Number.isFinite(rating) ? rating.toFixed(1) : '';
	}

	sendMessage() {
		if (!this.authStore.isAuthenticated()) {
			this.router.navigate(['/auth/login'], { queryParams: { returnUrl: this.router.url } });
			return;
		}
		this.router.navigate(['/provider-overview/messages']);
	}

}
