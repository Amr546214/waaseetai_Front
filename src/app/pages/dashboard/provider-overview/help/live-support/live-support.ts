import { Component, ChangeDetectionStrategy, signal, inject, computed, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { SupportTicket, SupportTicketMessage, TicketApiService, TicketStatus } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SubmitGuard, reportProblems } from '../../../../../shared/forms/form-error-focus';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { clearTicketField, reportTicketError, ticketProblems } from '../ticket-form';

const STATUS_LABELS: Record<TicketStatus, string> = {
	OPEN: 'مفتوحة',
	IN_PROGRESS: 'قيد المعالجة',
	AWAITING_CUSTOMER: 'بانتظار ردك',
	RESOLVED: 'تم الحل',
	CLOSED: 'مغلقة'
};

/**
 * Support page backed by the real /provider/tickets endpoints: ticket list, create, detail thread, reply and close.
 * There is no simulated agent: replies appear only when support actually answers the ticket.
 */
@Component({
	selector: 'app-provider-live-support',
	standalone: true,
	imports: [WsDatePipe, CommonModule, FormsModule, RouterModule, WsSelectComponent],
	templateUrl: './live-support.html',
	styleUrls: ['./live-support.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiveSupportComponent implements AfterViewChecked {
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private api = inject(TicketApiService);
	private notify = inject(UiNotificationService);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private createGuard = new SubmitGuard();
	private replyGuard = new SubmitGuard();

	@ViewChild('thread') threadRef?: ElementRef<HTMLDivElement>;
	private shouldScroll = false;

	isCompanyMode = computed<boolean>(() => this.authStore.currentUser()?.accountType === AccountType.PROVIDER_COMPANY);

	categories = ['مشكلة في مبلغ الضمان', 'تسوية رصيد أو سحب', 'مشكلة تقنية', 'استفسار عام'];

	tickets = signal<SupportTicket[]>([]);
	listLoading = signal(true);
	listError = signal('');

	activeTicket = signal<SupportTicket | null>(null);
	messages = signal<SupportTicketMessage[]>([]);
	threadLoading = signal(false);
	threadError = signal('');

	creating = signal(false);
	newSubject = signal('');
	newCategory = signal('');
	newDescription = signal('');

	inputText = signal('');
	busy = signal(false);

	canReply = computed(() => {
		const t = this.activeTicket();
		return !!t && t.status !== 'CLOSED';
	});

	constructor() { this.loadTickets(); }

	statusLabel(s: TicketStatus | undefined): string { return s ? STATUS_LABELS[s] ?? s : '—'; }

	ngAfterViewChecked() {
		if (this.shouldScroll && this.threadRef) {
			const el = this.threadRef.nativeElement;
			el.scrollTop = el.scrollHeight;
			this.shouldScroll = false;
		}
	}

	loadTickets() {
		this.listLoading.set(true);
		this.listError.set('');
		this.api.listTickets('provider').subscribe({
			next: res => { this.tickets.set(res?.data?.items ?? []); this.listLoading.set(false); },
			error: err => { this.listLoading.set(false); this.listError.set(err?.error?.message || 'تعذّر تحميل التذاكر. حاول مرة أخرى'); }
		});
	}

	openTicket(t: SupportTicket) {
		this.creating.set(false);
		this.activeTicket.set(t);
		this.messages.set([]);
		this.threadError.set('');
		this.threadLoading.set(true);
		this.api.getTicket('provider', t.id).subscribe({
			next: res => {
				this.threadLoading.set(false);
				if (res?.data) { this.activeTicket.set(res.data.ticket); this.messages.set(res.data.messages ?? []); this.shouldScroll = true; }
			},
			error: err => { this.threadLoading.set(false); this.threadError.set(err?.error?.message || 'تعذّر تحميل محادثة التذكرة'); }
		});
	}

	startNew() {
		this.activeTicket.set(null);
		this.newSubject.set(''); this.newCategory.set(''); this.newDescription.set('');
		this.creating.set(true);
	}

	/** A typed / picked field loses its error mark (a ws-select raises no input event). */
	edited(name: string) {
		clearTicketField(this.host.nativeElement, name);
	}

	async submitNew(event?: Event) {
		event?.preventDefault();
		if (this.busy() || this.createGuard.busy) return;
		const root = this.host.nativeElement;
		const subject = this.newSubject().trim();
		const category = this.newCategory().trim();
		const description = this.newDescription().trim();
		const problems = ticketProblems(root, { subject, category, description }, ['subject', 'category', 'description']);
		if (problems.length) {
			// The explanation sits at each field; focus goes to the first one.
			await reportProblems(root, problems);
			return;
		}
		if (!this.createGuard.enter()) return;
		this.busy.set(true);
		this.api.createTicket('provider', { subject, category, description }).subscribe({
			next: res => {
				this.busy.set(false);
				this.createGuard.release();
				const t = res?.data;
				if (t) { this.tickets.update(list => [t, ...list]); this.openTicket(t); }
				this.notify.success('تم فتح التذكرة');
			},
			error: err => { this.busy.set(false); this.createGuard.release(); void reportTicketError(root, err, this.notify, 'تعذّر فتح التذكرة. حاول مرة أخرى'); }
		});
	}

	async send(event?: Event) {
		event?.preventDefault();
		const t = this.activeTicket();
		const body = this.inputText().trim();
		if (!t || !this.canReply()) return;
		if (this.busy() || this.replyGuard.busy) return;
		const root = this.host.nativeElement;
		if (!body) {
			await reportProblems(root, [{ field: 'msg', message: 'اكتب ردك قبل الإرسال' }]);
			return;
		}
		if (!this.replyGuard.enter()) return;
		this.busy.set(true);
		this.api.replyToTicket('provider', t.id, body).subscribe({
			next: res => {
				this.busy.set(false);
				this.replyGuard.release();
				if (res?.data) { this.messages.update(m => [...m, res.data!]); this.shouldScroll = true; }
				this.inputText.set('');
			},
			error: err => { this.busy.set(false); this.replyGuard.release(); this.notify.error(mapHttpError(err, { fallback: 'تعذّر إرسال الرد. حاول مرة أخرى' }).message); }
		});
	}

	closeActive() {
		const t = this.activeTicket();
		if (!t) return;
		this.busy.set(true);
		this.api.closeTicket('provider', t.id).subscribe({
			next: res => {
				this.busy.set(false);
				const closed = res?.data ?? { ...t, status: 'CLOSED' as TicketStatus };
				this.activeTicket.set(closed);
				this.tickets.update(list => list.map(x => x.id === closed.id ? { ...x, status: closed.status } : x));
				this.notify.success('تم إغلاق التذكرة');
			},
			error: err => { this.busy.set(false); this.notify.error(err?.error?.message || 'تعذّر إغلاق التذكرة') ; }
		});
	}

	isMine(m: SupportTicketMessage): boolean {
		const t = this.activeTicket();
		return !!t && m.senderId === t.userId;
	}
	senderName(m: SupportTicketMessage): string {
		if (this.isMine(m)) return 'أنت';
		const n = [m.sender?.firstName, m.sender?.lastName].filter(Boolean).join(' ');
		return n || 'فريق الدعم';
	}

	goToHelp() { this.router.navigate(['/provider-overview/help']); }
}
