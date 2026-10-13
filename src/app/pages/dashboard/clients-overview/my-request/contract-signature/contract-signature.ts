import { Component, signal, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../../../../core/services/theme.service';
import { environment } from '../../../../../../environments/environment';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';

/** What the page can show: only 'ready' may offer the sign/pay action; 'readonly' shows the contract's terms of an already signed / running contract. */
type ContractView = 'loading' | 'ready' | 'readonly' | 'blocked' | 'error';

@Component({
	selector: 'app-contract-signature',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './contract-signature.html',
	styleUrl: './contract-signature.css',
	encapsulation: ViewEncapsulation.None
})
export class ContractSignature implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private http = inject(HttpClient);
	private clientFinanceService = inject(ClientFinanceService);
	public themeService = inject(ThemeService);

	requestId = signal<string>('');
	offerId = signal<string | null>(null);
	view = signal<ContractView>('loading');
	/** Why the contract cannot be signed right now (shown instead of the sign button). */
	blockedReason = signal('');
	isLoading = () => this.view() === 'loading';
	isCheckingBalance = signal(false);
	acknowledged = signal(false);
	requiredAmount = signal(0);

	requestTitle = signal<string>('');
	providerName = signal<string>('');
	price = signal<string>('');
	duration = signal<string>('');
	/** The contract's real stages (title, share, amount, days) exactly as they were frozen when the offer was selected; nothing is invented. */
	milestones = signal<{ order: number; title: string; description: string; percentage: number; amount: number; days: number }[]>([]);
	/** True when the frozen contract has no stages: one final delivery for the whole price. */
	singleDelivery = signal(false);

	// Toast state
	showToastSignal = signal<boolean>(false);
	toastMessage = signal<string>('');

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id');
		const offerId = this.route.snapshot.queryParamMap.get('offerId');
		if (!id) { this.view.set('error'); return; }
		this.requestId.set(id);
		if (offerId) this.offerId.set(offerId);
		this.fetchContract(id, offerId);
	}

	/** Reads the frozen contract (price / duration / stages as selected, or as the accepted counter set them), not the offers list. */
	fetchContract(reqId: string, offerId: string | null) {
		this.view.set('loading');
		const query = offerId ? `?offerId=${encodeURIComponent(offerId)}` : '';
		this.http.get<any>(`${environment.url_api}/client/my-requests/${reqId}/contract${query}`).subscribe({
			next: (res) => {
				const c = res?.success ? res.data : null;
				if (!c) { this.view.set('error'); return; }
				this.requestTitle.set(c.title || '');
				if (c.state === 'no_contract') {
					this.blockedReason.set(c.message || 'لم يتم اختيار عرض لهذا الطلب بعد.');
					this.view.set('blocked');
					return;
				}
				this.providerName.set(c.provider?.name || '');
				this.requiredAmount.set(Math.round(Number(c.price || 0) * 100) / 100);
				this.price.set(`${Number(c.price || 0)} $`);
				this.duration.set(c.durationDays ? `${c.durationDays} يوم` : '');
				this.milestones.set((Array.isArray(c.milestones) ? c.milestones : []).map((m: any, i: number) => ({
					order: Number(m.order) || i + 1,
					title: String(m.title || ''),
					description: String(m.description || ''),
					percentage: Number(m.percentage) || 0,
					amount: Number(m.amount) || 0,
					days: Number(m.days) || 0,
				})));
				this.singleDelivery.set(!!c.singleDelivery);
				if (c.offerMatches === false || this.requiredAmount() <= 0) {
					this.blockedReason.set(c.message || 'هذا العقد غير جاهز للتوقيع حالياً.');
					this.view.set('blocked');
					return;
				}
				if (!c.ready) {
					// The contract exists but is past (or outside) the client's signature: show its terms, offer no signing.
					this.blockedReason.set(c.message || 'هذا العقد غير متاح للتوقيع حالياً.');
					this.view.set('readonly');
					return;
				}
				this.view.set('ready');
			},
			error: (err) => {
				// A 404 is "not your request / does not exist": there is nothing to sign, say so instead of a generic failure.
				if (err?.status === 404) {
					this.blockedReason.set(err.error?.message || 'طلب المشروع غير موجود أو لا تملك صلاحية الوصول إليه.');
					this.view.set('blocked');
					return;
				}
				this.view.set('error');
			}
		});
	}

	goBack() {
		this.router.navigate(['/client-overview/my-requests', this.requestId()]);
	}

	showToast(msg: string) {
		this.toastMessage.set(msg);
		this.showToastSignal.set(true);
		setTimeout(() => {
			this.showToastSignal.set(false);
		}, 3000);
	}

	toggleAck(event: Event) {
		this.acknowledged.set((event.target as HTMLInputElement).checked);
	}

	signContract(event: Event) {
		event.preventDefault();
		if (this.view() !== 'ready') return;
		if (!this.acknowledged()) {
			this.showToast('يجب الموافقة على بنود العقد أولا');
			return;
		}

		if (!this.offerId() || this.requiredAmount() <= 0 || this.isCheckingBalance()) return;

		this.isCheckingBalance.set(true);
		this.clientFinanceService.getWallet().subscribe({
			next: (response) => {
				this.isCheckingBalance.set(false);
				const balance = Number(response.data?.summary?.availableBalance || 0);
				const shortfall = Math.max(0, Math.round((this.requiredAmount() - balance) * 100) / 100);
				if (shortfall > 0) {
					this.showToast(`رصيد المحفظة غير كافٍ. يلزم شحن ${shortfall.toLocaleString('en-US')} $.`);
				}
				this.router.navigate(['/client-overview/my-requests', this.requestId(), 'deposit'], {
					queryParams: { offerId: this.offerId() }
				});
			},
			error: () => {
				this.isCheckingBalance.set(false);
				this.showToast('تعذر التحقق من رصيد المحفظة. حاول مرة أخرى.');
			}
		});
	}
}
