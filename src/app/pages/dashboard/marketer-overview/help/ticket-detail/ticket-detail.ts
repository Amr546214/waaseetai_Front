import { Component, ChangeDetectionStrategy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { TicketApiService, SupportTicket, SupportTicketMessage, TicketStatus } from '../../../../../core/services/ticket-api.service';

export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
	OPEN: 'مفتوحة',
	IN_PROGRESS: 'قيد المراجعة',
	AWAITING_CUSTOMER: 'بانتظار ردّك',
	RESOLVED: 'محلولة',
	CLOSED: 'مغلقة',
};

interface ChatMessage { id: string; mine: boolean; name: string; time: string; text: string; }

const formatDateTime = (iso: string) => new Date(iso).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: providerTimeZone() });

/** Marketer ticket page: the real thread (the team's replies are visible), reply and close. Someone else's ticket is a 404 from the server. */
@Component({
	selector: 'app-marketer-ticket-detail',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterLink],
	templateUrl: './ticket-detail.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarketerTicketDetail implements OnInit {
	private route = inject(ActivatedRoute);
	private authStore = inject(AuthStore);
	private api = inject(TicketApiService);

	loading = signal(true);
	notFound = signal(false);
	failed = signal(false);
	ticket = signal<SupportTicket | null>(null);
	messages = signal<ChatMessage[]>([]);
	replyText = signal('');
	sending = signal(false);
	closing = signal(false);
	actionError = signal<string | null>(null);

	statusLabel(s: TicketStatus) { return TICKET_STATUS_LABELS[s]; }
	/** A closed ticket takes no reply. */
	canReply() { const s = this.ticket()?.status; return !!s && s !== 'CLOSED'; }
	createdLabel(iso: string) { return formatDateTime(iso); }

	ngOnInit() { this.load(this.route.snapshot.paramMap.get('id') || ''); }

	private map(raw: SupportTicketMessage[]): ChatMessage[] {
		const me = this.authStore.currentUser()?.id;
		return raw.map(m => ({
			id: m.id,
			mine: m.senderId === me,
			name: m.senderId === me ? 'أنت' : (m.sender && m.sender.accountType !== 'ADMIN' && m.sender.accountType !== 'SUPER_ADMIN' ? `${m.sender.firstName} ${m.sender.lastName}` : 'فريق الدعم'),
			time: formatDateTime(m.createdAt),
			text: m.body,
		}));
	}

	load(id: string) {
		if (!id) { this.notFound.set(true); this.loading.set(false); return; }
		this.loading.set(true); this.notFound.set(false); this.failed.set(false);
		this.api.getTicket('marketer', id).subscribe({
			next: (res) => {
				this.loading.set(false);
				if (res.success && res.data) { this.ticket.set(res.data.ticket); this.messages.set(this.map(res.data.messages)); } else this.failed.set(true);
			},
			error: (err) => { this.loading.set(false); if (err?.status === 404) this.notFound.set(true); else this.failed.set(true); }
		});
	}

	send() {
		const t = this.ticket(); const body = this.replyText().trim();
		if (!t || !body || this.sending() || !this.canReply()) return;
		this.sending.set(true); this.actionError.set(null);
		this.api.replyToTicket('marketer', t.id, body).subscribe({
			next: () => { this.sending.set(false); this.replyText.set(''); this.load(t.id); },
			error: (err) => { this.sending.set(false); this.actionError.set(err?.error?.message || 'تعذر إرسال الرد، حاول مجددًا'); }
		});
	}

	close() {
		const t = this.ticket();
		if (!t || this.closing() || t.status === 'CLOSED') return;
		this.closing.set(true); this.actionError.set(null);
		this.api.closeTicket('marketer', t.id).subscribe({
			next: () => { this.closing.set(false); this.load(t.id); },
			error: (err) => { this.closing.set(false); this.actionError.set(err?.error?.message || 'تعذر إغلاق التذكرة، حاول مجددًا'); }
		});
	}
}
