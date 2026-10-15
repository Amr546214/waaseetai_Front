import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminTicketDetailData, AdminTicketListItem, SupportTicketMessage, TicketApiService, TicketStatus } from '../../../../../core/services/ticket-api.service';
import { AdminOpsApiService, AdminStaffMember } from '../../../../../core/services/admin-ops-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { handleAdminError, reportAdminProblems, SubmitGuard } from '../../shared/admin-form-report';
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
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private guard = new SubmitGuard();
  /** Honest generic failures (network / 429 / 5xx / 403 / 409 / non-field 400), next to the control that failed. */
  replyError = signal('');
  noteError = signal('');
  assignError = signal('');
  actionError = signal('');

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

  private fail(err: unknown, fallback: string, resolve: Record<string, string>, show: (m: string) => void) {
    handleAdminError(this.host.nativeElement, err, { fallback, resolve }, show);
  }

  sendReply() {
    if (this.busy()) return;
    const text = this.draftReply().trim();
    this.replyError.set('');
    if (!text) { void reportAdminProblems(this.host.nativeElement, [{ field: 'sup-reply', message: 'اكتب نص الرد قبل الإرسال' }]); return; }
    if (!this.guard.enter()) return;
    this.busy.set(true);
    this.api.adminReply(this.ticketId(), text).subscribe({
      next: (res) => {
        this.guard.release();
        this.busy.set(false);
        if (res.success) {
          this.draftReply.set('');
          this.notify.success('تم إرسال الرد وإشعار صاحب التذكرة');
          this.load();
        } else {
          this.replyError.set(res.message || 'تعذر إرسال الرد');
        }
      },
      error: (err) => { this.guard.release(); this.busy.set(false); this.fail(err, 'تعذر إرسال الرد', { message: 'sup-reply', body: 'sup-reply' }, (m) => this.replyError.set(m)); },
    });
  }

  setStatus(status: TicketStatus) {
    if (this.busy() || this.data()?.ticket.status === status) return;
    if (!this.guard.enter()) return;
    this.actionError.set('');
    this.busy.set(true);
    this.api.adminSetStatus(this.ticketId(), status).subscribe({
      next: (res) => {
        this.guard.release();
        this.busy.set(false);
        if (res.success) {
          this.notify.success(`تم تغيير الحالة إلى: ${TICKET_STATUS_LABELS[status]}`);
          this.load();
        } else {
          this.actionError.set(res.message || 'تعذر تغيير الحالة');
        }
      },
      error: (err) => { this.guard.release(); this.busy.set(false); this.fail(err, 'تعذر تغيير الحالة', {}, (m) => this.actionError.set(m)); },
    });
  }

  private run(call: () => import('rxjs').Observable<{ success: boolean; message?: string }>, ok: string, fail: string, show: (m: string) => void, resolve: Record<string, string>, after?: () => void) {
    if (this.busy() || !this.guard.enter()) return;
    this.busy.set(true);
    call().subscribe({
      next: (res) => {
        this.guard.release();
        this.busy.set(false);
        if (res.success) { after?.(); this.notify.success(ok); this.load(); } else show(res.message || fail);
      },
      error: (err) => { this.guard.release(); this.busy.set(false); this.fail(err, fail, resolve, show); },
    });
  }

  assign() {
    const assigneeId = this.selectedAssigneeId();
    this.assignError.set('');
    if (!assigneeId) { void reportAdminProblems(this.host.nativeElement, [{ field: 'sup-assignee', message: 'اختر الموظف الذي ستُكلَّف إليه التذكرة' }]); return; }
    this.run(() => this.api.adminAssign(this.ticketId(), assigneeId), 'تم تكليف التذكرة', 'تعذر تكليف التذكرة', (m) => this.assignError.set(m), { assigneeId: 'sup-assignee' });
  }

  setPriority(priority: string) {
    if (!priority || this.data()?.ticket.priority === priority) return;
    this.actionError.set('');
    this.run(() => this.api.adminSetPriority(this.ticketId(), priority), `تم تغيير الأولوية إلى: ${priority}`, 'تعذر تغيير الأولوية', (m) => this.actionError.set(m), {});
  }

  addNote() {
    if (this.busy()) return;
    const body = this.noteDraft().trim();
    this.noteError.set('');
    if (!body) { void reportAdminProblems(this.host.nativeElement, [{ field: 'sup-note', message: 'اكتب نص الملاحظة الداخلية قبل الإضافة' }]); return; }
    this.run(() => this.api.adminAddNote(this.ticketId(), body), 'تمت إضافة الملاحظة الداخلية', 'تعذر إضافة الملاحظة', (m) => this.noteError.set(m), { body: 'sup-note', note: 'sup-note' }, () => this.noteDraft.set(''));
  }
}
