import { ActivatedRoute } from '@angular/router';
import { guidedCatalog } from '../../../../core/help/help-guided';
import { Component, ChangeDetectionStrategy, ElementRef, signal, inject, OnInit } from '@angular/core';
import { MarketerLevelTagComponent } from '../../../../shared/levels/marketer-level-tag.component';
import { AssistantStore } from '../../../../core/store/assistant.store';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MarketerOverviewService, MarketerSummary } from '../../../../core/services/marketer-overview.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { TicketApiService, SupportTicket, CreateTicketPayload } from '../../../../core/services/ticket-api.service';
import { TICKET_STATUS_LABELS } from './ticket-detail/ticket-detail';
import { mapHttpError } from '../../../../core/forms/http-error';
import { FieldProblem, reportBackendError, reportProblems, SubmitGuard } from '../../../../shared/forms/form-error-focus';
import { genericBanner } from '../../../../shared/forms/submit-feedback';

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
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private guard = new SubmitGuard();

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
		if (this.isCreatingTicket() || this.guard.busy) return; // prevent double submit

		const subject = this.ticketSubject().trim();
		const description = this.ticketDescription().trim();

		// Mirrors the backend's own validation exactly (support-ticket.dto.ts)
		// so an invalid attempt never reaches the network. Each problem is shown under its own field.
		const problems: FieldProblem[] = [];
		if (subject.length < 5) problems.push({ field: 'marketer-ticket-subject', message: 'عنوان التذكرة قصير جدًا (5 أحرف على الأقل)' });
		if (description.length < 20) problems.push({ field: 'marketer-ticket-description', message: 'الوصف قصير جدًا، أضف تفاصيل أكثر (20 حرفًا على الأقل)' });
		if (problems.length) {
			this.ticketCreateError.set(null);
			void reportProblems(this.host.nativeElement, problems);
			return;
		}

		this.ticketCreateError.set(null);
		if (!this.guard.enter()) return;
		this.isCreatingTicket.set(true);
		const payload: CreateTicketPayload = { subject, category: 'استفسار وسيط تسويقي', description };
		this.ticketApi.createTicket('marketer', payload).subscribe({
			next: (res) => {
				this.guard.release();
				this.isCreatingTicket.set(false);
				if (res.data) this.tickets.update(list => [res.data as SupportTicket, ...list]);
				this.ticketSubject.set('');
				this.ticketDescription.set('');
				this.newTicketFormVisible.set(false);
				this.notify.success(res.message || 'تم فتح تذكرتك بنجاح');
			},
			error: async (err: any) => {
				this.guard.release();
				this.isCreatingTicket.set(false);
				const mapped = mapHttpError(err, { fallback: 'تعذر فتح التذكرة، حاول مجددًا' });
				const gen = genericBanner(mapped);
				if (gen !== null) { this.ticketCreateError.set(gen); return; }
				const res = await reportBackendError(this.host.nativeElement, mapped, { resolve: { subject: 'marketer-ticket-subject', description: 'marketer-ticket-description' } });
				// Only a 400/422 naming a field lands on the field; network / 429 / 5xx stay an honest generic message.
				if (!res.handled) this.ticketCreateError.set(mapped.message);
				// Deliberately NOT cleared on failure — the user shouldn't have
				// to retype everything to fix/retry.
			},
		});
	}

	statusLabel(s: SupportTicket['status']): string { return TICKET_STATUS_LABELS[s] ?? s; }

	// Help pages: Bebo is a guided FAQ navigator (ready choices and answers, no free text, no model call).
	readonly choices = guidedCatalog('marketer');

	openAssistant(): void {
		const q = this.searchQuery().trim();
		this.assistant.openGuided(q || null);
		if (q) this.searchQuery.set('');
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
