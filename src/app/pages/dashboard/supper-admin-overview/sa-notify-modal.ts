
import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
} from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  handleAdminError,
  reportAdminProblems,
  SubmitGuard,
} from './shared/admin-form-report';
import { mapHttpError } from '../../../core/forms/http-error';
import { environment } from '../../../../environments/environment';

/**
 * Confirmation dialog for an admin message to ONE user.
 * POST /admin/users/:id/notify
 *
 * The message is delivered as a notification through the user's
 * saved channels and audit-logged on the account.
 * An optional context ties it to a request or offer.
 */
@Component({
  selector: 'sa-notify-modal',
  standalone: true,

  template: `
    <div
      class="sn-overlay"
      (click)="close()"
    >
      <div
        class="sn-modal"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sn-modal-title"
        (click)="$event.stopPropagation()"
      >

        <div class="sn-header">
          <h3 id="sn-modal-title" class="sn-title">
            إرسال رسالة إلى {{ userName }}
          </h3>

          <button
            type="button"
            class="sn-close"
            aria-label="إغلاق النافذة"
            [disabled]="busy()"
            (click)="close()"
          >
            &times;
          </button>
        </div>

        <p class="sn-description">
          تصل الرسالة كإشعار داخل المنصة
          (وعبر قنوات المستخدم المفعّلة)،
          ويُسجَّل الإرسال في سجل التدقيق.
        </p>

        <div class="sn-field">
          <label class="sn-label" for="sa-notify-message">
            نص الرسالة
          </label>

          <textarea
            id="sa-notify-message"
            class="sn-textarea"
            rows="5"
            maxlength="500"
            placeholder="اكتب الرسالة هنا (5 أحرف على الأقل)"
            [value]="message()"
            (input)="message.set($any($event.target).value)"
          ></textarea>

          <div class="sn-field-footer">
            <span>الحد الأدنى 5 أحرف</span>
            <span>{{ message().length }} / 500</span>
          </div>
        </div>

        @if (error()) {
          <div
            class="sn-alert sn-alert-error"
            role="alert"
            data-testid="notify-error"
          >
            {{ error() }}
          </div>
        }

        @if (unconfirmed()) {
          <div
            class="sn-alert sn-alert-warning"
            role="status"
            data-testid="notify-unconfirmed"
          >
            انقطع الاتصال قبل وصول الرد، فقد تكون الرسالة أُرسلت.
            لتجنّب إرسالها مرتين لا يمكن إعادة الإرسال
            من هذه النافذة.

            تحقق من
            <a
              href="/supper-admin-overview/audit-trail"
              target="_blank"
              rel="noopener"
            >
              سجل التدقيق
            </a>
            ثم أغلق النافذة وافتحها مجددًا إن لم تجد الرسالة.
          </div>
        }

        <div class="sn-actions">
          <button
            type="button"
            class="sn-btn sn-btn-primary"
            data-testid="notify-submit"
            [disabled]="busy() || unconfirmed()"
            (click)="send()"
          >
            {{ busy() ? 'جارٍ الإرسال...' : 'تأكيد الإرسال' }}
          </button>

          <button
            type="button"
            class="sn-btn sn-btn-secondary"
            [disabled]="busy()"
            (click)="close()"
          >
            إلغاء
          </button>
        </div>

      </div>
    </div>
  `,

  styles: [`
    :host {
      display: contents;
    }

    .sn-overlay {
      position: fixed;
      inset: 0;
      z-index: 950;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(4, 8, 25, 0.72);
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
      box-sizing: border-box;
      overflow-y: auto;
    }

    .sn-modal {
      width: 100%;
      max-width: 540px;
      max-height: calc(100dvh - 40px);
      overflow-y: auto;
      box-sizing: border-box;
      padding: 28px;
      border-radius: 18px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: var(--crd-bg, #0f1530);
      color: var(--txt, #f5f7ff);
      box-shadow: 0 24px 70px rgba(0, 0, 0, 0.35);
    }

    .sn-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 14px;
    }

    .sn-title {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.6;
      overflow-wrap: anywhere;
      color: inherit;
    }

    .sn-close {
      flex-shrink: 0;
      width: 34px;
      height: 34px;
      border: 1px solid rgba(150, 165, 200, 0.2);
      border-radius: 10px;
      background: rgba(150, 165, 200, 0.08);
      color: inherit;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
    }

    .sn-close:hover:not(:disabled) {
      background: rgba(150, 165, 200, 0.18);
    }

    .sn-description {
      margin: 0 0 22px;
      font-size: 14px;
      line-height: 1.9;
      color: var(--txt-2, #a8b2d1);
      overflow-wrap: anywhere;
    }

    .sn-field {
      display: flex;
      flex-direction: column;
      gap: 9px;
      min-width: 0;
    }

    .sn-label {
      font-size: 14px;
      font-weight: 700;
      color: inherit;
    }

    .sn-textarea {
      display: block;
      width: 100%;
      min-height: 140px;
      box-sizing: border-box;
      resize: vertical;
      padding: 14px 16px;
      border: 1px solid var(--sec-bd, #45536d);
      border-radius: 12px;
      outline: none;
      background: var(--sec-bg, #101a34);
      color: var(--txt, #f5f7ff);
      font: inherit;
      font-size: 14px;
      line-height: 1.8;
      direction: rtl;
      text-align: right;
      opacity: 1;
    }

    .sn-textarea::placeholder {
      color: var(--txt-3, #8995b4);
      opacity: 1;
    }

    .sn-textarea:focus {
      border-color: #2bd4c7;
      box-shadow: 0 0 0 3px rgba(43, 212, 199, 0.12);
    }

    .sn-field-footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      font-size: 12px;
      color: var(--txt-2, #a8b2d1);
    }

    .sn-alert {
      margin-top: 16px;
      padding: 12px 14px;
      border-radius: 10px;
      font-size: 13px;
      line-height: 1.9;
      overflow-wrap: anywhere;
    }

    .sn-alert-error {
      color: #ff8c8c;
      background: rgba(255, 107, 107, 0.1);
      border: 1px solid rgba(255, 107, 107, 0.25);
    }

    .sn-alert-warning {
      color: #f4ca78;
      background: rgba(244, 202, 120, 0.08);
      border: 1px solid rgba(244, 202, 120, 0.22);
    }

    .sn-alert-warning a {
      color: #2bd4c7;
      text-decoration: underline;
    }

    .sn-actions {
      display: flex;
      justify-content: flex-start;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 24px;
    }

    .sn-btn {
      min-height: 44px;
      padding: 10px 22px;
      border-radius: 11px;
      font: inherit;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.2s ease, opacity 0.2s ease;
    }

    .sn-btn-primary {
      border: none;
      background: linear-gradient(110deg, #2bd4c7, #328dff);
      color: #071329;
    }

    .sn-btn-secondary {
      border: 1px solid rgba(150, 165, 200, 0.3);
      background: rgba(150, 165, 200, 0.08);
      color: inherit;
    }

    .sn-btn:hover:not(:disabled) {
      filter: brightness(1.08);
    }

    .sn-btn:disabled,
    .sn-close:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    /* Light Mode */

    :host-context([data-theme="light"]) .sn-modal {
      background: #ffffff;
      color: #1e293b;
      border-color: #dce3ed;
    }

    :host-context([data-theme="light"]) .sn-description,
    :host-context([data-theme="light"]) .sn-field-footer {
      color: #526078;
    }

    :host-context([data-theme="light"]) .sn-close {
      background: #f8fafc;
      color: #1e293b;
      border-color: #e2e8f0;
    }

    :host-context([data-theme="light"]) .sn-btn-secondary {
      background: #f8fafc;
      color: #1e293b;
      border-color: #cbd5e1;
    }

    /* Light Mode Textarea Fix */

    :host-context([data-theme="light"]) .sn-textarea {
      background: #ffffff !important;
      color: #1e293b !important;
      -webkit-text-fill-color: #1e293b;
      border: 1px solid #cbd5e1 !important;
      opacity: 1;
    }

    :host-context([data-theme="light"]) .sn-textarea::placeholder {
      color: #64748b !important;
      -webkit-text-fill-color: #64748b;
      opacity: 1 !important;
    }

    :host-context([data-theme="light"]) .sn-textarea:focus {
      background: #ffffff !important;
      color: #1e293b !important;
      border-color: #2bd4c7 !important;
      outline: none;
    }

    /* Light Mode Alerts */

    :host-context([data-theme="light"]) .sn-alert-error {
      color: #b42318;
      background: #fff1f0;
      border-color: #f7c4c0;
    }

    :host-context([data-theme="light"]) .sn-alert-warning {
      color: #92400e;
      background: #fffbeb;
      border-color: #fcd34d;
    }

    :host-context([data-theme="light"]) .sn-alert-warning a {
      color: #087f76;
    }

    /* Responsive */

    @media (max-width: 600px) {
      .sn-overlay {
        padding: 12px;
        align-items: center;
      }

      .sn-modal {
        max-height: calc(100dvh - 24px);
        padding: 20px 16px;
        border-radius: 14px;
      }

      .sn-title {
        font-size: 17px;
      }

      .sn-description {
        font-size: 13px;
        margin-bottom: 18px;
      }

      .sn-actions {
        flex-direction: column;
        align-items: stretch;
      }

      .sn-btn {
        width: 100%;
      }
    }

    @media (max-height: 520px) {
      .sn-overlay {
        align-items: flex-start;
      }
    }
  `],
})
export class SaNotifyModal {
  private http = inject(HttpClient);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private guard = new SubmitGuard();

  @Input({ required: true }) userId!: string;
  @Input() userName = 'المستخدم';

  @Input() context: {
    type: 'REQUEST' | 'OFFER';
    id: string;
  } | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<void>();

  message = signal('');
  busy = signal(false);
  error = signal('');

  /**
   * The answer was lost: the message may have been sent.
   * A second send is blocked until the admin closes
   * the dialog and checks the audit log.
   */
  unconfirmed = signal(false);

  close() {
    if (!this.busy()) {
      this.closed.emit();
    }
  }

  send() {
    if (this.busy() || this.unconfirmed()) return;

    this.error.set('');

    const text = this.message().trim();

    if (text.length < 5) {
      void reportAdminProblems(this.host.nativeElement, [
        {
          field: 'sa-notify-message',
          message: text
            ? 'الرسالة قصيرة جدًا: اكتب 5 أحرف على الأقل'
            : 'نص الرسالة مطلوب (5 أحرف على الأقل)',
        },
      ]);
      return;
    }

    if (!this.guard.enter()) return;

    this.busy.set(true);

    this.http.post(
      `${environment.url_api}/admin/users/${this.userId}/notify`,
      {
        message: text,
        ...(this.context ? { context: this.context } : {}),
      }
    ).subscribe({
      next: () => {
        this.guard.release();
        this.busy.set(false);
        this.sent.emit();
      },
      error: (err) => {
        this.guard.release();
        this.busy.set(false);

        if (mapHttpError(err).outcomeUnknown) {
          this.unconfirmed.set(true);
        }

        handleAdminError(
          this.host.nativeElement,
          err,
          {
            fallback: 'تعذر إرسال الرسالة',
            resolve: { message: 'sa-notify-message' },
          },
          (m) => this.error.set(m)
        );
      },
    });
  }
}
