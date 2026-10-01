import { Component, computed, signal, ViewChild, ElementRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { OffersService } from '../../../../../core/services/offers.service';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

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
	providerName = signal<string>('');
	price = signal<string>('');
	duration = signal<string>('');
	phases = signal<string>('');
	isLoading = signal<boolean>(true);
	loadError = signal<string | null>(null);

	isAgreed = false;

	showToast = signal<boolean>(false);
	toastMessage = signal<string>('');

	isTermsModalOpen = signal<boolean>(false);

	chatMessages = signal<{ text: string, isMe: boolean }[]>([]);
	termInput = '';

	// Initials of the other contract party, derived from the real name loaded
	// from the offers API (replaces hardcoded "نو" initials).
	counterpartyInitials = computed<string>(() =>
		this.providerName().split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2)
	);

	constructor() {
		const nav = this.router.getCurrentNavigation();
		if (nav?.extras?.state && nav.extras.state['offer']) {
			const offer = nav.extras.state['offer'];
			this.offerTitle.set(offer.title);
			this.offerRef.set(offer.ref);
			this.providerName.set(offer.clientName); // In offers list, the client name is stored, we'll use it as provider name in this view or vice versa
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
				this.providerName.set(item.providerName || item.clientName || this.providerName());
				this.price.set(typeof item.offeredPrice === 'number' ? `${item.offeredPrice.toLocaleString('en-US')} $` : (item.price || this.price()));
				this.duration.set(item.duration || item.offeredDuration || this.duration());
				this.phases.set(item.phases || item.milestones || this.phases());
			},
			error: (err) => {
				this.isLoading.set(false);
				this.loadError.set('تعذر تحميل العقد الحقيقي؛ تم تعطيل التوقيع لحماية حسابك.');
				console.error('Could not load contract details from API.', err);
			}
		});
	}

	displayToast(msg: string) {
		this.toastMessage.set(msg);
		this.showToast.set(true);
		setTimeout(() => {
			this.showToast.set(false);
		}, 3000);
	}

	signContract() {
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
				this.displayToast('تم تأكيد التوقيع وتحديث قاعدة البيانات بنجاح، جاري التوجيه...');
				
				setTimeout(() => {
					this.router.navigate(['/provider-overview/projects/active']);
				}, 1500);
			},
			error: (err) => {
				this.displayToast('حدث خطأ أثناء حفظ العقد في قاعدة البيانات');
				console.error(err);
			}
		});
	}

	openTermsModal() {
		this.isTermsModalOpen.set(true);
	}

	closeTermsModal() {
		this.isTermsModalOpen.set(false);
	}

	onModalClick(event: MouseEvent) {
		// Close modal when clicking outside the content
		if ((event.target as HTMLElement).classList.contains('modal-ov')) {
			this.closeTermsModal();
		}
	}

	sendTermMsg() {
		if (!this.termInput.trim()) return;
		this.termInput = '';
		this.displayToast('لا يمكن تعديل العقد من هذه الشاشة. اطلب التعديل عبر غرفة التفاوض قبل التوقيع.');
	}
}
