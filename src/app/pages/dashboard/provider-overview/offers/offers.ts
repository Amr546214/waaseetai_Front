import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { OffersService } from '../../../../core/services/offers.service';
import { Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';

export interface Offer {
	id: string;
	ref: string;
	title: string;
	price: string;
	status: 'pending' | 'accepted' | 'pending_signature' | 'nego' | 'PENDING_RESPONSE' | 'pending_response' | string;
	statusText: string;
	clientName: string;
	clientType: 'company' | 'individual';
	actionText: string;
}

@Component({
	selector: 'app-offers',
	standalone: true,
	imports: [RouterLink],
	templateUrl: './offers.html',
	styleUrl: './offers.css',
})
export class Offers implements OnInit {
	private offersService = inject(OffersService);
	private router = inject(Router);
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	// Company specialty filter
	companySpecialtyFilter = signal<string>('all');
	companySpecialtyOptions = [
		{ id: 'all', label: 'الكل' },
		{ id: 'web', label: 'ويب' },
		{ id: 'mobile', label: 'موبايل' },
		{ id: 'design', label: 'تصميم' },
		{ id: 'erp', label: 'ERP' },
	];

	setCompanySpecialty(id: string) {
		this.companySpecialtyFilter.set(id);
		this.fetchOffers();
	}

	// Status banner text: neutral until the API (rule-based) sends its own line - never a fabricated claim.
	bannerText = signal<string>('تابع عروضك المرسلة وردود العملاء من هنا.');

	// Status Filter
	activeStatus = signal<string>('all');
	statusOptions = [
		{ id: 'all', label: 'الكل', count: 0 },
		{ id: 'pending', label: 'بانتظار الرد', count: 0 },
		{ id: 'accepted', label: 'قُبل', count: 0 },
		{ id: 'nego', label: 'تفاوض', count: 0 }
	];

	// Client Filter
	activeClientType = signal<string>('all');
	clientOptions = [
		{ id: 'all', label: 'الكل' },
		{ id: 'individual', label: 'فرد' },
		{ id: 'company', label: 'شركة' }
	];

	// Sort Filter
	activeSort = signal<string>('new');
	sortOptions = [
		{ id: 'new', label: 'الأحدث' },
		{ id: 'price', label: 'الأعلى سعراً' },
		{ id: 'waiting', label: 'الأطول انتظاراً' }
	];

	searchQuery = signal<string>('');

	offers = signal<Offer[]>([]);

	// The offer currently shown in the "تفاصيل العرض" (offer detail) modal —
	// opened from handleOfferAction() for offers still awaiting the client's
	// response (pending / PENDING_RESPONSE / pending_response). No dedicated
	// "view offer" screen or negotiation-round data exists yet for an offer
	// that hasn't been responded to, so this shows only the real, already-
	// loaded offer fields (title, ref, price, client, status) rather than
	// silently doing nothing or fabricating negotiation content that never
	// happened (see OfferNegotiate, which assumes an active back-and-forth).
	selectedPendingOffer = signal<Offer | null>(null);

	filteredOffers = computed(() => {
		return this.offers().filter(o => {
			const matchStatus = this.activeStatus() === 'all' ||
				o.status === this.activeStatus() ||
				(this.activeStatus() === 'pending' && (o.status === 'pending_response' || o.status === 'PENDING_RESPONSE' || o.status === 'pending'));
			const matchClient = this.activeClientType() === 'all' || o.clientType === this.activeClientType();
			const matchQuery = !this.searchQuery() || o.title.includes(this.searchQuery()) || o.ref.includes(this.searchQuery());
			return matchStatus && matchClient && matchQuery;
		});
	});

	ngOnInit(): void {
		this.fetchOffers();
	}

	fetchOffers() {
		const params: any = {};
		if (this.activeStatus() !== 'all') params.status = this.activeStatus();
		if (this.activeClientType() !== 'all') params.clientType = this.activeClientType();
		if (this.searchQuery()) params.search = this.searchQuery();
		if (this.activeSort()) params.sortBy = this.activeSort();

		this.offersService.getOffers(params).subscribe({
			next: (res) => {
				if (res && res.data) {
					if (res.aiBannerText) {
						this.bannerText.set(res.aiBannerText);
					}
					if (res.counts) {
						this.statusOptions = this.statusOptions.map(opt => ({
							...opt,
							count: res.counts[opt.id] !== undefined ? res.counts[opt.id] : opt.count
						}));
					}
					const mapped = res.data.map((item: any) => ({
						id: item.offerId || item.id,
						ref: item.projectRef || item.ref,
						title: item.projectTitle || item.title,
						price: typeof item.offeredPrice === 'number' ? `${item.offeredPrice.toLocaleString('en-US')} $` : (item.price || '0 $'),
						status: item.statusKey || (item.status === 'UNDER_NEGOTIATION' ? 'nego' : item.status === 'ACCEPTED' ? 'accepted' : item.status === 'PENDING_RESPONSE' ? 'pending_response' : 'pending'),
						statusText: item.statusText || 'بانتظار الرد',
						clientName: item.clientName || 'عميل وسيط',
						clientType: (item.clientType && item.clientType.toUpperCase() === 'COMPANY') ? 'company' : 'individual',
						actionText: item.actionText || 'فتح العرض'
					}));
					this.offers.set(mapped);
					if (!res.counts && this.activeStatus() === 'all') {
						// No server counts: derive them from the loaded rows (real data, never placeholders).
						this.statusOptions = this.statusOptions.map(opt => ({
							...opt,
							count: opt.id === 'all' ? mapped.length : mapped.filter((o: any) => o.status === opt.id).length
						}));
					}
				}
			},
			error: (err) => {
				console.error('Could not load provider offers from API.', err);
				this.offers.set([]);
			}
		});
	}

	setStatus(id: string) {
		this.activeStatus.set(id);
		this.fetchOffers();
	}

	setClientType(id: string) {
		this.activeClientType.set(id);
		this.fetchOffers();
	}

	setSort(id: string) {
		this.activeSort.set(id);
		this.fetchOffers();
	}

	onSearch(event: Event) {
		const input = event.target as HTMLInputElement;
		this.searchQuery.set(input.value);
		this.fetchOffers();
	}

	getStatusClasses(status: string): string {
		switch (status) {
			case 'pending':
			case 'PENDING_RESPONSE':
			case 'pending_response':
			case 'PENDING':
				return 'bg-[rgba(15,169,154,.1)] text-[#0FA99A] border border-[rgba(15,169,154,.24)]';
			case 'accepted':
			case 'ACCEPTED':
			case 'pending_signature':
			case 'PENDING_SIGNATURE':
				return 'bg-[rgba(43,127,255,.1)] text-[#5DA0FF] border border-[rgba(43,127,255,.24)]';
			case 'nego':
			case 'under_negotiation':
			case 'UNDER_NEGOTIATION':
				return 'bg-[rgba(255,180,0,.12)] text-[#D98A0B] border border-[rgba(255,180,0,.25)]';
			default: return 'bg-[var(--sec-bg)] text-[var(--txt-2)] border border-[var(--sec-bd)]';
		}
	}

	getStatusDotClasses(status: string): string {
		switch (status) {
			case 'pending':
			case 'PENDING_RESPONSE':
			case 'pending_response':
			case 'PENDING':
				return 'bg-[#0FA99A]';
			case 'accepted':
			case 'ACCEPTED':
			case 'pending_signature':
			case 'PENDING_SIGNATURE':
				return 'bg-[#5DA0FF]';
			case 'nego':
			case 'under_negotiation':
			case 'UNDER_NEGOTIATION':
				return 'bg-[#FFB400]';
			default: return 'bg-[var(--txt-3)]';
		}
	}

	handleOfferAction(offer: Offer) {
		const status = (offer.status || '').toLowerCase();
		if (status === 'pending_signature') {
			this.router.navigate(['/provider-overview/offers', offer.id, 'sign-contract'], { state: { offer } });
		} else if (status === 'accepted') {
			this.router.navigate(['/provider-overview/projects/active']);
		} else if (status === 'nego' || status === 'under_negotiation') {
			this.router.navigate(['/provider-overview/offers', offer.id, 'negotiate']);
		} else if (status === 'pending' || status === 'pending_response') {
			// 'pending'/'PENDING_RESPONSE' — the default "awaiting client
			// response" state most offers start in. No negotiation has
			// happened yet, so routing to OfferNegotiate (which always shows
			// a fabricated client counter-offer round) would be dishonest.
			// Instead, show a real offer-detail view built only from the
			// already-loaded, real offer fields.
			this.selectedPendingOffer.set(offer);
		} else {
			// Any other/unknown status still gets a real detail view rather
			// than silently doing nothing.
			this.selectedPendingOffer.set(offer);
		}
	}

	closePendingOfferModal() {
		this.selectedPendingOffer.set(null);
	}

	messageOfferClient(offer: Offer) {
		this.selectedPendingOffer.set(null);
		this.router.navigate(['/provider-overview/messages'], {
			state: {
				messageContext: {
					type: 'PROJECT',
					projectId: offer.id,
					projectTitle: offer.title,
				}
			}
		});
	}
}
