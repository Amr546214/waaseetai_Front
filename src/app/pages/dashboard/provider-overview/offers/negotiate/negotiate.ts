import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OffersService } from '../../../../../core/services/offers.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

export interface NegotiationRound {
	id: string;
	roundNumber: number;
	actor: 'provider' | 'client';
	actorLabel: string;
	price: number;
	duration?: string;
	message: string;
	timestamp: Date | null;
}

@Component({
	selector: 'app-offer-negotiate',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './negotiate.html',
	styleUrl: './negotiate.css',
})
export class OfferNegotiate implements OnInit {
	private offersService = inject(OffersService);
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	// Company mode: identifies which team member (the logged-in company user)
	// is conducting this negotiation, matching the design's "المكلّف" (assignee)
	// indicator shown per negotiation thread. Sourced from the real authenticated
	// user — no dedicated "assigned negotiator" backend field exists yet.
	negotiatorName = computed<string>(() => {
		const user = this.authStore.currentUser();
		if (!user) return '';
		return `${user.firstName || ''} ${user.lastName || ''}`.trim();
	});

	negotiatorInitials = computed<string>(() => {
		const name = this.negotiatorName();
		return name ? name.trim().charAt(0) : 'م';
	});

	offerId = signal<string>('');
	offer = signal<any>(null);
	loading = signal<boolean>(true);
	error = signal<string>('');

	// AI Cleanup Batch 2: no negotiation-rounds / counter-offer / withdraw endpoint
	// exists on the backend (GET /provider/offers + POST /provider/offers/:id/sign are
	// the only offer endpoints). The thread therefore only shows the provider's own
	// real submitted offer. The previously fabricated client round (invented message,
	// price = 88% of the offer, "AI 88%" note), the midpoint "settlement" suggestion,
	// the local-only counter-offer "sent" toast and the local-only accept/end actions
	// were removed. Real negotiation happens in the conversation (openConversation).
	rounds = signal<NegotiationRound[]>([]);

	timelineSteps: { label: string; done: boolean; active: boolean }[] = [
		{ label: 'إرسال العرض', done: true, active: false },
		{ label: 'التفاوض عبر المحادثة', done: false, active: true },
		{ label: 'إغلاق', done: false, active: false },
	];

	ngOnInit(): void {
		const id = this.route.snapshot.paramMap.get('id') || '';
		this.offerId.set(id);
		if (!id) {
			this.error.set('لا يوجد معرّف عرض صالح');
			this.loading.set(false);
			return;
		}
		this.loadOffer(id);
	}

	loadOffer(id: string) {
		this.loading.set(true);
		this.error.set('');
		this.offersService.getOfferById(id).subscribe({
			next: (item) => {
				const mapped = {
					id: item.offerId || item.id || id,
					ref: item.projectRef || item.ref || '—',
					title: item.projectTitle || item.title || 'الطلب',
					clientName: item.clientName || 'عميل وسيط',
					clientType: (item.clientType && String(item.clientType).toUpperCase() === 'COMPANY') ? 'company' : 'individual',
					offeredPrice: typeof item.offeredPrice === 'number' ? item.offeredPrice : Number(String(item.price || '0').replace(/[^\d.]/g, '')) || 0,
					duration: item.duration || item.offeredDuration || '—',
					statusText: item.statusText || '',
					createdAt: item.createdAt || null,
				};
				this.offer.set(mapped);
				this.seedRounds(mapped);
				this.loading.set(false);
			},
			error: (err) => {
				console.error('Could not load offer for negotiation.', err);
				this.error.set('تعذر تحميل بيانات العرض. حاول مرة أخرى.');
				this.loading.set(false);
			}
		});
	}

	/** Only the provider's own real offer — no client rounds are invented. */
	private seedRounds(offer: any) {
		const ts = offer.createdAt ? new Date(offer.createdAt) : null;
		this.rounds.set([
			{
				id: 'r1',
				roundNumber: 1,
				actor: 'provider',
				actorLabel: 'عرضك المُرسل',
				price: offer.offeredPrice || 0,
				duration: offer.duration,
				message: '',
				timestamp: ts && !isNaN(ts.getTime()) ? ts : null,
			},
		]);
	}

	openConversation() {
		const offer = this.offer();
		this.router.navigate(['/provider-overview/messages'], {
			state: {
				messageContext: {
					type: 'PROJECT',
					projectId: this.offerId(),
					projectTitle: offer?.title,
				}
			}
		});
	}
}
