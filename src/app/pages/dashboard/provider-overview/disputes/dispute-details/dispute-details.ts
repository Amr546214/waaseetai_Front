import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { DisputeApiService } from '../../../../../core/services/dispute-api.service';
import { Dispute } from '../disputes.model';
import { mapDispute } from '../disputes.mapper';

@Component({
	selector: 'app-dispute-details',
	standalone: true,
	imports: [CommonModule, RouterLink],
	templateUrl: './dispute-details.html',
	styleUrl: './dispute-details.css'
})
export class DisputeDetails implements OnInit {
	private route = inject(ActivatedRoute);
	private authStore = inject(AuthStore);
	private disputeApi = inject(DisputeApiService);

	isLoading = signal<boolean>(true);
	loadError = signal<boolean>(false);
	dispute = signal<Dispute | null>(null);
	notFound = signal<boolean>(false);

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	// Company mode: sends written guidance to the assigned team member. No
	// backend "dispute guidance" endpoint exists yet — this just confirms via
	// toast, matching the pattern used on the disputes list page.
	guidanceOpen = signal<boolean>(false);
	guidanceText = signal<string>('');
	toastMsg = signal<string>('');

	openGuidance() {
		this.guidanceText.set('');
		this.guidanceOpen.set(true);
	}

	closeGuidance() {
		this.guidanceOpen.set(false);
	}

	sendGuidance() {
		const name = this.dispute()?.teamMember?.name;
		this.closeGuidance();
		if (!name) return;
		this.toastMsg.set(`تم إرسال التوجيه لـ${name}`);
		setTimeout(() => this.toastMsg.set(''), 3000);
	}

	statusLabel = computed(() => {
		const d = this.dispute();
		if (!d) return '';
		return d.status === 'open' ? 'نشط' : 'مُغلق';
	});

	ngOnInit(): void {
		this.load();
	}

	/** Reads the real dispute from GET /provider/disputes/:id (own disputes only). A 404 means it doesn't exist / isn't yours. */
	load(): void {
		const id = this.route.snapshot.paramMap.get('id');
		this.dispute.set(null);
		this.notFound.set(false);
		this.loadError.set(false);
		if (!id) {
			this.isLoading.set(false);
			this.notFound.set(true);
			return;
		}
		this.isLoading.set(true);
		this.disputeApi.getProviderDispute(id).subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success && res.data) {
					this.dispute.set(mapDispute(res.data, this.authStore.currentUser()?.id));
				} else {
					this.notFound.set(true);
				}
			},
			error: (err) => {
				this.isLoading.set(false);
				if (err?.status === 404 || err?.status === 403) this.notFound.set(true);
				else this.loadError.set(true);
			}
		});
	}

	historyIconPath(type: string): string {
		switch (type) {
			case 'doc': return 'doc';
			case 'chat': return 'chat';
			case 'pending': return 'pending';
			default: return 'open';
		}
	}
}
