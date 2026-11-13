import { Component, DestroyRef, Input, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom, timer, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../environments/environment';
import { mapHttpError } from '../core/forms/http-error';

@Component({
  selector: 'app-infra-actions',
  standalone: true,
  imports: [FormsModule],
  template: ` <section class="ia" dir="rtl">
    @if (kind === 'backups') {
      <h2>إنشاء نسخة أو استردادها</h2>
      <p>الاسترداد ينفذ إلى قاعدة استرداد منفصلة. لا يستبدل قاعدة الموقع الحية.</p>
      <label
        >الإجراء
        <select [(ngModel)]="action" (ngModelChange)="edited()">
          <option value="BACKUP">إنشاء نسخة احتياطية</option>
          <option value="RESTORE">استرداد إلى قاعدة منفصلة</option>
        </select></label
      >
      @if (action === 'RESTORE') {
        <label>اسم الملف من القائمة <input [(ngModel)]="file" (ngModelChange)="edited()" /></label>
      }
    } @else {
      <h2>تنقية كاش روابط الموقع</h2>
      <p>حتى 30 رابط HTTPS على مضيف الموقع الرسمي، رابط في كل سطر. لا تتغير ملفات المصدر.</p>
      <label
        >الروابط <textarea rows="4" [(ngModel)]="files" (ngModelChange)="edited()"></textarea>
      </label>
    }
    <label
      >السبب <textarea rows="2" [(ngModel)]="reason" (ngModelChange)="edited()"></textarea>
    </label>
    <label
      >اكتب «{{ phrase }}» للتأكيد <input [(ngModel)]="confirmation" (ngModelChange)="edited()"
    /></label>
    <button
      type="button"
      [disabled]="busy() || confirmation !== phrase || reason.trim().length < 10"
      (click)="submit()"
    >
      {{ busy() ? 'جارٍ الإرسال…' : 'تنفيذ الإجراء' }}
    </button>
    @if (jobId()) {
      <p>
        رقم المهمة: <span dir="ltr">{{ jobId() }}</span>
      </p>
      <button type="button" [disabled]="busy()" (click)="refreshJob()">تحديث نتيجة المهمة</button>
    }
    @if (message()) {
      <p role="status">{{ message() }}</p>
    }
    @if (error()) {
      <p role="alert">{{ error() }}</p>
    }
  </section>`,
  styles: [
    `
      .ia {
        padding: 16px;
        border: 1px solid var(--ws-border, #aaa);
        border-radius: 14px;
        display: grid;
        gap: 12px;
      }
      .ia h2 {
        font-size: 17px;
        margin: 0;
      }
      .ia p {
        font-size: 13px;
      }
      .ia label {
        display: grid;
        gap: 5px;
      }
      .ia input,
      .ia textarea,
      .ia select {
        padding: 8px;
        background: var(--ws-surface, transparent);
        color: inherit;
        border: 1px solid var(--ws-border, #888);
        border-radius: 8px;
      }
      .ia button {
        justify-self: start;
        padding: 8px 16px;
        border-radius: 8px;
        cursor: pointer;
      }
      .ia [role='alert'] {
        color: #e55;
      }
    `,
  ],
})
export class InfraActionsComponent {
  @Input({ required: true }) kind: 'backups' | 'cdn' = 'backups';
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);
  action = 'BACKUP';
  file = '';
  files = '';
  reason = '';
  confirmation = '';
  private attempt?: { payload: string; key: string };
  readonly busy = signal(false);
  readonly message = signal('');
  readonly error = signal('');
  readonly jobId = signal('');
  private poll?: { unsubscribe(): void };
  private base = `${environment.url_api}/admin/infrastructure`;
  get phrase() {
    return this.kind === 'cdn'
      ? 'أؤكد تنقية الكاش'
      : this.action === 'BACKUP'
        ? 'إنشاء نسخة احتياطية'
        : 'أؤكد الاستعادة إلى قاعدة الاسترداد';
  }
  edited() {
    this.error.set('');
  }
  async submit() {
    if (this.busy() || this.confirmation !== this.phrase || this.reason.trim().length < 10) return;
    const body =
      this.kind === 'cdn'
        ? {
            files: this.files
              .split(/\n/)
              .map((s) => s.trim())
              .filter(Boolean),
            reason: this.reason.trim(),
            confirmation: this.confirmation,
          }
        : {
            action: this.action,
            ...(this.action === 'RESTORE' ? { file: this.file.trim() } : {}),
            reason: this.reason.trim(),
            confirmation: this.confirmation,
          };
    const payload = JSON.stringify(body);
    if (this.attempt?.payload !== payload) this.attempt = { payload, key: crypto.randomUUID() };
    this.busy.set(true);
    this.error.set('');
    try {
      const r = await firstValueFrom(
        this.http
          .post<{ data: any }>(
            `${this.base}/${this.kind === 'cdn' ? 'cdn/purge' : 'backups/jobs'}`,
            body,
            { headers: { 'Idempotency-Key': this.attempt.key } },
          )
          .pipe(takeUntilDestroyed(this.destroyRef)),
      );
      if (this.kind === 'cdn') {
        this.message.set(r.data.note);
        this.confirmation = '';
        this.attempt = undefined;
      } else {
        this.jobId.set(r.data.id);
        this.showJob(r.data);
        this.poll?.unsubscribe();
        if (['QUEUED', 'RUNNING'].includes(r.data.status))
          this.poll = timer(1000, 2000)
            .pipe(
              switchMap(() =>
                this.http.get<{ data: any }>(`${this.base}/backups/jobs/${r.data.id}`),
              ),
              takeUntilDestroyed(this.destroyRef),
            )
            .subscribe({
              next: (r) => this.showJob(r.data),
              error: () => {
                this.error.set('انقطع تحديث المهمة؛ استخدم زر تحديث النتيجة.');
                this.poll?.unsubscribe();
              },
            });
      }
    } catch (e) {
      this.error.set(
        mapHttpError(e, {
          fallback:
            'تعذر تأكيد النتيجة. أعد المحاولة دون تغيير الحقول لاستخدام مفتاح المحاولة نفسه.',
        }).message,
      );
    } finally {
      this.busy.set(false);
    }
  }
  async refreshJob() {
    if (!this.jobId()) return;
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        this.http
          .get<{ data: any }>(`${this.base}/backups/jobs/${this.jobId()}`)
          .pipe(takeUntilDestroyed(this.destroyRef)),
      );
      this.showJob(r.data);
      this.error.set('');
    } catch (e) {
      this.error.set(mapHttpError(e, { fallback: 'تعذر قراءة حالة المهمة.' }).message);
    } finally {
      this.busy.set(false);
    }
  }
  private showJob(j: any) {
    const labels: Record<string, string> = {
      QUEUED: 'في الانتظار',
      RUNNING: 'قيد التنفيذ',
      SUCCEEDED: 'اكتملت',
      FAILED: 'فشلت',
      INTERRUPTED: 'توقفت قبل اكتمالها',
    };
    this.message.set(
      `${labels[j.status] ?? j.status}${j.file ? ' · ' + j.file : ''}${j.status === 'SUCCEEDED' && j.action === 'RESTORE' ? ' · تم الاسترداد إلى القاعدة المنفصلة؛ قاعدة الموقع لم تتغير.' : ''}`,
    );
    if (!['QUEUED', 'RUNNING'].includes(j.status)) {
      this.poll?.unsubscribe();
      this.confirmation = '';
      this.attempt = undefined;
    }
  }
}
