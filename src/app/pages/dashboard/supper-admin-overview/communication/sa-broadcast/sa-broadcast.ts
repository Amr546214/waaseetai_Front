import { HttpClient } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

const AUDIENCES = [
  { value: 'CLIENTS', label: 'طالبي الخدمة' },
  { value: 'PROVIDERS', label: 'مقدمي الخدمة' },
  { value: 'MARKETERS', label: 'المسوّقين' },
] as const;
type Audience = typeof AUDIENCES[number]['value'];
type Preview = { audience: Audience; count: number; checkedAt: string };
type Template = { id: string; name: string; title: string; message: string };
type TemplatePage = { page: number; items: Template[]; hasNext: boolean };

@Component({
  selector: 'app-sa-broadcast',
  imports: [FormsModule, RouterLink, WsDatePipe],
  templateUrl: './sa-broadcast.html',
  styleUrl: './sa-broadcast.css',
})
export class SaBroadcast implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private readonly base = `${environment.url_api}/admin`;
  readonly audiences = AUDIENCES;
  readonly audience = signal<Audience | ''>('');
  readonly preview = signal<Preview | null>(null);
  readonly counting = signal(false);
  readonly countError = signal('');
  readonly templates = signal<TemplatePage | null>(null);
  readonly templatesLoading = signal(false);
  readonly templatesError = signal('');
  private templatePage = 1;
  selectedTemplateId = '';
  title = '';
  message = '';

  ngOnInit() { this.loadTemplates(1); }

  setAudience(value: Audience | '') {
    if (this.counting()) return;
    this.audience.set(value);
    this.preview.set(null);
    this.countError.set('');
  }

  countAudience() {
    const audience = this.audience();
    if (!audience || this.counting()) return;
    this.preview.set(null);
    this.countError.set('');
    this.counting.set(true);
    this.http.get<{ data: Preview }>(`${this.base}/broadcast-preview`, { params: { audience } })
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: ({ data }) => { this.preview.set(data); this.counting.set(false); },
        error: () => { this.counting.set(false); this.countError.set('تعذّر حساب الجمهور. حاول مرة أخرى.'); },
      });
  }

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
    if (item) { this.title = item.title; this.message = item.message; }
  }
}
