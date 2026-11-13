import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../../../environments/environment';
import { mapHttpError } from '../../../../../core/forms/http-error';
import { InfraPanelComponent } from '../../../../../shared/infra-panel/infra-panel.component';

export const RESTORE_PHRASE = 'أؤكد طلب الاستعادة';
/**
 * النسخ الاحتياطي: the files really present in the configured backup folder (read only). A restore is a REQUEST: SUPER_ADMIN, the exact typed phrase and a reason, recorded in the audit log by the server.
 * Nothing is restored, deleted or changed from this page; the operations team executes it outside the application.
 */
@Component({
  selector: 'app-sa-backups',
  standalone: true,
  imports: [InfraPanelComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <app-infra-panel endpoint="backups" title="النسخ الاحتياطي">
    <section class="rb" dir="rtl" data-testid="restore-request">
      <h2>طلب استعادة (لا يُنفَّذ من التطبيق)</h2>
      <label>اسم ملف النسخة <input type="text" name="file" [ngModel]="file()" (ngModelChange)="file.set($event)" data-testid="rb-file" /></label>
      <label>سبب الاستعادة <textarea rows="2" name="reason" [ngModel]="reason()" (ngModelChange)="reason.set($event)" data-testid="rb-reason"></textarea></label>
      <label>اكتب «{{ phrase }}» للتأكيد <input type="text" name="phrase" [ngModel]="typed()" (ngModelChange)="typed.set($event)" data-testid="rb-phrase" /></label>
      <button type="button" class="rb-btn" data-testid="rb-submit" [disabled]="busy() || !file().trim() || reason().trim().length < 10 || typed().trim() !== phrase" (click)="submit()">تسجيل طلب الاستعادة</button>
      @if (done()) { <p role="status" class="rb-ok" data-testid="rb-done">{{ done() }}</p> }
      @if (error()) { <p role="alert" class="rb-err">{{ error() }}</p> }
    </section>
  </app-infra-panel>`,
  styles: [`.rb{margin-top:18px;padding:16px;border-radius:14px;border:1px solid rgba(255,80,80,.35);display:grid;gap:10px}.rb h2{margin:0;font-size:16px}.rb label{display:grid;gap:4px;font-size:13px}.rb input,.rb textarea{padding:7px 9px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit}.rb-btn{justify-self:start;cursor:pointer;padding:7px 14px;border-radius:8px;border:1px solid rgba(255,80,80,.6);background:rgba(255,80,80,.1);color:inherit}.rb-btn:disabled{opacity:.5;cursor:not-allowed}.rb-ok{color:#2BD4C7}.rb-err{color:#ff6b6b}`],
})
export class SaBackups {
  private readonly http = inject(HttpClient);
  readonly phrase = RESTORE_PHRASE;
  readonly file = signal(''); readonly reason = signal(''); readonly typed = signal(''); readonly busy = signal(false); readonly done = signal(''); readonly error = signal('');
  async submit() {
    this.busy.set(true); this.error.set(''); this.done.set('');
    try {
      const r = await firstValueFrom(this.http.post<{ data: { note: string } }>(`${environment.url_api}/admin/infrastructure/backups/restore-request`, { file: this.file().trim(), reason: this.reason().trim(), confirmation: this.typed().trim() }));
      this.done.set(r.data.note); this.typed.set('');
    } catch (e) { this.error.set(mapHttpError(e, { fallback: 'تعذّر تسجيل الطلب.' }).message); } finally { this.busy.set(false); }
  }
}
