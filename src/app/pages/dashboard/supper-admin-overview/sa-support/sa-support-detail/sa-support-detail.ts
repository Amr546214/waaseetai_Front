import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { CaseAttachments } from '../../../../../shared/case-attachments/case-attachments';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { providerTimeZone } from '../../../../../core/services/provider-prefs.store';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminTicketDetailData, AdminTicketListItem, SupportTicketMessage, TicketApiService, TicketStatus } from '../../../../../core/services/ticket-api.service';
import { AdminOpsApiService, AdminStaffMember } from '../../../../../core/services/admin-ops-api.service';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { handleAdminError, reportAdminProblems, SubmitGuard } from '../../shared/admin-form-report';
import { TICKET_STATUS_LABELS, ticketStatusClass } from '../sa-support';

@Component({
  selector: 'app-sa-support-detail',
  standalone: true,
  imports: [CaseAttachments, CommonModule, RouterLink, FormsModule, WsSelectComponent],
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
  readonly replyFiles = signal<File[]>([]);
  readonly fileError = signal('');
  private replyAttempt?: { text: string; files: File[]; key: string };
  readonly slaLabels = { MET: 'تم الرد في المهلة', LATE: 'تم الرد بعد المهلة', CLOSED: 'أُغلقت قبل الرد', OVERDUE: 'تجاوزت مهلة الرد', PENDING: 'ضمن مهلة الرد' };

  pickReplyFiles(event: Event) {
    const input = event.target as HTMLInputElement;
    const chosen = [...(input.files ?? [])];
    input.value = '';
    const combined = [...this.replyFiles(), ...chosen];
    if (combined.length > 5 || chosen.some(f => !['image/jpeg', 'image/png', 'application/pdf'].includes(f.type) || f.size === 0 || f.size > 10 * 1024 * 1024)) {
      this.fileError.set('ارفع حتى ٥ ملفات JPG أو PNG أو PDF، كل ملف بحد ١٠ ميجابايت.');
      return;
    }
    this.fileError.set('');
    this.replyFiles.set(combined);
  }

  removeReplyFile(index: number) {
    this.replyFiles.update(files => files.filter((_, i) => i !== index));
    this.fileError.set('');
  }
  loading = signal(true);
  notFound = signal(false);
  busy = signal(false);
  data = signal<AdminTicketDetailData | null>(null);
  related = signal<AdminTicketListItem[]>([]);
  staff = signal<AdminStaffMember[]>([]);
  selectedAssigneeId = signal('');
  readonly escalationReason = signal('');
  private readonly adminAccess = inject(AdminAccessService);
  /** reply, status, priority, internal notes and assignment all need support.reply on the server. */
  readonly canReply = computed(() => this.adminAccess.can('support.reply'));
  readonly canEscalate = computed(() => this.adminAccess.can('support.reply') && this.adminAccess.can('tasks.manage'));
  /** The server lets a member hand a ticket to SOMEBODY ELSE only with tasks.manage; taking it for himself needs support.reply only (and the staff list itself needs team.view). */
  staffOptions = computed(() => {
    const self = this.adminAccess.access()?.userId;
    if (this.adminAccess.can('tasks.manage')) return this.staff().map(s => ({ value: s.id, label: s.name }));
    const own = this.staff().find(s => s.id === self);
    return self ? [{ value: self, label: own?.name ? `${own.name} (أنا)` : 'أنا (تكليف لنفسي)' }] : [];
  });
  noteDraft = signal('');
  readonly firstStaffReply = computed(() => {
    const detail = this.data();
    if (!detail) return null;
    const openedAt = Date.parse(detail.ticket.createdAt);
    if (!Number.isFinite(openedAt)) return null;
    let first: { at: string; timestamp: number } | null = null;
    for (const message of detail.messages) {
      if (message.senderId === detail.ticket.userId || !this.isStaff(message)) continue;
      const timestamp = Date.parse(message.createdAt);
      if (Number.isFinite(timestamp) && timestamp >= openedAt && (!first || timestamp < first.timestamp)) {
        first = { at: message.createdAt, timestamp };
      }
    }
    if (!first) return null;
    const minutes = Math.floor((first.timestamp - openedAt) / 60_000);
    return { at: first.at, hours: Math.floor(minutes / 60), minutes: minutes % 60 };
  });
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
      this.replyFiles.set([]);
      this.fileError.set('');
      this.replyAttempt = undefined;
      this.draftReply.set('');
      this.escalationReason.set('');
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
    return new Date(iso).toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: providerTimeZone() });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/support']);
  }

  private fail(err: unknown, fallback: string, resolve: Record<string, string>, show: (m: string) => void) {
    handleAdminError(this.host.nativeElement, err, { fallback, resolve }, show);
  }

  sendReply() {
    if (!this.canReply()) return;
    if (this.busy()) return;
    const text = this.draftReply().trim();
    this.replyError.set('');
    if (!text) { void reportAdminProblems(this.host.nativeElement, [{ field: 'sup-reply', message: 'اكتب نص الرد قبل الإرسال' }]); return; }
    if (!this.guard.enter()) return;
    this.busy.set(true);
    const files = this.replyFiles();
    if (files.length && (this.replyAttempt?.text !== text || this.replyAttempt?.files !== files)) {
      this.replyAttempt = { text, files, key: crypto.randomUUID() };
    }
    const id = this.ticketId();
    const send = files.length ? this.api.adminReply(id, text, undefined, files, this.replyAttempt?.key) : this.api.adminReply(id, text);
    send.subscribe({
      next: (res) => {
        this.guard.release();
        this.busy.set(false);
        if (res.success) {
          this.draftReply.set('');
          this.replyFiles.set([]);
          this.fileError.set('');
          this.replyAttempt = undefined;
          this.notify.success('تم إرسال الرد وإشعار صاحب التذكرة');
          this.load();
        } else {
          this.replyError.set(res.message || 'تعذر إرسال الرد');
        }
      },
      error: (err) => {
        this.guard.release();
        if (!files.length && mapHttpError(err).outcomeUnknown) { this.verifyReplyAfterUncertainFailure(text, err); return; }
        this.busy.set(false);
        this.fail(err, 'تعذر إرسال الرد', { message: 'sup-reply', body: 'sup-reply' }, (m) => this.replyError.set(m));
      },
    });
  }

  /**
   * The reply may have reached the server although the answer was lost (network drop / 5xx): read the ticket before allowing another send, so the
   * customer never gets the same reply twice. The draft stays in the box in every outcome except "it was delivered".
   */
  private verifyReplyAfterUncertainFailure(text: string, err: unknown) {
    this.replyError.set('انقطع الاتصال أثناء الإرسال. نتحقق الآن إن كان الرد وصل قبل السماح بإرساله مجددًا…');
    this.api.adminGetTicket(this.ticketId()).subscribe({
      next: (res) => {
        this.busy.set(false);
        const messages = res.data?.messages ?? [];
        const delivered = messages.some((m) => this.isStaff(m) && m.body.trim() === text && Date.now() - new Date(m.createdAt).getTime() < 5 * 60_000);
        if (res.success && res.data) { this.data.set(res.data); }
        if (delivered) {
          this.draftReply.set('');
          this.replyError.set('');
          this.notify.success('وصل الرد إلى صاحب التذكرة رغم انقطاع الاتصال، ولم يُرسل مرة ثانية');
        } else {
          this.replyError.set('لم يصل الرد. نصّك محفوظ في الصندوق، ويمكنك إرساله مجددًا.');
        }
      },
      error: () => {
        this.busy.set(false);
        this.fail(err, 'تعذر إرسال الرد', { message: 'sup-reply', body: 'sup-reply' }, (m) => this.replyError.set(m));
      },
    });
  }

  setStatus(status: TicketStatus) {
    if (!this.canReply()) return;
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

  escalate() {
    if (!this.canEscalate()) return;
    const assigneeId = this.selectedAssigneeId();
    const reason = this.escalationReason().trim();
    const problems = [
      ...(!assigneeId ? [{ field: 'sup-assignee', message: 'اختر المسؤول الذي سيستلم الحالة' }] : []),
      ...(!reason || reason.length > 1000 ? [{ field: 'sup-escalation-reason', message: 'اكتب سبب التصعيد في حدود ١٠٠٠ حرف' }] : []),
    ];
    if (problems.length) {
      void reportAdminProblems(this.host.nativeElement, problems);
      return;
    }
    const fields = { assigneeId: 'sup-assignee', escalationReason: 'sup-escalation-reason' };
    this.run(() => this.api.adminAssign(this.ticketId(), assigneeId, reason), 'تم تصعيد التذكرة', 'تعذر تصعيد التذكرة', (m) => this.assignError.set(m), fields, () => this.escalationReason.set(''));
  }

  assign() {
    const assigneeId = this.selectedAssigneeId();
    this.assignError.set('');
    if (!this.canReply()) return;
    if (assigneeId && !this.staffOptions().some(o => o.value === assigneeId)) { void reportAdminProblems(this.host.nativeElement, [{ field: 'sup-assignee', message: 'تكليف تذكرة لموظف آخر يحتاج صلاحية توزيع مهام الفريق. يمكنك تكليفها لنفسك.' }]); return; }
    if (!assigneeId) { void reportAdminProblems(this.host.nativeElement, [{ field: 'sup-assignee', message: 'اختر الموظف الذي ستُكلَّف إليه التذكرة' }]); return; }
    this.run(() => this.api.adminAssign(this.ticketId(), assigneeId), 'تم تكليف التذكرة', 'تعذر تكليف التذكرة', (m) => this.assignError.set(m), { assigneeId: 'sup-assignee' });
  }

  setPriority(priority: string) {
    if (!this.canReply()) return;
    if (!priority || this.data()?.ticket.priority === priority) return;
    this.actionError.set('');
    this.run(() => this.api.adminSetPriority(this.ticketId(), priority), `تم تغيير الأولوية إلى: ${priority}`, 'تعذر تغيير الأولوية', (m) => this.actionError.set(m), {});
  }

  addNote() {
    if (!this.canReply()) return;
    if (this.busy()) return;
    const body = this.noteDraft().trim();
    this.noteError.set('');
    if (!body) { void reportAdminProblems(this.host.nativeElement, [{ field: 'sup-note', message: 'اكتب نص الملاحظة الداخلية قبل الإضافة' }]); return; }
    this.run(() => this.api.adminAddNote(this.ticketId(), body), 'تمت إضافة الملاحظة الداخلية', 'تعذر إضافة الملاحظة', (m) => this.noteError.set(m), { body: 'sup-note', note: 'sup-note' }, () => this.noteDraft.set(''));
  }
}
