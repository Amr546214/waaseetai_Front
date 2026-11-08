import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { environment } from '../../../../../../environments/environment';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

type Draft = { name: string; title: string; message: string };
type Template = Draft & { id: string; version: number; updatedAt: string };
type Page = { page: number; items: Template[]; hasNext: boolean };
const empty = (): Draft => ({ name: '', title: '', message: '' });

@Component({
  selector: 'app-notification-templates',
  imports: [FormsModule, WsDatePipe],
  templateUrl: './notification-templates.html',
  styleUrl: './notification-templates.css',
})
export class NotificationTemplates implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = `${environment.url_api}/admin/notification-templates`;
  private requestedPage = 1;
  readonly page = signal<Page | null>(null);
  readonly editing = signal<Template | null>(null);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly success = signal('');
  draft = empty();

  ngOnInit() { this.load(1); }
  retry() { this.load(this.requestedPage); }
  load(page: number) {
    if (this.loading() || this.saving()) return;
    this.requestedPage = page;
    this.loading.set(true);
    this.loadError.set('');
    this.http.get<{ data: Page }>(this.base, { params: { page } }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { this.page.set(data); this.loading.set(false); },
      error: (err: HttpErrorResponse) => {
        this.loading.set(false);
        this.loadError.set(err.status === 403 ? 'القوالب متاحة لمدير النظام فقط.' : 'تعذّر تحميل القوالب.');
      },
    });
  }

  edit(t: Template | null) {
    if (this.saving()) return;
    this.editing.set(t);
    this.draft = t ? { name: t.name, title: t.title, message: t.message } : empty();
    this.saveError.set('');
    this.success.set('');
  }

  save() {
    if (this.saving() || this.loading()) return;
    const data = { name: this.draft.name.trim(), title: this.draft.title.trim(), message: this.draft.message.trim() };
    this.success.set('');
    if (!data.name || !data.title || !data.message || data.name.length > 80 || data.title.length > 150 || data.message.length > 2000) {
      this.saveError.set('اكتب اسم القالب والعنوان والنص ضمن الحدود الموضحة.');
      return;
    }
    this.saveError.set('');
    this.saving.set(true);
    const item = this.editing();
    const request = item
      ? this.http.patch<{ data: Template }>(`${this.base}/${encodeURIComponent(item.id)}`, { ...data, version: item.version })
      : this.http.post<{ data: Template }>(this.base, data);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data: saved }) => {
        this.saving.set(false);
        this.edit(saved);
        this.success.set('تم حفظ القالب.');
        this.load(1);
      },
      error: (err: HttpErrorResponse) => {
        this.saving.set(false);
        this.saveError.set(err.status === 409 && typeof err.error?.message === 'string'
          ? err.error.message : 'تعذّر حفظ القالب. حاول مرة أخرى.');
        if (err.status === 409 && err.error?.code === 'NOTIFICATION_TEMPLATE_CHANGED') this.load(this.requestedPage);
      },
    });
  }
}
