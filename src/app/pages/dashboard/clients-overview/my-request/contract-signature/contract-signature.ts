import { Component, signal, inject, OnInit, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { ThemeService } from '../../../../../core/services/theme.service';
import { environment } from '../../../../../../environments/environment';
import { ClientFinanceService } from '../../../../../core/services/client-finance.service';

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
	isLoading = signal<boolean>(true);
	isCheckingBalance = signal(false);
	requiredAmount = signal(0);

	requestTitle = signal<string>('جارٍ التحميل...');
	providerName = signal<string>('مقدم الخدمة');
	providerInitials = signal<string>('مـ');
	price = signal<string>('0 $');
	duration = signal<string>('0 يوما');
	plan = signal<string>('');
	/** The offer's real milestones (title, share, amount, days) — exactly what the contract was frozen from; nothing is invented. */
	milestones = signal<{ order: number; title: string; description: string; percentage: number; amount: number; days: number }[]>([]);
	description = signal<string>('');
	
	// Toast state
	showToastSignal = signal<boolean>(false);
	toastMessage = signal<string>('');
	
	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id');
		const offerId = this.route.snapshot.queryParamMap.get('offerId');
		
		if (id) {
			this.requestId.set(id);
			if (offerId) {
				this.offerId.set(offerId);
			}
			this.fetchDetails(id, offerId);
		}
	}

	fetchDetails(reqId: string, offerId: string | null) {
		this.isLoading.set(true);
		this.http.get<any>(`${environment.url_api}/client/my-requests/${reqId}`).subscribe({
			next: (res) => {
				if (res && res.success && res.data) {
					const data = res.data;
					this.requestTitle.set(data.title || 'مشروع بدون عنوان');
					
					let targetOffer = null;
					if (offerId && data.proposals && data.proposals.length > 0) {
						targetOffer = data.proposals.find((p: any) => p.id === offerId);
					}
					if (!targetOffer) {
						this.isLoading.set(false);
						this.showToast('العرض المختار غير موجود أو لم يعد متاحاً للتوقيع.');
						return;
					}

					if (targetOffer) {
						const offerPrice = Number(targetOffer.totalPrice || targetOffer.bidAmount || 0);
						// fee policy v2: the escrow lock charges the contract price only (no 13%); the wallet must hold at least the price
						this.requiredAmount.set(Math.round(offerPrice * 100) / 100);
						const name = targetOffer.provider?.name || (targetOffer.provider?.firstName ? `${targetOffer.provider.firstName} ${targetOffer.provider.lastName}` : 'مقدم الخدمة');
						this.providerName.set(name);
						const initials = name.split(' ').map((n: string) => n[0] || '').join('').substring(0, 2);
						this.providerInitials.set(initials || 'مـ');
						this.price.set(targetOffer.totalPrice ? `${targetOffer.totalPrice} $` : (targetOffer.bidAmount ? `${targetOffer.bidAmount} $` : 'غير محدد'));
						this.duration.set(targetOffer.deliveryDays ? `${targetOffer.deliveryDays} يوم` : (targetOffer.durationText || 'غير محدد'));
						this.milestones.set((Array.isArray(targetOffer.milestones) ? targetOffer.milestones : []).map((m: any, i: number) => ({
							order: Number(m.stepOrder) || i + 1,
							title: String(m.title || ''),
							description: String(m.description || ''),
							percentage: Number(m.percentage) || 0,
							amount: Number(m.amount) || 0,
							days: Number(m.days) || 0,
						})).filter((m: any) => m.title));
						this.plan.set(targetOffer.outputs || targetOffer.workPlan || '');
						this.description.set(targetOffer.message || targetOffer.description || '');
					}
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Error fetching details:', err);
				this.isLoading.set(false);
				this.showToast('حدث خطأ أثناء جلب بيانات العقد.');
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
	
	signContract(event: Event) {
		event.preventDefault();
		const cb = document.getElementById('ack-ctr') as HTMLInputElement;
		if (cb && !cb.checked) {
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
