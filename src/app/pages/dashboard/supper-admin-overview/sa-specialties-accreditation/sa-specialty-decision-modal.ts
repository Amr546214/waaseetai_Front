import { Component, input, output, signal } from '@angular/core';
import { MIN_DECISION_REASON, SpecialtyDecision } from './sa-specialties-accreditation.data';

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
        @if (error()) { <p class="sdm-err" data-testid="decision-error">{{ error() }}</p> }
        <div class="sdm-act">
          <button type="button" class="sdm-btn sdm-ghost" [disabled]="busy()" (click)="cancel()">إلغاء</button>
          <button type="button" class="sdm-btn" data-testid="decision-confirm" [class.sdm-ok]="decision() === 'APPROVED'" [class.sdm-no]="decision() === 'REJECTED'"
            [disabled]="busy() || reason().trim().length < min" (click)="confirm()">
            {{ busy() ? 'جارٍ الإرسال...' : (decision() === 'APPROVED' ? 'تأكيد القبول' : 'تأكيد الرفض') }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .sdm-ov { position: fixed; inset: 0; background: rgba(7,13,36,.7); backdrop-filter: blur(6px); z-index: 600; display: flex; align-items: center; justify-content: center; padding: 20px; }
    .sdm-box { background: #0B1437; border: 1px solid rgba(255,255,255,.12); border-radius: 18px; padding: 22px; width: 100%; max-width: 460px; max-height: 90vh; overflow-y: auto; }
    .sdm-ttl { font-size: 16px; color: #fff; margin: 0 0 6px; }
    .sdm-sub { font-size: 13px; color: #A8B2D1; margin: 0 0 8px; font-weight: 700; }
    .sdm-note { font-size: 11.5px; color: #6B7699; margin: 0 0 12px; line-height: 1.6; }
    .sdm-lbl { display: block; font-size: 11px; font-weight: 700; color: #6B7699; margin-bottom: 6px; }
    .sdm-req { color: #FF8C69; }
    .sdm-ta { width: 100%; box-sizing: border-box; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.09); border-radius: 9px; padding: 10px 12px; font-size: 13px; color: #fff; font-family: inherit; resize: none; outline: none; direction: rtl; }
    .sdm-ta:focus { border-color: #2BD4C7; }
    .sdm-err { font-size: 12px; color: #FF8C69; margin: 8px 0 0; }
    .sdm-act { display: flex; justify-content: flex-end; gap: 8px; margin-top: 16px; }
    .sdm-btn { height: 34px; padding: 0 16px; border-radius: 9px; font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer; border: 1px solid transparent; }
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
  confirmed = output<string>();
  cancelled = output<void>();

  readonly min = MIN_DECISION_REASON;
  reason = signal('');

  confirm() {
    const r = this.reason().trim();
    if (this.busy() || r.length < this.min) return;
    this.confirmed.emit(r);
  }

  cancel() {
    if (this.busy()) return;
    this.cancelled.emit();
  }
}
