import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminTicketDetailData, AdminTicketListItem, SupportTicketMessage, TicketApiService, TicketStatus } from '../../../../../core/services/ticket-api.service';
import { TICKET_STATUS_LABELS, ticketStatusClass } from '../sa-support';

@Component({
  selector: 'app-sa-support-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-support-detail.html',
  styleUrls: ['../sa-support.css', './sa-support-detail.css'],
})
export class SaSupportDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(TicketApiService);

  toast = signal('');
  ticketId = signal('');
  draftReply = signal('');
  loading = signal(true);
  notFound = signal(false);
  busy = signal(false);
  data = signal<AdminTicketDetailData | null>(null);
  related = signal<AdminTicketListItem[]>([]);
  readonly noBackend = 'يتطلب تفعيل الحفظ في الخادم';

  readonly statusLabels = TICKET_STATUS_LABELS;
  readonly statusClass = ticketStatusClass;
  readonly statuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.ticketId.set(params.get('id') ?? '');
      this.draftReply.set('');
      this.load();
    });
  }

  load() {
    const id = this.ticketId();
    if (!id) { this.notFound.set(true); this.loading.set(false); return; }
    this.loading.set(true);
    this.notFound.set(false);
    this.api.adminGetTicket(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res.success && res.data) { this.data.set(res.data); this.loadRelated(res.data.user?.id); } else this.notFound.set(true);
      },
      error: () => { this.loading.set(false); this.notFound.set(true); },
    });
  }

  // Related tickets = the same user's other tickets, from the existing userId filter.
  private loadRelated(userId?: string) {
    if (!userId) { this.related.set([]); return; }
    this.api.adminListTickets({ userId }).subscribe({
      next: (res) => this.related.set((res.data?.items ?? []).filter(t => t.id !== this.ticketId())),
      error: () => this.related.set([]),
    });
  }

  isStaff(m: SupportTicketMessage): boolean {
    return m.sender?.accountType === 'ADMIN' || m.sender?.accountType === 'SUPER_ADMIN';
  }

  senderName(m: SupportTicketMessage): string {
    return this.isStaff(m) ? 'فريق الدعم' : (m.sender ? `${m.sender.firstName} ${m.sender.lastName}` : '—');
  }

  userName(): string {
    const u = this.data()?.user;
    return u ? `${u.firstName} ${u.lastName}`.trim() : '—';
  }

  formatTime(iso: string): string {
    return new Date(iso).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/support']);
  }

  sendReply() {
    const text = this.draftReply().trim();
    if (!text || this.busy()) return;
    this.busy.set(true);
    this.api.adminReply(this.ticketId(), text).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.success) {
          this.draftReply.set('');
          this.showToast('تم إرسال الرد وإشعار صاحب التذكرة');
          this.load();
        } else {
          this.showToast(res.message || 'تعذر إرسال الرد');
        }
      },
      error: (err) => { this.busy.set(false); this.showToast(err?.error?.message || 'تعذر إرسال الرد'); },
    });
  }

  setStatus(status: TicketStatus) {
    if (this.busy() || this.data()?.ticket.status === status) return;
    this.busy.set(true);
    this.api.adminSetStatus(this.ticketId(), status).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.success) {
          this.showToast(`تم تغيير الحالة إلى: ${TICKET_STATUS_LABELS[status]}`);
          this.load();
        } else {
          this.showToast(res.message || 'تعذر تغيير الحالة');
        }
      },
      error: (err) => { this.busy.set(false); this.showToast(err?.error?.message || 'تعذر تغيير الحالة'); },
    });
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
