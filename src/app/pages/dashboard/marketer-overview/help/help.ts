import { Component, ChangeDetectionStrategy, signal, inject, OnInit } from '@angular/core';
import { AssistantStore } from '../../../../core/store/assistant.store';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';
import { TicketApiService, SupportTicket, CreateTicketPayload } from '../../../../core/services/ticket-api.service';

@Component({
	selector: 'app-marketer-help',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './help.html',
	styleUrl: './help.css',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Help implements OnInit {
	readonly assistant = inject(AssistantStore);
	private overviewService = inject(MarketerOverviewService);
	private ticketApi = inject(TicketApiService);

	summary = signal<MarketerSummary | null>(null);

	searchQuery = signal<string>('');
	searchedQuery = signal<string>('');

	toastMessage = signal<string | null>(null);
	faqState = signal<boolean[]>([false, false, false, false, false]);

	// --- Real, authenticated support tickets ---
	// Reuses the existing shared TicketApiService/support-ticket system as-is
	// (no new backend route). Backend-side, ticket create/list/get/reply/close
	// are scoped purely by req.user.id (see support-ticket.controller.ts /
	// client-tickets.routes.ts, which only apply `authenticate` +
	// `requireActiveUser` — no role-specific authorize() gate at all), so
	// calling the existing 'client' base route from here creates a ticket
	// genuinely owned by the marketer's own account, not anyone else's.
	// The full multi-page ticket experience (list/detail/reply/close) that
	// Client/Provider each have is role-coupled (hardcoded 'client'/'provider'
	// literals throughout those components) and out of scope to duplicate
	// here — this is deliberately a smaller, self-contained create+track
	// slice directly on this page instead.
	tickets = signal<SupportTicket[]>([]);
	ticketsLoading = signal(false);
	ticketsError = signal<string | null>(null);

	newTicketFormVisible = signal(false);
	ticketSubject = signal('');
	ticketDescription = signal('');
	isCreatingTicket = signal(false);
	ticketCreateError = signal<string | null>(null);

	ngOnInit(): void {
		this.overviewService.getSummary().subscribe(res => {
			if (res.success) this.summary.set(res.data);
		});
		this.loadTickets();
	}

	loadTickets(): void {
		this.ticketsLoading.set(true);
		this.ticketsError.set(null);
		this.ticketApi.listTickets('client').subscribe({
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
		this.ticketApi.createTicket('client', payload).subscribe({
			next: (res) => {
				this.isCreatingTicket.set(false);
				if (res.data) this.tickets.update(list => [res.data as SupportTicket, ...list]);
				this.ticketSubject.set('');
				this.ticketDescription.set('');
				this.newTicketFormVisible.set(false);
				this.showToast(res.message || 'تم فتح تذكرتك بنجاح');
			},
			error: (err: any) => {
				this.isCreatingTicket.set(false);
				this.ticketCreateError.set(err?.error?.message || 'تعذر فتح التذكرة، حاول مجددًا');
				// Deliberately NOT cleared on failure — the user shouldn't have
				// to retype everything to fix/retry.
			},
		});
	}

	// The help search box now asks the ONE real shared assistant (WaseetAI
	// help via the backend) and shows the streamed answer in the dashboard
	// Avatar panel. The previous client-side keyword match + setTimeout
	// "answer" was removed.
	askAI(): void {
		const q = this.searchQuery().trim();
		if (!q) {
			this.showToast('اكتب سؤالك أولًا');
			return;
		}
		this.searchedQuery.set(q);
		this.assistant.openAndAsk(q);
	}

	fillQ(text: string): void {
		this.searchQuery.set(text);
		this.askAI();
	}

	toggleFaq(index: number): void {
		const state = [...this.faqState()];
		state[index] = !state[index];
		this.faqState.set(state);
	}

	showToast(msg: string): void {
		this.toastMessage.set(msg);
		setTimeout(() => this.toastMessage.set(null), 3000);
	}
}
