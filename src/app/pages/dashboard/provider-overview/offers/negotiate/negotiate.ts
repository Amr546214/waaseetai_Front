import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OffersService, OfferNegotiationState } from '../../../../../core/services/offers.service';
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

	rounds = signal<NegotiationRound[]>([]);

	/** What the provider may do right now, straight from the server (never guessed locally). */
	neg = signal<OfferNegotiationState | null>(null);
	negLoading = signal<boolean>(false);
	negError = signal<string>('');

	// counter offer form
	counterPrice = signal<string>('');
	counterDays = signal<string>('');
	counterNote = signal<string>('');
	counterSaving = signal<boolean>(false);
	counterError = signal<string>('');
	counterTouched = signal<boolean>(false);
	counterSuccess = signal<boolean>(false);

	// reject / withdraw (two steps: the button, then an explicit confirmation)
	confirming = signal<'reject' | 'withdraw' | null>(null);
	acting = signal<boolean>(false);
	actionError = signal<string>('');
	actionDone = signal<string>('');

	readonly COUNTER_SUCCESS_TEXT = 'تم إرسال العرض المضاد وهو بانتظار رد العميل. لا يتغير السعر ولا المدة الرسمية لعرضك إلا بعد رد العميل لاحقًا.';

	timelineSteps = computed<{ label: string; done: boolean; active: boolean }[]>(() => {
		const status = this.neg()?.status;
		const under = status === 'UNDER_NEGOTIATION';
		const closed = status === 'CANCELLED';
		return [
			{ label: 'إرسال العرض', done: true, active: false },
			{ label: 'التفاوض مع العميل', done: closed, active: under },
			{ label: closed ? 'تم سحب العرض' : 'إغلاق', done: closed, active: false },
		];
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
					projectId: item.projectId || undefined,
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
				this.loadNegotiation();
			},
			error: (err) => {
				console.error('Could not load offer for negotiation.', err);
				this.error.set('تعذر تحميل بيانات العرض. حاول مرة أخرى.');
				this.loading.set(false);
			}
		});
	}

	loadNegotiation() {
		const id = this.offerId();
		if (!id) return;
		this.negLoading.set(true);
		this.negError.set('');
		this.offersService.getNegotiation(id).subscribe({
			next: (state) => {
				this.neg.set(state);
				this.negLoading.set(false);
				this.rebuildRounds();
			},
			error: (err) => {
				this.negLoading.set(false);
				this.neg.set(null);
				this.negError.set(err?.error?.message || 'تعذر تحميل حالة التفاوض. حاول مرة أخرى.');
			}
		});
	}

	/** The provider's own real offer, plus only what the server really holds: the client's open request and the provider's pending counter. */
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

	private rebuildRounds() {
		const offer = this.offer();
		if (!offer) return;
		this.seedRounds(offer);
		const state = this.neg();
		const rounds = [...this.rounds()];
		const when = (iso?: string) => { const d = iso ? new Date(iso) : null; return d && !isNaN(d.getTime()) ? d : null; };
		const days = (n: number | null | undefined) => (typeof n === 'number' ? `${n} يوم` : undefined);
		if (state?.request) {
			const r = state.request;
			rounds.push({
				id: 'req', roundNumber: rounds.length + 1, actor: 'client', actorLabel: 'طلب التفاوض من العميل',
				price: r.price ?? 0, duration: days(r.deliveryDays),
				message: r.price === null ? (r.notes || 'طلب بنص حر بدون أرقام واضحة') : r.notes,
				timestamp: when(r.createdAt)
			});
		}
		if (state?.counter) {
			const c = state.counter;
			rounds.push({
				id: 'ctr', roundNumber: rounds.length + 1, actor: 'provider', actorLabel: 'عرضك المضاد (بانتظار رد العميل)',
				price: c.price ?? 0, duration: days(c.deliveryDays), message: c.notes, timestamp: when(c.createdAt)
			});
		}
		this.rounds.set(rounds);
	}

	// ---- counter offer ----
	counterPriceValue(): number | null {
		const raw = this.counterPrice().trim();
		if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
		const n = Number(raw);
		return n > 0 && n <= 10_000_000 ? n : null;
	}
	counterDaysValue(): number | null {
		const raw = this.counterDays().trim();
		if (!/^\d+$/.test(raw)) return null;
		const n = Number(raw);
		return n >= 1 && n <= 3650 ? n : null;
	}

	/** Why the counter cannot be sent yet (null = ready). */
	counterBlocker(): string | null {
		if (!this.neg()?.canCounter) return 'لا يمكن إرسال عرض مضاد في الحالة الحالية';
		if (this.counterPriceValue() === null) return 'أدخل سعرًا صحيحًا أكبر من صفر';
		if (this.counterDaysValue() === null) return 'أدخل مدة تنفيذ صحيحة بالأيام';
		if (this.counterNote().length > 500) return 'الملاحظة طويلة جدًا (الحد الأقصى 500 حرف)';
		return null;
	}

	/** Shown once the provider has left a counter field: price and duration are both required. */
	counterFieldsMissing(): boolean {
		return this.counterTouched() && (this.counterPriceValue() === null || this.counterDaysValue() === null);
	}

	onCounterInput(field: 'price' | 'days' | 'note', event: Event) {
		const value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
		if (field === 'price') this.counterPrice.set(value);
		else if (field === 'days') this.counterDays.set(value);
		else this.counterNote.set(value);
		this.counterError.set('');
	}

	submitCounter() {
		const price = this.counterPriceValue();
		const days = this.counterDaysValue();
		if (this.counterSaving() || this.counterBlocker() || price === null || days === null) return;
		this.counterSaving.set(true);
		this.counterError.set('');
		this.counterSuccess.set(false);
		const note = this.counterNote().trim();
		this.offersService.counterOffer(this.offerId(), { price, deliveryDays: days, ...(note ? { note } : {}) }).subscribe({
			next: () => {
				this.counterSaving.set(false);
				this.counterSuccess.set(true);
				this.counterPrice.set('');
				this.counterDays.set('');
				this.counterNote.set('');
				this.loadNegotiation();
			},
			error: (err) => {
				this.counterSaving.set(false);
				this.counterError.set(err?.error?.message || 'تعذر إرسال العرض المضاد. حاول مرة أخرى.');
			}
		});
	}

	// ---- reject the client's request / withdraw the offer ----
	ask(kind: 'reject' | 'withdraw') {
		this.actionError.set('');
		this.confirming.set(kind);
	}
	cancelAsk() {
		this.confirming.set(null);
	}

	confirmReject() {
		const messageId = this.neg()?.request?.messageId;
		if (this.acting() || !this.neg()?.canReject || !messageId) return;
		this.acting.set(true);
		this.actionError.set('');
		this.offersService.rejectNegotiation(this.offerId(), messageId).subscribe({
			next: () => {
				this.acting.set(false);
				this.confirming.set(null);
				this.actionDone.set('تم الاعتذار عن طلب التفاوض، ويبقى عرضك بشروطه الأصلية.');
				this.loadNegotiation();
			},
			error: (err) => {
				this.acting.set(false);
				this.actionError.set(err?.error?.message || 'تعذر تنفيذ الإجراء. حاول مرة أخرى.');
			}
		});
	}

	confirmWithdraw() {
		if (this.acting() || !this.neg()?.canWithdraw) return;
		this.acting.set(true);
		this.actionError.set('');
		this.offersService.withdrawOffer(this.offerId()).subscribe({
			next: () => {
				this.acting.set(false);
				this.confirming.set(null);
				this.actionDone.set('تم سحب العرض.');
				this.loadNegotiation();
			},
			error: (err) => {
				this.acting.set(false);
				this.actionError.set(err?.error?.message || 'تعذر سحب العرض. حاول مرة أخرى.');
			}
		});
	}

	openConversation() {
		const offer = this.offer();
		this.router.navigate(['/provider-overview/messages'], {
			state: {
				messageContext: {
					type: 'PROJECT',
					// the project's own id (never the offer id): the messages page opens only this project's conversation
					projectId: offer?.projectId,
					projectTitle: offer?.title,
				}
			}
		});
	}
}
