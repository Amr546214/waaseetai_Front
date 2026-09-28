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
	description = signal<string>('');
	
	showTermsModal = signal<boolean>(false);
	termsInput = signal<string>('');
	chatMessages = signal<any[]>([
		{ text: 'أهلا، أي بند ترغب بتعديله قبل التوقيع؟', isMe: false, sender: 'مقدم الخدمة' }
	]);
	showAiExtract = signal<boolean>(false);

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
						this.requiredAmount.set(Math.round(offerPrice * 1.13 * 100) / 100);
						const name = targetOffer.provider?.name || (targetOffer.provider?.firstName ? `${targetOffer.provider.firstName} ${targetOffer.provider.lastName}` : 'مقدم الخدمة');
						this.providerName.set(name);
						const initials = name.split(' ').map((n: string) => n[0] || '').join('').substring(0, 2);
						this.providerInitials.set(initials || 'مـ');
						this.price.set(targetOffer.totalPrice ? `${targetOffer.totalPrice} $` : (targetOffer.bidAmount ? `${targetOffer.bidAmount} $` : 'غير محدد'));
						this.duration.set(targetOffer.deliveryDays ? `${targetOffer.deliveryDays} أيام` : (targetOffer.durationText || 'غير محدد'));
						this.plan.set(targetOffer.outputs || targetOffer.workPlan || '');
						this.description.set(targetOffer.message || targetOffer.description || '');
						
						// Reset initial chat message with correct provider name
						this.chatMessages.set([
							{ text: 'أهلا، أي بند ترغب بتعديله قبل التوقيع؟', isMe: false, sender: name }
						]);
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

	openTerms() {
		this.showTermsModal.set(true);
	}
	
	closeTerms() {
		this.showTermsModal.set(false);
	}

	onTermsInput(event: Event) {
		this.termsInput.set((event.target as HTMLInputElement).value);
	}
	
	onTermsKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			this.sendTermMsg();
		}
	}

	sendTermMsg() {
		const val = this.termsInput().trim();
		if (!val) return;
		this.termsInput.set('');
		this.showToast('تعديل البنود يجب أن يتم عبر غرفة التفاوض قبل اختيار العرض. لا يتم اعتماد موافقات تلقائية.');
	}
	
	approveTerm() {
		this.showAiExtract.set(false);
		this.closeTerms();
		this.showToast('لم يتم تغيير العقد. استخدم غرفة التفاوض لتوثيق أي تعديل جديد.');
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
