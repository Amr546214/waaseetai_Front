import { Component, ChangeDetectionStrategy, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { TicketApiService, SupportTicket, SupportTicketMessage, TicketStatus } from '../../../../../core/services/ticket-api.service';

interface TimelineStep { label: string; state: 'done' | 'active' | 'idle'; }
interface ChatMessage { from: 'me' | 'agent'; name: string; time: string; text: string; }

interface TicketView {
	id: string;
	code: string;
	title: string;
	createdAt: string;
	status: string;
	statusLabel: string;
	category: string;
	priority: string;
	related: string | null;
	companyProject: string | null;
	companyMember: string | null;
	updatedAt: string;
}

const STATUS_LABELS: Record<TicketStatus, string> = {
	OPEN: 'مفتوحة',
	IN_PROGRESS: 'قيد المراجعة',
	AWAITING_CUSTOMER: 'بانتظار ردّك',
	RESOLVED: 'محلولة',
	CLOSED: 'مغلقة',
};

function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function buildTimeline(status: TicketStatus): TimelineStep[] {
	const opened: TimelineStep = { label: 'مفتوحة', state: 'done' };
	const inReview: TimelineStep = {
		label: 'قيد المراجعة',
		state: status === 'RESOLVED' || status === 'CLOSED' ? 'done' : 'active',
	};
	const resolved: TimelineStep = {
		label: 'الحل',
		state: status === 'RESOLVED' || status === 'CLOSED' ? 'done' : 'idle',
	};
	const closed: TimelineStep = { label: 'الإغلاق', state: status === 'CLOSED' ? 'done' : 'idle' };
	return [opened, inReview, resolved, closed];
}

@Component({
	selector: 'app-ticket-detail',
	standalone: true,
	imports: [CommonModule, FormsModule, RouterModule],
	templateUrl: './ticket-detail.html',
	styleUrls: ['./ticket-detail.css'],
	changeDetection: ChangeDetectionStrategy.OnPush
})
export class TicketDetailComponent implements OnInit {
	private route = inject(ActivatedRoute);
	private router = inject(Router);
	private authStore = inject(AuthStore);
	private ticketApi = inject(TicketApiService);

	isCompanyMode = computed(() => this.authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY);

	ticketId = signal<string>('');
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	replyText = signal<string>('');
	toast = signal<string | null>(null);
	sending = signal<boolean>(false);
	closing = signal<boolean>(false);

	private rawTicket = signal<SupportTicket | null>(null);
	ticket = signal<TicketView | null>(null);
	timeline = signal<TimelineStep[]>([]);
	messages = signal<ChatMessage[]>([]);

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id') || '';
		this.ticketId.set(id);
		this.loadTicket(id);
	}

	private mapMessages(raw: SupportTicketMessage[]): ChatMessage[] {
		const currentUserId = this.authStore.currentUser()?.id;
		return raw.map(m => ({
			from: m.senderId === currentUserId ? 'me' : 'agent',
			name: m.senderId === currentUserId ? 'أنت' : (m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : 'فريق الدعم'),
			time: formatTime(m.createdAt),
			text: m.body,
		}));
	}

	loadTicket(id: string) {
		if (!id) { this.hasError.set(true); this.isLoading.set(false); return; }
		this.isLoading.set(true);
		this.hasError.set(false);
		this.ticketApi.getTicket('client', id).subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success && res.data) {
					const t = res.data.ticket;
					this.rawTicket.set(t);
					this.ticket.set({
						id: t.id,
						code: t.ticketNumber,
						title: t.subject,
						createdAt: formatDate(t.createdAt),
						status: t.status,
						statusLabel: STATUS_LABELS[t.status],
						category: t.category,
						priority: t.priority,
						related: t.relatedOrder || null,
						companyProject: t.relatedProject || null,
						companyMember: t.relatedMember || null,
						updatedAt: formatDate(t.updatedAt),
					});
					this.timeline.set(buildTimeline(t.status));
					this.messages.set(this.mapMessages(res.data.messages));
				} else {
					this.hasError.set(true);
				}
			},
			error: () => {
				this.isLoading.set(false);
				this.hasError.set(true);
			}
		});
	}

	retry() { this.loadTicket(this.ticketId()); }

	sendReply() {
		const text = this.replyText().trim();
		if (!text || this.sending()) return;
		this.sending.set(true);
		this.ticketApi.replyToTicket('client', this.ticketId(), text).subscribe({
			next: (res) => {
				this.sending.set(false);
				if (res.success) {
					this.replyText.set('');
					this.showToast('تم إرسال ردّك');
					this.loadTicket(this.ticketId());
				} else {
					this.showToast(res.message || 'تعذر إرسال الرد');
				}
			},
			error: (err) => {
				this.sending.set(false);
				this.showToast(err?.error?.message || 'تعذر إرسال الرد، حاول مرة أخرى');
			}
		});
	}

	closeTicket() {
		if (this.closing()) return;
		this.closing.set(true);
		this.ticketApi.closeTicket('client', this.ticketId()).subscribe({
			next: (res) => {
				this.closing.set(false);
				if (res.success) {
					this.showToast('أُغلقت التذكرة');
					this.loadTicket(this.ticketId());
				} else {
					this.showToast(res.message || 'تعذر إغلاق التذكرة');
				}
			},
			error: (err) => {
				this.closing.set(false);
				this.showToast(err?.error?.message || 'تعذر إغلاق التذكرة، حاول مرة أخرى');
			}
		});
	}

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}

	goBack() { this.router.navigate(['/client-overview/help']); }
}
