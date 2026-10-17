import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { Component, ChangeDetectionStrategy, ElementRef, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';
import { TicketApiService, SupportTicket, SupportTicketMessage, TicketStatus } from '../../../../../core/services/ticket-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SubmitGuard, reportProblems } from '../../../../../shared/forms/form-error-focus';
import { mapHttpError } from '../../../../../core/forms/http-error';

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
	return new Date(iso).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: providerTimeZone() });
}

function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: providerTimeZone() });
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
	private notify = inject(UiNotificationService);
	private host = inject<ElementRef<HTMLElement>>(ElementRef);
	private replyGuard = new SubmitGuard();

	isCompanyMode = computed<boolean>(() => {
		const user = this.authStore.currentUser();
		return user?.accountType === AccountType.PROVIDER_COMPANY;
	});

	ticketId = signal<string>('');
	isLoading = signal<boolean>(true);
	hasError = signal<boolean>(false);
	replyText = signal<string>('');
	sending = signal<boolean>(false);
	closing = signal<boolean>(false);

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
			name: m.senderId === currentUserId ? 'أنت' : (m.sender && m.sender.accountType !== 'ADMIN' && m.sender.accountType !== 'SUPER_ADMIN' ? `${m.sender.firstName} ${m.sender.lastName}` : 'فريق الدعم'),
			time: formatTime(m.createdAt),
			text: m.body,
		}));
	}

	loadTicket(id: string) {
		if (!id) { this.hasError.set(true); this.isLoading.set(false); return; }
		this.isLoading.set(true);
		this.hasError.set(false);
		this.ticketApi.getTicket('provider', id).subscribe({
			next: (res) => {
				this.isLoading.set(false);
				if (res.success && res.data) {
					const t: SupportTicket = res.data.ticket;
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

	async sendReply() {
		if (this.sending() || this.replyGuard.busy) return;
		const root = this.host.nativeElement;
		const text = this.replyText().trim();
		if (!text) {
			await reportProblems(root, [{ field: 'reply', message: 'اكتب ردّك قبل الإرسال' }]);
			return;
		}
		if (!this.replyGuard.enter()) return;
		this.sending.set(true);
		this.ticketApi.replyToTicket('provider', this.ticketId(), text).subscribe({
			next: (res) => {
				this.sending.set(false);
				this.replyGuard.release();
				if (res.success) {
					this.replyText.set('');
					this.notify.success('تم إرسال ردّك');
					this.loadTicket(this.ticketId());
				} else {
					this.notify.error(res.message || 'تعذر إرسال الرد');
				}
			},
			error: (err) => {
				this.sending.set(false);
				this.replyGuard.release();
				const mapped = mapHttpError(err, { fallback: 'تعذر إرسال الرد، حاول مرة أخرى' });
				// Only a 400/422 that names the reply text is shown at the field; anything else stays a generic message.
				const msg = mapped.kind === 'backend-validation' ? (mapped.fieldErrors['body'] ?? mapped.fieldErrors['message'] ?? mapped.fieldErrors['reply']) : undefined;
				if (msg) void reportProblems(root, [{ field: 'reply', message: msg }]);
				else this.notify.error(mapped.message);
			}
		});
	}

	closeTicket() {
		if (this.closing()) return;
		this.closing.set(true);
		this.ticketApi.closeTicket('provider', this.ticketId()).subscribe({
			next: (res) => {
				this.closing.set(false);
				if (res.success) {
					this.notify.success('أُغلقت التذكرة');
					this.loadTicket(this.ticketId());
				} else {
					this.notify.error(res.message || 'تعذر إغلاق التذكرة');
				}
			},
			error: (err) => {
				this.closing.set(false);
				this.notify.error(err?.error?.message || 'تعذر إغلاق التذكرة، حاول مرة أخرى');
			}
		});
	}

	goBack() {
		this.router.navigate(['/provider-overview/help']);
	}
}
