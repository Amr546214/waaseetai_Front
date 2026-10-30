import { Component, ElementRef, effect, inject, input, output, signal } from '@angular/core';
import { mapHttpError } from '../../../../core/forms/http-error';
import { clearAllInvalid, reportAdminProblems } from '../shared/admin-form-report';
import { MIN_DECISION_REASON, SpecialtyDecision } from './sa-specialties-accreditation.data';

/**
 * Splits a failed decision request into what goes under the reason box (a 400/422 naming `reason`) and the honest generic
 * banner (everything else: network, 429, 5xx, 403, 409, a 400 without field names).
 */
export function decisionFailure(err: unknown): { banner: string; field: string } {
  const m = mapHttpError(err, { fallback: 'تعذر تنفيذ القرار' });
  const field = m.kind === 'backend-validation' ? (m.fieldErrors['reason'] ?? '') : '';
  return { banner: field ? '' : m.message, field };
}

/** Confirmation modal shared by the list quick actions and the detail page: a decision (either way) needs a written reason. */
@Component({
  selector: 'app-sa-specialty-decision-modal',
  standalone: true,
  template: `
    <div class="sdm-ov" data-testid="decision-modal" (click)="cancel()">
      <div class="sdm-box" dir="rtl" (click)="$event.stopPropagation()">
        <h3 class="sdm-ttl">{{ decision() === 'APPROVED' ? 'تأكيد قبول التخصص' : 'تأكيد رفض التخصص' }}</h3>
        <p class="sdm-sub">{{ summary() }}</p>
        <p class="sdm-note">الاعتماد قرار إداري فردي؛ سيصل السبب المكتوب إلى مقدم الخدمة مع إشعار بالقرار.</p>
        <label class="sdm-lbl" for="sdm-reason">سبب القرار <span class="sdm-req">*</span> ({{ min }} أحرف على الأقل)</label>
        <textarea id="sdm-reason" class="sdm-ta" rows="4" data-testid="decision-reason" [value]="reason()" [disabled]="busy()"
          (input)="reason.set($any($event.target).value)" placeholder="اكتب سبب القبول أو الرفض..."></textarea>
        @if (error()) { <p class="sdm-err" role="alert" data-testid="decision-error">{{ error() }}</p> }
        <div class="sdm-act">
          <button type="button" class="sdm-btn sdm-ghost" [disabled]="busy()" (click)="cancel()">إلغاء</button>
          <button type="button" class="sdm-btn" data-testid="decision-confirm" [class.sdm-ok]="decision() === 'APPROVED'" [class.sdm-no]="decision() === 'REJECTED'"
            [disabled]="busy()" (click)="confirm()">
            {{ busy() ? 'جارٍ الإرسال...' : (decision() === 'APPROVED' ? 'تأكيد القبول' : 'تأكيد الرفض') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sdm-ov { position: fixed; inset: 0; background: rgba(7,13,36,.7); backdrop-filter: blur(6px); z-index: 600; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .sdm-box { background: #0B1437; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 22px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; }
    .sdm-ttl { font-size: var(--font-size-body); color: #fff; margin: 0 0 6px; }
    .sdm-sub { font-size: var(--font-size-label); color: #A8B2D1; margin: 0 0 8px; font-weight: 700; }
    .sdm-note { font-size: var(--font-size-small); color: #6B7699; margin: 0 0 12px; line-height: 1.6; }
    .sdm-lbl { display: block; font-size: var(--font-size-small); font-weight: 700; color: #6B7699; margin-bottom: 6px; }
    .sdm-req { color: #FF8C69; }
    .sdm-ta { width: 100%; box-sizing: border-box; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 9px; padding: 10px 12px; font-size: var(--font-size-label); color: #fff; font-family: inherit; resize: none; outline: none; direction: rtl; }
    .sdm-ta:focus { border-color: #2BD4C7; }
    .sdm-err { font-size: var(--font-size-small); color: #FF8C69; margin: 8px 0 0; }
    .sdm-act { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .sdm-btn { height: 34px; padding: 0 16px; border-radius: 9px; font-size: var(--font-size-small); font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; }
    .sdm-btn:disabled { opacity: .5; cursor: not-allowed; }
    .sdm-ghost { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.10); color: #A8B2D1; }
    .sdm-ok { background: linear-gradient(135deg, rgba(15,169,154,.20), rgba(43,212,199,.15)); border-color: rgba(43,212,199,.35); color: #2BD4C7; }
    .sdm-no { background: rgba(255,140,105,.08); border-color: rgba(255,140,105,.22); color: #FF8C69; }
    :host-context(body.light-theme) .sdm-box, :host-context(body.theme-light) .sdm-box, :host-context(.light-theme) .sdm-box, :host-context(.theme-light) .sdm-box { background: #fff; border-color: #E2E8F0; }
    :host-context(body.light-theme) .sdm-ttl, :host-context(body.theme-light) .sdm-ttl, :host-context(.light-theme) .sdm-ttl, :host-context(.theme-light) .sdm-ttl { color: #1E293B; }
    :host-context(body.light-theme) .sdm-ta, :host-context(body.theme-light) .sdm-ta, :host-context(.light-theme) .sdm-ta, :host-context(.theme-light) .sdm-ta { background: #fff; border-color: #E2E8F0; color: #1E293B; }
  `],
})
export class SaSpecialtyDecisionModal {
  decision = input.required<SpecialtyDecision>();
  /** One line saying which provider / specialty the decision is about. */
  summary = input<string>('');
  busy = input<boolean>(false);
  error = input<string>('');
  /** Server message about the reason itself (400/422 naming `reason`): shown under the box. */
  fieldError = input<string>('');
  confirmed = output<string>();
  cancelled = output<void>();

  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly min = MIN_DECISION_REASON;
  reason = signal('');

  constructor() {
    effect(() => {
      const msg = this.fieldError();
      if (msg) void reportAdminProblems(this.host.nativeElement, [{ field: 'sdm-reason', message: msg }]);
    });
  }

  confirm() {
    const r = this.reason().trim();
    if (this.busy()) return;
    if (r.length < this.min) {
      // Not a silently disabled button: say what is missing, under the reason box, and focus it.
      void reportAdminProblems(this.host.nativeElement, [{ field: 'sdm-reason', message: r ? `سبب القرار قصير جدًا: اكتب ${this.min} أحرف على الأقل` : 'سبب القرار مطلوب' }]);
      return;
    }
    clearAllInvalid(this.host.nativeElement);
    this.confirmed.emit(r);
  }

  cancel() {
    if (this.busy()) return;
    this.cancelled.emit();
  }
}
