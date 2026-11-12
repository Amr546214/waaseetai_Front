import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { AdminOrderControlsApiService, ControlAction, ControlKind, ControlPayload, ControlQuote, ControlsData } from '../../../../core/services/admin-order-controls-api.service';
import { UiNotificationService } from '../../../../core/services/ui-notification.service';
import { formatMoney } from '../../../../core/utils/money.util';
import { mapHttpError } from '../../../../core/forms/http-error';
import { ACTIONS_BY_KIND, ACTION_DEFS, ActionDef, NOOP_CODES, REASON_COPY, controlErrorCopy, effectCopy, reasonCopy } from './order-controls.copy';

const newKey = (): string => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);

/**
 * Unresolved attempts survive navigation (and a destroyed component): the Idempotency-Key of a call whose answer was lost, or that was still in flight when the admin left, stays here, so
 * repeating the SAME payload on the same entity + action sends the SAME key and the server replays the stored result (unsubscribing an HTTP call never rolls the server transaction back).
 * An entry is dropped only when its answer was definite (success or a refusal), or after 30 minutes.
 */
const ATTEMPT_TTL_MS = 30 * 60 * 1000;
const ATTEMPTS = new Map<string, { sig: string; key: string; at: number }>();
export const __resetOrderControlAttempts = (): void => ATTEMPTS.clear();
const attemptFor = (slot: string, sig: string): { sig: string; key: string; at: number } => {
  const now = Date.now(); const cur = ATTEMPTS.get(slot);
  if (cur && cur.sig === sig && now - cur.at < ATTEMPT_TTL_MS) return cur;
  const fresh = { sig, key: newKey(), at: now }; ATTEMPTS.set(slot, fresh); return fresh;
};

/**
 * The admin controls of a request / offer / contract (suspend, resume, cancel, freeze, refund, release). The buttons come from the server's controls read model, so a refused action shows
 * the server's SPECIFIC reason (stable code -> Arabic copy) instead of a generic «غير متاح». Money actions open a confirmation dialog that first loads the QUOTE (amount, beneficiary,
 * commission, effect) and only then lets the admin confirm. Every submit carries an Idempotency-Key (one per distinct attempt: a retry of the same attempt reuses it) and the version the admin
 * saw; the submit button is locked while a call is in flight (no double click). On success the parent reloads its details and the controls reload themselves.
 */
@Component({
  selector: 'sa-order-controls',
  standalone: true,
  imports: [CommonModule],
  styles: [`
    .oc-wrap{display:flex;flex-direction:column;gap:8px}
    .oc-btn{padding:9px 16px;border-radius:9px;font-size:var(--font-size-label);font-weight:700;font-family:inherit;cursor:pointer;border:1px solid transparent;transition:all .15s}
    .oc-btn[disabled]{opacity:.5;cursor:not-allowed}
    .oc-ghost{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.1);color:#A8B2D1}
    .oc-warn{background:rgba(255,140,105,.08);border-color:rgba(255,140,105,.24);color:#FF8C69}
    .oc-danger{background:rgba(255,107,107,.10);border-color:rgba(255,107,107,.28);color:#FF6B6B}
    .oc-note{font-size:var(--font-size-small);color:#A8B2D1;line-height:1.7;margin:0}
    .oc-badge{font-size:var(--font-size-small);padding:6px 10px;border-radius:8px;background:rgba(255,180,0,.10);border:1px solid rgba(255,180,0,.3);color:#FFB400}
    .oc-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;z-index:950}
    .oc-card{background:var(--crd-bg,#0f1530);border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:20px;max-width:520px;width:92%;max-height:90vh;overflow:auto}
    .oc-card h3{margin:0 0 6px;font-size:var(--font-size-body)}
    .oc-table{width:100%;border-collapse:collapse;margin:10px 0;font-size:var(--font-size-small)}
    .oc-table td{padding:6px 4px;border-bottom:1px solid rgba(255,255,255,.08)}
    .oc-table td:last-child{text-align:left;font-weight:700}
    .oc-effects{margin:6px 0 10px;padding-inline-start:18px;font-size:var(--font-size-small);line-height:1.8}
    .oc-error{color:#FF6B6B;font-size:12px}
    .oc-row{display:flex;gap:8px;margin-top:12px}
  `],
  template: `
    <div class="oc-wrap" dir="rtl" data-testid="order-controls">
      @if (forbidden()) { <p class="oc-note" data-testid="oc-forbidden">{{ forbiddenCopy }}</p> }
      @if (loadFailed()) {
        <p class="oc-note" data-testid="oc-load-failed">تعذّر تحميل إجراءات الإدارة لهذا العنصر.
          <button type="button" class="oc-btn oc-ghost" (click)="reload()">إعادة المحاولة</button></p>
      }
      @if (controls(); as c) {
        @if (c.suspended) { <div class="oc-badge" data-testid="oc-suspended">معلّق مؤقتًا{{ c.suspendReason ? ' — ' + c.suspendReason : '' }}</div> }
        @if (c.frozen) { <div class="oc-badge" data-testid="oc-frozen">مجمّد{{ c.freezeReason ? ' — ' + c.freezeReason : '' }}</div> }
        @for (d of visible(); track d.def.action) {
          <button type="button" class="oc-btn" [ngClass]="'oc-' + d.def.tone" [disabled]="!d.state.allowed" [attr.data-action]="d.def.action" (click)="open(d.def)">{{ d.def.label }}</button>
          @if (!d.state.allowed) { <p class="oc-note" [attr.data-reason-code]="d.state.code" data-testid="oc-reason">{{ d.reason }}</p> }
        }
      }
    </div>

    @if (dialog(); as dlg) {
      <div class="oc-overlay" (click)="close()">
        <div class="oc-card" dir="rtl" role="dialog" aria-modal="true" [attr.aria-label]="dlg.title" (click)="$event.stopPropagation()" data-testid="oc-dialog">
          <h3>{{ dlg.title }}</h3>
          <p class="oc-note">{{ dlg.hint }}</p>

          @if (dlg.hasQuote) {
            @if (quoteLoading()) { <p class="oc-note">جارٍ تحميل تفاصيل الأثر المالي...</p> }
            @if (quote(); as q) {
              @if (q.blocked) { <p class="oc-error" data-testid="oc-quote-blocked">{{ blockedCopy(q) }}</p> }
              <table class="oc-table" data-testid="oc-quote">
                @if (q.expectedHeldAmount > 0 || q.escrow) {
                  <tr><td>المبلغ المحتجز في الضمان</td><td>{{ money(q.expectedHeldAmount) }} $</td></tr>
                  <tr><td>يعود إلى رصيد الطالب</td><td>{{ money(q.amounts.refundToClient) }} $</td></tr>
                  <tr><td>يُصرف لمقدم الخدمة (إجمالي)</td><td>{{ money(q.amounts.releaseToProvider) }} $</td></tr>
                  <tr><td>عمولة المنصة@if (q.commission.ratePercent !== null) { ({{ q.commission.ratePercent }}%) }</td><td>{{ money(q.amounts.platformCommission) }} $</td></tr>
                  <tr><td>صافي مقدم الخدمة</td><td>{{ money(q.amounts.providerNet) }} $</td></tr>
                  <tr><td>المستفيد</td><td>{{ beneficiary(q) }}</td></tr>
                } @else {
                  <tr><td>الأثر المالي</td><td>لا يوجد مبلغ محتجز: لن تتحرك أي أموال</td></tr>
                }
                @if (q.offersToClose !== undefined) { <tr><td>عروض ستُغلق</td><td>{{ q.offersToClose }}</td></tr> }
              </table>
              @if (q.commissionImpact; as ci) {
                <p class="oc-note" data-testid="oc-commission-impact">
                  @if (ci.alreadyAccrued.count > 0) { عمولات المسوّقين المستحقة سابقًا على المشروع: {{ money(ci.alreadyAccrued.amount) }} $ ({{ ci.alreadyAccrued.count }}). }
                  @if (ci.clawback) { لا توجد قاعدة معتمدة لاسترجاعها عند الاسترداد أو الإلغاء: لا يُخصم منها شيء. }
                  @if (ci.onThisDecision !== 'NONE') { تُحتسب عمولة المسوّق (إن وُجدت إحالة للطالب) على حصة المقدم المصروفة الآن فقط، لا على ما صُرف سابقًا. }
                </p>
              }
              <div class="oc-note">الأثر:</div>
              <ul class="oc-effects">
                @for (e of q.effects; track e) { @if (effect(e)) { <li>{{ effect(e) }}</li> } }
              </ul>
            }
          }

          <label class="oc-note" for="oc-reason-input">السبب{{ dlg.reasonRequired ? ' (إلزامي، 5 أحرف على الأقل)' : ' (اختياري)' }}</label>
          <textarea id="oc-reason-input" rows="3" maxlength="500" style="width:100%" [value]="reason()" (input)="onReason($any($event.target).value)" aria-label="سبب القرار"></textarea>

          @if (dlg.needsConfirm) {
            <label class="oc-note" style="display:flex;gap:8px;align-items:flex-start;margin-top:8px">
              <input type="checkbox" data-testid="oc-confirm" [checked]="confirmed()" (change)="confirmed.set($any($event.target).checked)" />
              <span>أؤكد أنني راجعت الأثر أعلاه وأوافق على تنفيذ هذا القرار.</span>
            </label>
          }

          @if (versionNote()) {
            <p role="status" class="oc-note" data-testid="oc-version-note">{{ versionNote() }}
              @if (manualRefresh()) { <button type="button" class="oc-btn oc-ghost" data-testid="oc-version-refresh" (click)="refreshNow()">تحديث الآن</button> }
            </p>
          }
          @if (error()) { <p role="alert" class="oc-error" data-testid="oc-error">{{ error() }}</p> }
          @if (unknown()) { <p role="status" class="oc-note" data-testid="oc-unknown">انقطع الاتصال قبل وصول الرد، وقد يكون القرار نُفّذ. الضغط على «{{ dlg.submit }}» مرة أخرى آمن: لن يُنفَّذ مرتين.</p> }
          <div class="oc-row">
            <button type="button" class="oc-btn" [ngClass]="'oc-' + (dlg.tone === 'ghost' ? 'warn' : dlg.tone)" data-testid="oc-submit" [disabled]="!canSubmit()" (click)="submit()">{{ busy() ? 'جارٍ التنفيذ...' : dlg.submit }}</button>
            <button type="button" class="oc-btn oc-ghost" [disabled]="busy()" (click)="close()">إلغاء</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class SaOrderControls implements OnChanges, OnDestroy {
  private api = inject(AdminOrderControlsApiService);
  private notify = inject(UiNotificationService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ required: true }) kind!: ControlKind;
  @Input({ required: true }) id!: string;
  /** limits the buttons to some actions (e.g. the offer page also carries «إلغاء العقد المرتبط»); default = every action of the kind */
  @Input() only: ControlAction[] | null = null;
  /** when the controls of `kind` live on another id (the offer page cancels the LINKED CONTRACT) */
  @Input() extraContractId: string | null = null;
  @Output() changed = new EventEmitter<void>();

  controls = signal<ControlsData | null>(null);
  contractControls = signal<ControlsData | null>(null);
  loadFailed = signal(false);
  forbidden = signal(false);
  readonly forbiddenCopy = REASON_COPY['ADMIN_PERMISSION_DENIED'];
  dialog = signal<ActionDef | null>(null);
  quote = signal<ControlQuote | null>(null);
  /** WHO the loaded preview belongs to: the action + the entity it was requested for. A preview is only ever usable for exactly that operation. */
  private quoteOwner = signal<{ action: ControlAction; targetId: string } | null>(null);
  private controlsSub?: Subscription;
  private contractControlsSub?: Subscription;
  private quoteSub?: Subscription;
  quoteLoading = signal(false);
  reason = signal('');
  confirmed = signal(false);
  busy = signal(false);
  error = signal('');
  unknown = signal(false);
  /** the attempts live in the module-level ATTEMPTS map (see above): a retry of the SAME payload reuses its key, a changed payload gets a new one */
  private epoch = 0;
  private attemptSeq = 0;
  versionNote = signal('');
  manualRefresh = signal(false);
  private autoRefreshes = 0;
  private controlsPending = false;

  visible = computed(() => {
    const out: Array<{ def: ActionDef; state: { allowed: boolean; code: string | null; message: string | null }; reason: string }> = [];
    const list = this.only ?? ACTIONS_BY_KIND[this.kind];
    for (const a of list) {
      const src = (this.kind === 'offer' && a.startsWith('CONTRACT_')) ? this.contractControls() : this.controls();
      const state = src?.actions?.[a];
      if (!state) continue;
      if (!state.allowed && state.code && NOOP_CODES.has(state.code)) continue;
      out.push({ def: ACTION_DEFS[a], state, reason: state.allowed ? '' : reasonCopy(state.code, state.message) });
    }
    return out;
  });

  canSubmit = computed(() => {
    const d = this.dialog();
    if (!d || this.busy() || this.controlsPending) return false;
    if (d.reasonRequired && this.reason().trim().length < 5) return false;
    if (d.needsConfirm && !this.confirmed()) return false;
    if (d.hasQuote) {
      const q = this.quote(); const owner = this.quoteOwner();
      if (!q || q.blocked || this.quoteLoading()) return false;
      // the preview must belong to THIS action on THIS entity and to the CURRENT version of it, never to another operation or a stale state
      if (!owner || owner.action !== d.action || owner.targetId !== this.targetId(d.action)) return false;
      if (q.version !== this.versionOf(d.action)) return false;
    }
    return true;
  });

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['id'] || ch['kind'] || ch['extraContractId']) {
      // another entity (navigation / input change): everything that belonged to the previous one is dropped and its in-flight answers are ignored
      this.cancelAll();
      this.controls.set(null); this.contractControls.set(null); this.dialog.set(null); this.quote.set(null); this.quoteOwner.set(null); this.quoteLoading.set(false);
      this.busy.set(false); this.error.set(''); this.unknown.set(false);
      this.epoch++; this.versionNote.set(''); this.manualRefresh.set(false); this.autoRefreshes = 0; this.controlsPending = false;
      this.reload();
    }
  }

  ngOnDestroy(): void { this.epoch++; this.cancelAll(); }
  private cancelAll(): void { this.controlsSub?.unsubscribe(); this.contractControlsSub?.unsubscribe(); this.quoteSub?.unsubscribe(); }

  reload(): void {
    if (!this.id) return;
    this.loadFailed.set(false); this.forbidden.set(false);
    // only the LATEST request counts: a slower, older answer can never overwrite a newer one (the older subscription is cancelled), and an answer for another entity is ignored
    const kind = this.kind, id = this.id, contractId = this.extraContractId;
    this.controlsSub?.unsubscribe();
    this.controlsSub = this.api.controls(kind, id).subscribe({
      next: (res) => { if (kind !== this.kind || id !== this.id) return; this.controls.set(res?.data?.actions ? res.data : null); this.controlsPending = false; this.checkConsistency(); },
      error: (err) => { if (kind !== this.kind || id !== this.id) return; this.controlsPending = false; this.controls.set(null); if (err?.status === 403) this.forbidden.set(true); else this.loadFailed.set(true); },
    });
    this.contractControlsSub?.unsubscribe();
    if (kind === 'offer' && contractId) {
      this.contractControlsSub = this.api.controls('contract', contractId).subscribe({
        next: (res) => { if (contractId === this.extraContractId) { this.contractControls.set(res?.data?.actions ? res.data : null); this.controlsPending = false; this.checkConsistency(); } },
        error: () => { if (contractId === this.extraContractId) { this.controlsPending = false; this.contractControls.set(null); } },
      });
    }
  }

  private targetId(a: ControlAction): string { return a.startsWith('CONTRACT_') || a.startsWith('ESCROW_') ? (this.kind === 'offer' ? this.extraContractId ?? this.id : this.id) : this.id; }
  private versionOf(a: ControlAction): string { return ((this.kind === 'offer' && a.startsWith('CONTRACT_')) ? this.contractControls() : this.controls())?.version ?? ''; }

  open(def: ActionDef): void {
    if (this.busy()) return; // a call is in flight: the dialog (its action and entity) cannot change under it
    this.quoteSub?.unsubscribe(); // opening another action: the previous preview (and its pending answer) is dropped
    this.versionNote.set(''); this.manualRefresh.set(false); this.autoRefreshes = 0;
    this.dialog.set(def); this.reason.set(''); this.confirmed.set(false); this.error.set(''); this.unknown.set(false); this.quote.set(null); this.quoteOwner.set(null);
    if (def.hasQuote) this.loadQuote(def);
  }
  close(): void { if (!this.busy()) { this.quoteSub?.unsubscribe(); this.dialog.set(null); this.quote.set(null); this.quoteOwner.set(null); this.quoteLoading.set(false); } }

  private loadQuote(def: ActionDef): void {
    const action = def.action, targetId = this.targetId(action);
    // previous data is cleared while loading: a confirmation is impossible until THIS operation's preview has arrived
    this.quoteSub?.unsubscribe();
    this.quote.set(null); this.quoteOwner.set(null); this.quoteLoading.set(true);
    const stillCurrent = () => this.dialog()?.action === action && this.targetId(action) === targetId;
    this.quoteSub = this.api.quote(action, targetId).subscribe({
      next: (res) => { if (!stillCurrent()) return; this.quote.set(res?.data ?? null); this.quoteOwner.set(res?.data ? { action, targetId } : null); this.quoteLoading.set(false); this.checkConsistency(); },
      error: (err) => { if (!stillCurrent()) return; this.quote.set(null); this.quoteOwner.set(null); this.quoteLoading.set(false); this.error.set(controlErrorCopy(err, 'تعذّر تحميل تفاصيل الأثر المالي، لن يُنفَّذ شيء.')); },
    });
  }

  onReason(v: string): void { this.reason.set(v); }

  submit(): void {
    const def = this.dialog();
    if (!def || !this.canSubmit()) return;
    const q = this.quote();
    const body: ControlPayload = { expectedVersion: this.versionOf(def.action) };
    const reason = this.reason().trim();
    if (reason) body.reason = reason;
    if (def.needsConfirm) body.confirm = true;
    if (def.hasQuote && q) {
      if (q.expectedHeldAmount > 0) body.expectedHeldAmount = q.expectedHeldAmount;
    }
    const targetId = this.targetId(def.action), action = def.action, epoch = this.epoch, attemptId = ++this.attemptSeq;
    const slot = `${action}|${targetId}`;
    const attempt = attemptFor(slot, JSON.stringify([action, targetId, body]));
    this.busy.set(true); this.error.set(''); this.unknown.set(false);
    // The reply is bound to ITS context (this component instance's entity epoch + this attempt): when the admin has moved to another entity (or the component is gone) the reply only settles the
    // stored attempt (a definite answer drops it, an unknown one keeps it for a safe replay) and touches no screen state, toast or parent event.
    const live = () => epoch === this.epoch && attemptId === this.attemptSeq;
    this.api.run(action, targetId, body, attempt.key).subscribe({
      next: () => {
        ATTEMPTS.delete(slot);
        if (!live()) return;
        this.busy.set(false); this.dialog.set(null); this.quote.set(null); this.quoteOwner.set(null);
        this.notify.success(def.done);
        this.reload();
        this.changed.emit();
      },
      error: (err) => {
        const unknown = !!mapHttpError(err).outcomeUnknown;
        if (!unknown) ATTEMPTS.delete(slot); // a definite refusal: the key is spent; an unknown outcome keeps it so pressing again is a safe replay
        if (!live()) return;
        this.busy.set(false);
        const code = err?.error?.code;
        this.error.set(controlErrorCopy(err));
        if (unknown) this.unknown.set(true);
        // the screen moved under the admin's feet: refresh controls + preview TOGETHER and require a new confirmation
        if (code === 'STALE_VERSION' || code === 'HELD_BALANCE_CHANGED' || code === 'ESCROW_CHANGED') this.refreshPair('تغيّر العنصر منذ عرضه عليك. حدّثنا البيانات، راجع الأرقام الجديدة ثم أكّد من جديد.');
      },
    });
  }

  /** controls and the preview must describe the SAME version of the entity; when they do not, both are re-fetched together (bounded), the confirmation is cleared and the admin is told why. */
  private checkConsistency(): void {
    const d = this.dialog();
    if (!d || !d.hasQuote || this.quoteLoading() || this.controlsPending) return;
    const q = this.quote(), owner = this.quoteOwner(), cv = this.versionOf(d.action);
    if (!q || !owner || owner.action !== d.action || !cv) return;
    if (q.version === cv) { this.versionNote.set(''); this.manualRefresh.set(false); this.autoRefreshes = 0; return; }
    if (this.autoRefreshes < 2) { this.autoRefreshes++; this.refreshPair('تغيّر العنصر أثناء المراجعة، فجرى تحديث البيانات والمعاينة معًا. راجع الأرقام الجديدة وأكّد من جديد.'); }
    else { this.confirmed.set(false); this.manualRefresh.set(true); this.versionNote.set('ما زالت بيانات العنصر والمعاينة غير متطابقتين (يتغيّر العنصر باستمرار). لا يمكن التأكيد قبل تحديثها: اضغط «تحديث الآن».'); }
  }

  private refreshPair(note: string): void {
    const d = this.dialog();
    this.confirmed.set(false); this.versionNote.set(note); this.manualRefresh.set(false);
    if (!d) { this.reload(); return; }
    this.quoteSub?.unsubscribe(); this.quote.set(null); this.quoteOwner.set(null);
    this.controlsPending = true;
    this.reload();
    if (d.hasQuote && this.dialog()?.action === d.action) this.loadQuote(d);
  }

  refreshNow(): void { this.autoRefreshes = 0; const d = this.dialog(); if (d) this.refreshPair('جارٍ تحديث البيانات والمعاينة معًا. راجع الأرقام وأكّد من جديد.'); }

  money(n: number | null | undefined): string { return formatMoney(n ?? 0, 2); }
  effect(code: string): string { return effectCopy(code); }
  beneficiary(q: ControlQuote): string {
    return q.beneficiary.kind === 'CLIENT' ? `الطالب${q.beneficiary.name ? ' — ' + q.beneficiary.name : ''}` : q.beneficiary.kind === 'PROVIDER' ? `مقدم الخدمة${q.beneficiary.name ? ' — ' + q.beneficiary.name : ''}` : '—';
  }
  blockedCopy(q: ControlQuote): string { return reasonCopy(q.blocked?.code, q.blocked?.message); }
}
