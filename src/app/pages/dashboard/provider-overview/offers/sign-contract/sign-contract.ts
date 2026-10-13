import { Component, computed, signal, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { OffersService } from '../../../../../core/services/offers.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

export interface ProviderContractMilestone { order: number; title: string; description: string | null; days: number | null; percentage: number | null; amount: number | null }
export interface ProviderContract {
	id: string; status: string; price: number; durationDays: number; phasesCount: number;
	milestones: ProviderContractMilestone[]; escrow: { amount: number; status: string } | null;
}

/** "5 يوم · 40% · 380 $" from whatever the saved milestone really has ('' when it has none of them). */
export function milestoneMeta(m: ProviderContractMilestone): string {
	const parts: string[] = [];
	if (m.days !== null) parts.push(`${m.days} يوم`);
	if (m.percentage !== null) parts.push(`${m.percentage}%`);
	if (m.amount !== null) parts.push(`${m.amount.toLocaleString('en-US')} $`);
	return parts.join(' · ');
}

const formatUsd = (v: number) => `${v.toLocaleString('en-US')} $`;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Reads `contract` from an offers-API item defensively: anything unusable means "no contract" (the page then shows nothing invented). */
export function readProviderContract(raw: unknown): ProviderContract | null {
	if (!raw || typeof raw !== 'object') return null;
	const c = raw as Record<string, any>;
	if (!finite(c['price']) || !finite(c['durationDays']) || !finite(c['phasesCount'])) return null;
	const milestones: ProviderContractMilestone[] = (Array.isArray(c['milestones']) ? c['milestones'] : [])
		.filter((m: any) => m && typeof m === 'object' && typeof m.title === 'string' && m.title.trim())
		.map((m: any, i: number) => ({ order: finite(m.order) ? m.order : i + 1, title: String(m.title), description: typeof m.description === 'string' && m.description ? m.description : null,
			days: finite(m.days) ? m.days : null, percentage: finite(m.percentage) ? m.percentage : null, amount: finite(m.amount) ? m.amount : null }));
	const e = c['escrow'];
	return { id: String(c['id'] ?? ''), status: String(c['status'] ?? ''), price: c['price'], durationDays: c['durationDays'], phasesCount: c['phasesCount'], milestones,
		escrow: e && finite(e.amount) ? { amount: e.amount, status: String(e.status ?? '') } : null };
}

@Component({
	selector: 'app-sign-contract',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './sign-contract.html',
	styleUrl: './sign-contract.css'
})
export class SignContract {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private offersService = inject(OffersService);
	private authStore = inject(AuthStore);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	// Company mode: identifies who is signing on behalf of the company and its
	// commercial registration number, for the contract's signing-party info.
	// Both are real fields already on the authenticated user — no dedicated
	// "signing authority" endpoint exists on the backend yet.
	signerName = computed<string>(() => {
		const user = this.authStore.currentUser();
		if (!user) return '';
		return `${user.firstName || ''} ${user.lastName || ''}`.trim();
	});

	signerCommercialRegistration = computed<string>(() => {
		return this.authStore.currentUser()?.commercialRegistration || '';
	});

	offerId = signal<string>('');
	offerTitle = signal<string>('جارٍ تحميل العقد...');
	offerRef = signal<string>('');
	/** The CLIENT of this offer (the other party of the contract). */
	clientName = signal<string>('');
	price = signal<string>('');
	// The REAL contract (price / duration / phases / saved milestones / funded escrow) returned by GET /provider/offers for an offer the provider
	// can sign now. null = no contract to show (client has not signed / funded yet, or the offer is not at the signing stage): nothing is invented.
	contract = signal<ProviderContract | null>(null);
	contractPrice = computed(() => { const c = this.contract(); return c ? formatUsd(c.price) : ''; });
	contractDuration = computed(() => { const c = this.contract(); return c && c.durationDays > 0 ? `${c.durationDays} يوم` : ''; });
	contractPhases = computed(() => { const c = this.contract(); return c ? (c.milestones.length || c.phasesCount) : 0; });
	escrowAmount = computed(() => { const c = this.contract(); return c?.escrow ? formatUsd(c.escrow.amount) : ''; });
	isLoading = signal<boolean>(true);
	loadError = signal<string | null>(null);

	isAgreed = false;

	showToast = signal<boolean>(false);
	toastMessage = signal<string>('');

	constructor() {
		const nav = this.router.getCurrentNavigation();
		if (nav?.extras?.state && nav.extras.state['offer']) {
			const offer = nav.extras.state['offer'];
			this.offerTitle.set(offer.title);
			this.offerRef.set(offer.ref);
			this.clientName.set(offer.clientName);
			this.price.set(offer.price);
			// We can keep default values for duration/phases or extract them if they existed in state
		}

		this.route.paramMap.subscribe(params => {
			const id = params.get('id');
			if (id) {
				this.offerId.set(id);
				this.fetchContractDetails(id);
			}
		});
	}

	fetchContractDetails(id: string) {
		this.isLoading.set(true);
		this.loadError.set(null);
		this.offersService.getOfferById(id).subscribe({
			next: (item) => {
				this.isLoading.set(false);
				this.offerTitle.set(item.projectTitle || item.title || this.offerTitle());
				this.offerRef.set(item.projectRef || item.ref || this.offerRef());
				this.clientName.set(item.clientName || this.clientName());
				this.price.set(typeof item.offeredPrice === 'number' ? `${item.offeredPrice.toLocaleString('en-US')} $` : (item.price || this.price()));
				this.contract.set(readProviderContract(item.contract));
			},
			error: (err) => {
				this.isLoading.set(false);
				this.loadError.set('تعذر تحميل العقد الحقيقي؛ تم تعطيل التوقيع لحماية حسابك.');
				console.error('Could not load contract details from API.', err);
			}
		});
	}

	milestoneMeta = milestoneMeta;

	displayToast(msg: string) {
		this.toastMessage.set(msg);
		this.showToast.set(true);
		setTimeout(() => {
			this.showToast.set(false);
		}, 3000);
	}

	signContract() {
		if (!this.isLoading() && !this.loadError() && !this.contract()) {
			this.displayToast('العقد غير جاهز لتوقيعك بعد: بانتظار توقيع العميل وإيداع الضمان');
			return;
		}
		if (this.isLoading() || this.loadError()) {
			this.displayToast(this.loadError() || 'انتظر حتى يكتمل تحميل العقد');
			return;
		}
		if (!this.isAgreed) {
			this.displayToast('يجب الموافقة على بنود العقد أولا');
			return;
		}

		this.offersService.signContract(this.offerId(), { accepted: true }).subscribe({
			next: (res) => {
				this.displayToast('تم توقيع العقد بنجاح، جاري التوجيه…');
				
				setTimeout(() => {
					this.router.navigate(['/provider-overview/projects/active']);
				}, 1500);
			},
			error: (err) => {
				this.displayToast(err?.error?.message || 'تعذر توقيع العقد، حاول مرة أخرى');
				console.error(err);
			}
		});
	}
}
