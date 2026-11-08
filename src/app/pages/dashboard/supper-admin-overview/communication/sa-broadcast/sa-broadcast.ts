import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { ConfirmModalService } from '../../../../../core/services/confirm-modal.service';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

const AUDIENCES = [
  { value: 'CLIENTS', label: 'طالبي الخدمة' },
  { value: 'PROVIDERS', label: 'مقدمي الخدمة' },
  { value: 'MARKETERS', label: 'المسوّقين' },
] as const;
const CATEGORIES = [
  { value: 'ALL', label: 'عام' },
  { value: 'OFFERS', label: 'العروض' },
  { value: 'PROJECTS', label: 'المشاريع' },
  { value: 'FINANCIAL', label: 'المالية' },
  { value: 'AI', label: 'الذكاء الاصطناعي' },
] as const;
const STATUS_LABELS: Record<string, string> = { QUEUED: 'في قائمة الانتظار', SENDING: 'جارٍ الإرسال', PARTIAL: 'اكتمل جزئيًا', COMPLETED: 'اكتمل', FAILED: 'فشل' };
export type Audience = typeof AUDIENCES[number]['value'];
export type Category = typeof CATEGORIES[number]['value'];
export type Draft = { id: string; title: string; message: string; category: Category; audience: Audience | null; version: number; updatedAt: string };
export type Preview = { deliveryEnabled?: boolean; draftId: string; version: number; audience: Audience; count: number; checkedAt: string; canSend: boolean; previewToken: string };
export type Totals = { audience: number; sent: number; failed: number; pending: number };
export type BroadcastView = { id: string; sender: { id: string; name: string }; title: string; category: Category; audience: Audience; status: string; totals: Totals; createdAt: string; completedAt: string | null; lastProgressAt: string | null };
export type BroadcastDetail = BroadcastView & { message: string; failureCodes: { code: string; count: number }[] };
type Template = { id: string; name: string; title: string; message: string };
type TemplatePage = { page: number; items: Template[]; hasNext: boolean };
type HistoryPage = { page: number; items: BroadcastView[]; hasNext: boolean };
type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const errorBody = (e: unknown) => (e instanceof HttpErrorResponse ? e.error : null) as { code?: string; data?: { current?: Draft } } | null;
const newKey = () => `bc-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

@Component({
  selector: 'app-sa-broadcast',
  imports: [FormsModule, RouterLink, WsDatePipe],
  templateUrl: './sa-broadcast.html',
  styleUrl: './sa-broadcast.css',
})
export class SaBroadcast implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly confirmModal = inject(ConfirmModalService);
  private readonly base = `${environment.url_api}/admin`;
  private readonly api = `${this.base}/broadcasts`;
  /** debounce before an edit is saved to the server draft */
  autosaveMs = 1500;
  readonly audiences = AUDIENCES;
  readonly categories = CATEGORIES;
  readonly draftLoading = signal(true);
  readonly draft = signal<Draft | null>(null);
  readonly saveState = signal<SaveState>('idle');
  readonly savedAt = signal<string | null>(null);
  readonly saveError = signal('');
  /** the newer server copy when another tab/session wrote first */
  readonly conflict = signal<Draft | null>(null);
  readonly preview = signal<Preview | null>(null);
  readonly previewStale = signal('');
  readonly previewing = signal(false);
  readonly previewError = signal('');
  /** null = not known yet (never blocks); false = the server will refuse confirm/retry on this environment */
  readonly deliveryEnabled = signal<boolean | null>(null);
  readonly deliveryOffText = 'الإرسال الجماعي غير مفعّل في هذه البيئة، لذلك زر الإرسال وإعادة إرسال المتبقي معطّلان ولن يُنشأ أي إرسال. الحفظ والمعاينة وسجل البث تعمل كالمعتاد، وتبقى المسودة جاهزة للإرسال عند التفعيل.';
  readonly sending = signal(false);
  readonly sendError = signal('');
  readonly result = signal<BroadcastView | null>(null);
  readonly retrying = signal(false);
  readonly history = signal<HistoryPage | null>(null);
  readonly historyError = signal('');
  readonly detail = signal<BroadcastDetail | null>(null);
  readonly detailError = signal('');
  readonly templates = signal<TemplatePage | null>(null);
  readonly templatesLoading = signal(false);
  readonly templatesError = signal('');
  private templatePage = 1;
  /** polling period for a running broadcast (never below 3 s in production) */
  pollMs = 3000;
  private poller: ReturnType<typeof setInterval> | null = null;
  private polling = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<boolean> | null = null;
  private dirty = false;
  /** one key per confirm attempt; reused when the same attempt is retried after a network failure */
  private attemptKey: string | null = null;
  selectedTemplateId = '';
  title = '';
  message = '';
  category: Category = 'ALL';
  audience: Audience | '' = '';

  constructor() { this.destroyRef.onDestroy(() => { this.clearTimer(); this.stopPolling(); }); }

  ngOnInit() {
    this.loadTemplates(1);
    this.loadHistory(1);
    this.http.get<{ data: { deliveryEnabled: boolean } }>(`${this.api}/status`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => this.deliveryEnabled.set(data.deliveryEnabled), error: () => undefined,
    });
    // a refresh while a broadcast is queued or running brings its progress screen back
    this.http.get<{ data: BroadcastView | null }>(`${this.api}/active`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { if (data && !this.result()) { this.result.set(data); this.startPolling(); } }, error: () => undefined,
    });
    this.http.get<{ data: Draft | null }>(`${this.api}/drafts/latest`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { if (data) this.adopt(data); this.draftLoading.set(false); },
      error: () => { this.draftLoading.set(false); this.saveError.set('تعذّر استرجاع المسودة المحفوظة. ما تكتبه الآن سيُحفظ كمسودة جديدة.'); },
    });
  }

  audienceLabel(value: string | null | undefined) { return AUDIENCES.find(a => a.value === value)?.label ?? ''; }
  categoryLabel(value: string | null | undefined) { return CATEGORIES.find(c => c.value === value)?.label ?? ''; }
  statusLabel(value: string) { return STATUS_LABELS[value] ?? value; }

  // ---- draft ---------------------------------------------------------------------------------------------------------------------------------
  private adopt(d: Draft) {
    this.draft.set(d); this.title = d.title; this.message = d.message; this.category = d.category; this.audience = d.audience ?? '';
    this.conflict.set(null); this.dirty = false;
  }
  private fields() { return { title: this.title.trim(), message: this.message.trim(), category: this.category, audience: this.audience || null }; }
  private clearTimer() { if (this.timer) { clearTimeout(this.timer); this.timer = null; } }

  /** every edit: the preview no longer describes what would be sent, and an autosave is scheduled */
  edited() {
    this.dirty = true;
    if (this.preview()) { this.preview.set(null); this.previewStale.set('تغيّرت المسودة بعد المعاينة. اعمل معاينة جديدة قبل الإرسال.'); }
    this.sendError.set('');
    this.clearTimer();
    if (this.conflict()) return;
    this.timer = setTimeout(() => { this.timer = null; void this.save(); }, this.autosaveMs);
  }
  setAudience(value: Audience | '') { this.audience = value; this.edited(); }

  /** Explicit save and autosave. Resolves true when the server holds exactly what is on screen. */
  save(): Promise<boolean> {
    this.clearTimer();
    if (this.conflict()) return Promise.resolve(false);
    if (this.saving) return this.saving.then(() => (this.dirty ? this.save() : true));
    if (!this.dirty && this.draft()) return Promise.resolve(true);
    this.saving = this.doSave().finally(() => { this.saving = null; });
    return this.saving;
  }

  private async doSave(): Promise<boolean> {
    this.saveState.set('saving'); this.saveError.set('');
    const sentFields = this.fields(); this.dirty = false;
    const d = this.draft();
    try {
      const res = d
        ? await firstValueFrom(this.http.patch<{ data: Draft }>(`${this.api}/drafts/${d.id}`, { ...sentFields, version: d.version }))
        : await firstValueFrom(this.http.post<{ data: Draft }>(`${this.api}/drafts`, sentFields));
      this.draft.set(res.data); this.saveState.set('saved'); this.savedAt.set(res.data.updatedAt);
      return true;
    } catch (e) {
      this.dirty = true;
      const body = errorBody(e);
      if (e instanceof HttpErrorResponse && e.status === 409 && body?.code === 'BROADCAST_DRAFT_CHANGED' && body.data?.current) {
        this.conflict.set(body.data.current); this.saveState.set('error');
      } else if (body?.code === 'DRAFT_ALREADY_SENT') {
        this.saveState.set('error'); this.saveError.set('أُرسلت هذه المسودة بالفعل. ابدأ رسالة جديدة.'); this.dirty = false;
      } else { this.saveState.set('error'); this.saveError.set('تعذّر حفظ المسودة. ما كتبته ما زال على الشاشة، حاول مرة أخرى.'); }
      return false;
    }
  }

  /** conflict choice 1: take what the other session saved */
  useServerCopy() { const c = this.conflict(); if (c) { this.adopt(c); this.saveState.set('idle'); this.preview.set(null); } }
  /** conflict choice 2: keep what is on screen and overwrite, knowingly, on top of the newer version */
  keepMine() { const c = this.conflict(); if (!c) return Promise.resolve(false); this.draft.set(c); this.conflict.set(null); this.dirty = true; return this.save(); }

  newMessage() {
    this.clearTimer(); this.stopPolling(); this.draft.set(null); this.result.set(null); this.preview.set(null); this.previewStale.set(''); this.attemptKey = null;
    this.title = ''; this.message = ''; this.category = 'ALL'; this.audience = ''; this.dirty = false; this.saveState.set('idle'); this.savedAt.set(null);
    this.sendError.set(''); this.previewError.set('');
  }

  async discardDraft() {
    const d = this.draft(); if (!d) { this.newMessage(); return; }
    try { await firstValueFrom(this.http.delete(`${this.api}/drafts/${d.id}`, { params: { version: d.version } })); this.newMessage(); }
    catch (e) {
      const body = errorBody(e);
      if (body?.data?.current) this.conflict.set(body.data.current); else this.saveError.set('تعذّر حذف المسودة.');
    }
  }

  // ---- preview -> confirm -> send ------------------------------------------------------------------------------------------------------------
  get canPreview() { return !!this.title.trim() && !!this.message.trim() && !!this.audience && !this.previewing() && !this.sending() && !this.conflict(); }

  async requestPreview() {
    if (!this.canPreview) return;
    this.previewing.set(true); this.previewError.set(''); this.previewStale.set(''); this.sendError.set(''); this.preview.set(null);
    try {
      if (!(await this.save())) { this.previewError.set('احفظ المسودة أولًا ثم أعد المعاينة.'); return; }
      const d = this.draft()!;
      const res = await firstValueFrom(this.http.post<{ data: Preview }>(`${this.api}/drafts/${d.id}/preview`, {}));
      this.preview.set(res.data); this.attemptKey = null; if (typeof res.data.deliveryEnabled === 'boolean') this.deliveryEnabled.set(res.data.deliveryEnabled);
    } catch { this.previewError.set('تعذّر حساب الجمهور. حاول مرة أخرى.'); }
    finally { this.previewing.set(false); }
  }

  get confirmText() {
    const p = this.preview();
    return [
      `العنوان: ${this.title.trim()}`, `النص: ${this.message.trim()}`, `الفئة: ${this.categoryLabel(this.category)}`,
      `الجمهور: ${this.audienceLabel(this.audience)}، عدد المستلمين: ${p?.count ?? 0}`,
      'سيصل كإشعار داخل المنصة فقط (لا بريد ولا رسائل نصية ولا إشعارات دفع)، ولا يمكن التراجع بعد الإرسال.',
    ].join('\n');
  }

  async confirmAndSend() {
    const p = this.preview();
    if (this.sending() || !p || !p.canSend || this.conflict() || this.dirty || this.deliveryEnabled() === false) return;
    this.sending.set(true);
    try {
      const ok = await this.confirmModal.confirm({ title: 'تأكيد إرسال الإشعار الجماعي', type: 'warning', size: 'md', confirmText: 'إرسال الآن', message: this.confirmText });
      if (!ok) return;
      await this.send(p);
    } finally { this.sending.set(false); }
  }

  private async send(p: Preview) {
    const key = (this.attemptKey ??= newKey());
    this.sendError.set('');
    try {
      const res = await firstValueFrom(this.http.post<{ data: { broadcast: BroadcastView } }>(`${this.api}/drafts/${p.draftId}/send`, { previewToken: p.previewToken }, { headers: { 'Idempotency-Key': key } }));
      this.result.set(res.data.broadcast); this.startPolling(); this.preview.set(null); this.attemptKey = null; this.draft.set(null); this.dirty = false; this.loadHistory(1);
    } catch (e) {
      const body = errorBody(e); const status = e instanceof HttpErrorResponse ? e.status : 0;
      if (body?.code === 'BROADCAST_WORKER_DISABLED') { this.attemptKey = null; this.deliveryEnabled.set(false); this.sendError.set(''); }
      else if (body?.code === 'PREVIEW_STALE') {
        this.attemptKey = null; this.preview.set(null);
        this.previewStale.set('تغيّر الجمهور أو المسودة منذ المعاينة، ولم يُرسل شيء. اعمل معاينة جديدة وراجع العدد.');
      } else if (body?.code === 'AUDIENCE_EMPTY') { this.attemptKey = null; this.sendError.set('لا يوجد مستلمون مؤهلون الآن. لم يُرسل شيء.'); this.preview.set(null); }
      else if (body?.code === 'DRAFT_ALREADY_SENT') { this.attemptKey = null; this.sendError.set('أُرسلت هذه المسودة بالفعل. راجع السجل.'); this.preview.set(null); this.loadHistory(1); }
      else if (status === 0 || status >= 500) this.sendError.set('انقطع الاتصال قبل أن نعرف النتيجة. اضغط «إعادة المحاولة» وسنستخدم نفس مفتاح الإرسال فلا يصل الإشعار مرتين.');
      else { this.attemptKey = null; this.sendError.set('تعذّر الإرسال. راجع المعاينة وحاول مرة أخرى.'); }
    }
  }

  /** same attempt, same key: safe after a lost response */
  async retrySend() {
    const p = this.preview();
    if (this.sending() || !p || !this.attemptKey) return;
    this.sending.set(true);
    try { await this.send(p); } finally { this.sending.set(false); }
  }
  get hasPendingAttempt() { return !!this.attemptKey && !!this.sendError(); }

  async retryRemaining() {
    const r = this.result();
    if (this.retrying() || !r || this.deliveryEnabled() === false) return;
    this.retrying.set(true); this.sendError.set('');
    try {
      const res = await firstValueFrom(this.http.post<{ data: BroadcastView }>(`${this.api}/${r.id}/retry`, {}));
      this.result.set(res.data); this.startPolling(); this.loadHistory(1);
    } catch (e) {
      if (errorBody(e)?.code === 'BROADCAST_WORKER_DISABLED') this.deliveryEnabled.set(false);
      else this.sendError.set('تعذّرت إعادة إرسال المتبقي. حاول مرة أخرى.');
    }
    finally { this.retrying.set(false); }
  }

  // ---- live progress -------------------------------------------------------------------------------------------------------------------------
  isRunning(status: string | undefined) { return status === 'QUEUED' || status === 'SENDING'; }
  progressPercent(r: BroadcastView) { return r.totals.audience ? Math.min(100, Math.round(((r.totals.sent + r.totals.failed) / r.totals.audience) * 100)) : 0; }
  startPolling() {
    if (this.poller || !this.isRunning(this.result()?.status)) return;
    this.poller = setInterval(() => { void this.pollOnce(); }, Math.max(3000, this.pollMs));
  }
  stopPolling() { if (this.poller) { clearInterval(this.poller); this.poller = null; } }
  get isPolling() { return !!this.poller; }
  async pollOnce() {
    const r = this.result();
    if (!r || this.polling) return;
    this.polling = true;
    try {
      const res = await firstValueFrom(this.http.get<{ data: BroadcastDetail }>(`${this.api}/${r.id}`));
      const { message: _m, failureCodes: _f, ...view } = res.data;
      this.result.set(view);
      this.history.update(h => h && { ...h, items: h.items.map(i => (i.id === view.id ? view : i)) });
      if (!this.isRunning(view.status)) { this.stopPolling(); this.loadHistory(this.history()?.page ?? 1); }
    } catch { /* keep the last known state; the next tick tries again */ }
    finally { this.polling = false; }
  }

  // ---- history -------------------------------------------------------------------------------------------------------------------------------
  loadHistory(page: number) {
    this.historyError.set('');
    this.http.get<{ data: HistoryPage }>(this.api, { params: { page } }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => this.history.set(data),
      error: () => this.historyError.set('تعذّر تحميل سجل البث.'),
    });
  }
  openDetail(id: string) {
    this.detailError.set(''); this.detail.set(null);
    this.http.get<{ data: BroadcastDetail }>(`${this.api}/${id}`).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => this.detail.set(data), error: () => this.detailError.set('تعذّر تحميل تفاصيل الإرسال.'),
    });
  }
  closeDetail() { this.detail.set(null); }

  // ---- templates -----------------------------------------------------------------------------------------------------------------------------
  loadTemplates(page: number) {
    if (this.templatesLoading()) return;
    this.templatePage = page;
    this.templatesLoading.set(true);
    this.templatesError.set('');
    this.selectedTemplateId = '';
    this.http.get<{ data: TemplatePage }>(`${this.base}/notification-templates`, { params: { page } })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ data }) => { this.templates.set(data); this.templatesLoading.set(false); },
        error: () => { this.templatesLoading.set(false); this.templatesError.set('تعذّر تحميل القوالب. تقدر تكتب الرسالة بنفسك.'); },
      });
  }
  retryTemplates() { this.loadTemplates(this.templatePage); }
  useTemplate() {
    const item = this.templates()?.items.find(t => t.id === this.selectedTemplateId);
    if (item) { this.title = item.title; this.message = item.message; this.edited(); }
  }
}
