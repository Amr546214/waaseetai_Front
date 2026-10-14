import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminTicketDetailData, AdminTicketListItem, SupportTicketMessage, TicketApiService, TicketStatus } from '../../../../../core/services/ticket-api.service';
import { AdminOpsApiService, AdminStaffMember } from '../../../../../core/services/admin-ops-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { TICKET_STATUS_LABELS, ticketStatusClass } from '../sa-support';

@Component({
  selector: 'app-sa-support-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, WsSelectComponent],
  templateUrl: './sa-support-detail.html',
  styleUrls: ['../sa-support.css', './sa-support-detail.css'],
})
export class SaSupportDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(TicketApiService);
  private opsApi = inject(AdminOpsApiService);
  private notify = inject(UiNotificationService);

  ticketId = signal('');
  draftReply = signal('');
  loading = signal(true);
  notFound = signal(false);
  busy = signal(false);
  data = signal<AdminTicketDetailData | null>(null);
  related = signal<AdminTicketListItem[]>([]);
  staff = signal<AdminStaffMember[]>([]);
  staffOptions = computed(() => this.staff().map(s => ({ value: s.id, label: s.name })));
  selectedAssigneeId = signal('');
  noteDraft = signal('');
  readonly noSla = 'يتطلب جدولاً لقياس زمن الاستجابة';
  readonly noEscalation = 'غير متوفر حالياً';
  readonly noAttachments = 'المرفقات غير مدعومة في تذاكر الدعم حالياً';
  readonly priorities = ['منخفضة', 'عادية', 'عالية', 'عاجلة'];

  readonly statusLabels = TICKET_STATUS_LABELS;
  readonly statusClass = ticketStatusClass;
  readonly statuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];

  ngOnInit(): void {
    this.opsApi.listStaff().subscribe({
      next: (res) => this.staff.set(res.success && Array.isArray(res.data) ? res.data : []),
      error: () => this.staff.set([]),
    });
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
        if (res.success && res.data) { this.data.set(res.data); this.selectedAssigneeId.set(res.data.assignedTo?.id ?? ''); this.loadRelated(res.data.user?.id); } else this.notFound.set(true);
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
          this.notify.success('تم إرسال الرد وإشعار صاحب التذكرة');
          this.load();
        } else {
          this.notify.error(res.message || 'تعذر إرسال الرد');
        }
      },
      error: (err) => { this.busy.set(false); this.notify.error(err?.error?.message || 'تعذر إرسال الرد'); },
    });
  }

  setStatus(status: TicketStatus) {
    if (this.busy() || this.data()?.ticket.status === status) return;
    this.busy.set(true);
    this.api.adminSetStatus(this.ticketId(), status).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.success) {
          this.notify.success(`تم تغيير الحالة إلى: ${TICKET_STATUS_LABELS[status]}`);
          this.load();
        } else {
          this.notify.error(res.message || 'تعذر تغيير الحالة');
        }
      },
      error: (err) => { this.busy.set(false); this.notify.error(err?.error?.message || 'تعذر تغيير الحالة'); },
    });
  }

  private run(call: () => import('rxjs').Observable<{ success: boolean; message?: string }>, ok: string, fail: string, after?: () => void) {
    if (this.busy()) return;
    this.busy.set(true);
    call().subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.success) { after?.(); this.notify.success(ok); this.load(); } else this.notify.error(res.message || fail);
      },
      error: (err) => { this.busy.set(false); this.notify.error(err?.error?.message || fail); },
    });
  }

  assign() {
    const assigneeId = this.selectedAssigneeId();
    if (!assigneeId) return;
    this.run(() => this.api.adminAssign(this.ticketId(), assigneeId), 'تم تكليف التذكرة', 'تعذر تكليف التذكرة');
  }

  setPriority(priority: string) {
    if (!priority || this.data()?.ticket.priority === priority) return;
    this.run(() => this.api.adminSetPriority(this.ticketId(), priority), `تم تغيير الأولوية إلى: ${priority}`, 'تعذر تغيير الأولوية');
  }

  addNote() {
    const body = this.noteDraft().trim();
    if (!body) return;
    this.run(() => this.api.adminAddNote(this.ticketId(), body), 'تمت إضافة الملاحظة الداخلية', 'تعذر إضافة الملاحظة', () => this.noteDraft.set(''));
  }
}
