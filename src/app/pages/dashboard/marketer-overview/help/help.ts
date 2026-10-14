import { ActivatedRoute } from '@angular/router';
import { guidedCatalog } from '../../../../core/help/help-guided';
import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { AssistantStore } from '../../../../core/store/assistant.store';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { TicketApiService, SupportTicket, CreateTicketPayload } from '../../../../core/services/ticket-api.service';
import { TICKET_STATUS_LABELS } from './ticket-detail/ticket-detail';

@Component({
	selector: 'app-marketer-help',
	standalone: true,
	imports: [MarketerLevelTagComponent, CommonModule, FormsModule, RouterModule],
	templateUrl: './help.html',
	styleUrl: './help.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Help implements OnInit {
	readonly assistant = inject(AssistantStore);
	private overviewService = inject(MarketerOverviewService);
	private ticketApi = inject(TicketApiService);
	private notify = inject(UiNotificationService);
	private route = inject(ActivatedRoute, { optional: true });

	summary = signal<MarketerSummary | null>(null);

	searchQuery = signal<string>('');
	searchedQuery = signal<string>('');

	faqState = signal<boolean[]>([false, false, false, false, false]);

	// --- Real, authenticated support tickets ---
	// The marketer's own ticket routes (/marketer-overview/tickets, open only while acting as the marketer) over the shared ticket system:
	// the list here, the thread (team replies visible, reply, close) on help/tickets/:id. There is no live-support promise anywhere on this page.
	tickets = signal<SupportTicket[]>([]);
	ticketsLoading = signal(false);
	ticketsError = signal<string | null>(null);

	newTicketFormVisible = signal(false);
	ticketSubject = signal('');
	ticketDescription = signal('');
	isCreatingTicket = signal(false);
	ticketCreateError = signal<string | null>(null);

	ngOnInit(): void {
		// Bebo's "open a support ticket" choice lands here with ?ticket=1: show the new-ticket form and bring it into view.
		this.route?.queryParamMap.subscribe((q) => {
			if (q.get('ticket') !== '1') return;
			this.newTicketFormVisible.set(true);
			setTimeout(() => document.getElementById('marketer-ticket-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 0);
		});
		this.overviewService.getSummary().subscribe(res => {
			if (res.success) this.summary.set(res.data);
		});
		this.loadTickets();
	}

	loadTickets(): void {
		this.ticketsLoading.set(true);
		this.ticketsError.set(null);
		this.ticketApi.listTickets('marketer').subscribe({
			next: (res) => {
				this.tickets.set(res.data?.items ?? []);
				this.ticketsLoading.set(false);
			},
			error: () => {
				this.ticketsError.set('تعذر تحميل تذاكر الدعم');
				this.ticketsLoading.set(false);
			},
		});
	}

	toggleNewTicketForm(): void {
		this.newTicketFormVisible.update(v => !v);
		if (!this.newTicketFormVisible()) {
			this.ticketSubject.set('');
			this.ticketDescription.set('');
			this.ticketCreateError.set(null);
		}
	}

	submitTicket(): void {
		if (this.isCreatingTicket()) return; // prevent double submit

		const subject = this.ticketSubject().trim();
		const description = this.ticketDescription().trim();

		// Mirrors the backend's own validation exactly (support-ticket.dto.ts)
		// so an invalid attempt never reaches the network.
		if (subject.length < 5) {
			this.ticketCreateError.set('عنوان التذكرة قصير جدًا (5 أحرف على الأقل)');
			return;
		}
		if (description.length < 20) {
			this.ticketCreateError.set('الوصف قصير جدًا، أضف تفاصيل أكثر (20 حرفًا على الأقل)');
			return;
		}

		this.ticketCreateError.set(null);
		this.isCreatingTicket.set(true);
		const payload: CreateTicketPayload = { subject, category: 'استفسار وسيط تسويقي', description };
		this.ticketApi.createTicket('marketer', payload).subscribe({
			next: (res) => {
				this.isCreatingTicket.set(false);
				if (res.data) this.tickets.update(list => [res.data as SupportTicket, ...list]);
				this.ticketSubject.set('');
				this.ticketDescription.set('');
				this.newTicketFormVisible.set(false);
				this.notify.success(res.message || 'تم فتح تذكرتك بنجاح');
			},
			error: (err: any) => {
				this.isCreatingTicket.set(false);
				this.ticketCreateError.set(err?.error?.message || 'تعذر فتح التذكرة، حاول مجددًا');
				// Deliberately NOT cleared on failure — the user shouldn't have
				// to retype everything to fix/retry.
			},
		});
	}

	statusLabel(s: SupportTicket['status']): string { return TICKET_STATUS_LABELS[s] ?? s; }

	// Help pages: Bebo is a guided FAQ navigator (ready choices and answers, no free text, no model call).
	readonly choices = guidedCatalog('marketer');

	openAssistant(): void {
		this.assistant.openGuided();
	}

	askGuided(id: string): void {
		this.assistant.openGuided(id);
	}

	toggleFaq(index: number): void {
		const state = [...this.faqState()];
		state[index] = !state[index];
		this.faqState.set(state);
	}
}
