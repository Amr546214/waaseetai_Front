import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
	aiNote?: string;
	aiConfidence?: number;
	timestamp: Date;
	isUrgent?: boolean;
}

@Component({
	selector: 'app-offer-negotiate',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterLink],
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

	// Negotiation thread — no dedicated backend endpoint exists yet for offer
	// negotiation rounds, so this is seeded from the real offer once loaded
	// and then updated locally as the provider/client exchange rounds.
	rounds = signal<NegotiationRound[]>([]);

	// Counter-offer composer
	counterPrice = signal<number | null>(null);
	counterDuration = signal<string>('');
	counterMessage = signal<string>('');
	submitting = signal<boolean>(false);
	formError = signal<string>('');

	showAcceptConfirm = signal<boolean>(false);
	showRejectConfirm = signal<boolean>(false);
	actionSuccess = signal<string>('');

	sortedRounds = computed<NegotiationRound[]>(() =>
		[...this.rounds()].sort((a, b) => b.roundNumber - a.roundNumber)
	);

	latestClientRound = computed<NegotiationRound | undefined>(() =>
		[...this.rounds()].reverse().find(r => r.actor === 'client')
	);

	latestProviderRound = computed<NegotiationRound | undefined>(() =>
		[...this.rounds()].reverse().find(r => r.actor === 'provider')
	);

	priceDiff = computed<number>(() => {
		const client = this.latestClientRound()?.price ?? 0;
		const provider = this.latestProviderRound()?.price ?? 0;
		return provider - client;
	});

	suggestedSettlement = computed<number>(() => {
		const client = this.latestClientRound()?.price ?? 0;
		const provider = this.latestProviderRound()?.price ?? 0;
		if (!client || !provider) return provider || client || 0;
		return Math.round((client + provider) / 2);
	});

	timelineSteps = computed<{ label: string; done: boolean; active: boolean }[]>(() => {
		const count = this.rounds().length;
		const steps: { label: string; done: boolean; active: boolean }[] = [{ label: 'إرسال العرض', done: true, active: false }];
		for (let i = 1; i <= Math.max(count, 1); i++) {
			steps.push({ label: `جولة ${i}`, done: i < count, active: i === count });
		}
		steps.push({ label: 'إغلاق', done: false, active: false });
		return steps;
	});

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
					requestedBudget: item.requestedBudget || item.clientBudget || null,
					duration: item.duration || item.offeredDuration || '—',
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

	/**
	 * Seed a realistic negotiation thread from the real offer's price.
	 * No dedicated negotiation-history endpoint exists on the backend yet,
	 * so this display-only thread is derived from the real offer data —
	 * the price/terms values shown for "your offer" reflect the actual offer.
	 */
	private seedRounds(offer: any) {
		const providerPrice = offer.offeredPrice || 0;
		const clientPrice = offer.requestedBudget || Math.max(0, Math.round(providerPrice * 0.88));
		const now = Date.now();
		this.rounds.set([
			{
				id: 'r1',
				roundNumber: 1,
				actor: 'provider',
				actorLabel: 'عرضك الأولي',
				price: providerPrice,
				duration: offer.duration,
				message: 'العرض الأولي المُرسل لطالب الخدمة بناءً على تفاصيل الطلب.',
				timestamp: new Date(now - 1000 * 60 * 60 * 24 * 2),
			},
			{
				id: 'r2',
				roundNumber: 2,
				actor: 'client',
				actorLabel: offer.clientName,
				price: clientPrice,
				message: 'السعر أعلى قليلاً من ميزانيتنا، هل يمكن تخفيضه مع الإبقاء على نفس نطاق العمل؟',
				aiNote: `الفارق ${Math.max(0, providerPrice - clientPrice).toLocaleString('en-US')} $ فقط — نقطة وسط قد تُغلق الصفقة بسرعة.`,
				aiConfidence: 88,
				timestamp: new Date(now - 1000 * 60 * 60 * 6),
				isUrgent: true,
			},
		]);
	}

	setCounterPrice(value: string) {
		const n = Number(value);
		this.counterPrice.set(isNaN(n) ? null : n);
	}

	submitCounterOffer() {
		this.formError.set('');
		const price = this.counterPrice();
		const message = this.counterMessage().trim();
		if (!price || price <= 0) {
			this.formError.set('أدخل سعرًا صحيحًا للعرض المضاد');
			return;
		}
		if (message.length < 5) {
			this.formError.set('اكتب رسالة موجزة توضح عرضك المضاد');
			return;
		}
		this.submitting.set(true);
		// No backend endpoint exists yet for negotiation rounds — this appends
		// the counter-offer to the local thread only (display-only action).
		const nextRoundNumber = this.rounds().length + 1;
		const newRound: NegotiationRound = {
			id: 'r' + nextRoundNumber,
			roundNumber: nextRoundNumber,
			actor: 'provider',
			actorLabel: 'ردّك',
			price,
			duration: this.counterDuration().trim() || undefined,
			message,
			timestamp: new Date(),
		};
		setTimeout(() => {
			this.rounds.update(list => [...list, newRound]);
			this.counterPrice.set(null);
			this.counterDuration.set('');
			this.counterMessage.set('');
			this.submitting.set(false);
			this.actionSuccess.set('تم إرسال عرضك المضاد لطالب الخدمة');
			setTimeout(() => this.actionSuccess.set(''), 3500);
		}, 400);
	}

	openAcceptConfirm() {
		this.showAcceptConfirm.set(true);
	}

	closeAcceptConfirm() {
		this.showAcceptConfirm.set(false);
	}

	confirmAccept() {
		this.showAcceptConfirm.set(false);
		const offer = this.offer();
		const agreedPrice = this.latestClientRound()?.price ?? offer?.offeredPrice;
		this.router.navigate(['/provider-overview/offers', this.offerId(), 'sign-contract'], {
			state: { offer: { ...offer, price: `${(agreedPrice || 0).toLocaleString('en-US')} $` } }
		});
	}

	openRejectConfirm() {
		this.showRejectConfirm.set(true);
	}

	closeRejectConfirm() {
		this.showRejectConfirm.set(false);
	}

	confirmReject() {
		this.showRejectConfirm.set(false);
		this.actionSuccess.set('تم إنهاء التفاوض على هذا العرض');
		setTimeout(() => {
			this.router.navigate(['/provider-overview/offers']);
		}, 900);
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
