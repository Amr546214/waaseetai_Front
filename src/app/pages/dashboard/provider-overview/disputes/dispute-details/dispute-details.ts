import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { DISPUTES_MOCK, Dispute } from '../disputes.mock';

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
		const id = this.route.snapshot.paramMap.get('id');
		// No provider-facing "get dispute by id" backend endpoint exists yet
		// (dispute-api.service.ts only exposes admin-facing reads and
		// createProviderDispute) — look the dispute up from the same shared
		// mock array the list page (disputes.ts) renders from, so the two
		// stay consistent.
		const found = id ? DISPUTES_MOCK.find(d => d.id === id) : null;
		if (found) {
			this.dispute.set(found);
		} else {
			this.notFound.set(true);
		}
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
