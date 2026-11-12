import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { AuthStore } from '../../core/store/auth.store';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-platform-report-button',
  imports: [FormsModule],
  template: `
    @if (targetId() && auth.isAuthenticated()) {
      <button type="button" (click)="open.set(!open())" [disabled]="busy()" [attr.aria-expanded]="open()">إبلاغ</button>
      @if (open()) {
        <form (ngSubmit)="submit()">
          <label>سبب البلاغ
            <textarea name="reason" [(ngModel)]="reason" rows="3" minlength="10" maxlength="2000" required [disabled]="busy()"></textarea>
          </label>
          <button type="submit" [disabled]="busy() || reason.trim().length < 10">إرسال البلاغ</button>
        </form>
      }
      @if (message()) { <p [attr.role]="failed() ? 'alert' : 'status'">{{ message() }}</p> }
    }
  `,
  styles: [` :host { display: block; margin-block: .6rem } form, label { display: grid; gap: .45rem; margin-block: .45rem } textarea, button { font: inherit; color: inherit; background: transparent; border: 1px solid var(--border, #64748b); padding: .35rem .6rem; border-radius: .4rem } button { width: fit-content }`],
})
export class PlatformReportButton {
  readonly targetType = input.required<'ACCOUNT' | 'SERVICE'>();
  readonly targetId = input.required<string | null>();
  readonly auth = inject(AuthStore);
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  readonly open = signal(false);
  readonly busy = signal(false);
  readonly failed = signal(false);
  readonly message = signal('');
  reason = '';

  constructor() {
    effect(() => {
      this.targetId();
      this.open.set(false);
      this.busy.set(false);
      this.message.set('');
      this.reason = '';
    });
  }

  submit() {
    const targetId = this.targetId();
    const reason = this.reason.trim();
    if (!targetId || this.busy() || reason.length < 10 || reason.length > 2000) return;
    this.busy.set(true);
    this.message.set('');
    this.http.post(`${environment.url_api}/reports`, { targetId, targetType: this.targetType(), reason }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        if (targetId !== this.targetId()) return;
        this.busy.set(false);
        this.failed.set(false);
        this.message.set('تم إرسال البلاغ للمراجعة.');
        this.reason = '';
        this.open.set(false);
      },
      error: (e: HttpErrorResponse) => {
        if (targetId !== this.targetId()) return;
        this.busy.set(false);
        this.failed.set(true);
        this.message.set(e.status === 409 ? 'عندك بلاغ مفتوح عن نفس العنصر.' : e.status === 400 && typeof e.error?.message === 'string' ? e.error.message : 'تعذّر إرسال البلاغ. جرّب مرة أخرى.');
      },
    });
  }
}
