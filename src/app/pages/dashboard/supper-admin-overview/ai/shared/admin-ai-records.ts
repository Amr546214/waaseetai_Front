import { CommonModule } from '@angular/common';
import { Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { environment } from '../../../../../../environments/environment';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';

type Kind = 'overview' | 'audit' | 'matching';
interface Data {
  specialtyChecks?: number; recordedErrors?: number; recordedTokens?: number | null; averageLatencyMs?: number | null;
  accreditationChecks?: number; scoredOffers?: number; readAt?: string;
  models?: { version: string; count: number }[];
  count?: number; average?: number | null; min?: number | null; max?: number | null; hasNext?: boolean;
  items?: { id: string; reference?: string; at: string; model?: string | null; tokens?: number | null; latencyMs?: number | null; score?: number | null; requestId?: string | null; projectId?: string | null }[];
}
@Component({
  selector: 'app-admin-ai-records',
  imports: [CommonModule, WsDatePipe],
  templateUrl: './admin-ai-records.html',
  styleUrl: './admin-ai-records.css',
})
export class AdminAiRecords implements OnInit {
  @Input({ required: true }) kind: Kind = 'overview';
  private readonly http = inject(HttpClient);
  private readonly destroyRef = inject(DestroyRef);
  private pending: { unsubscribe(): void } | null = null;
  readonly loading = signal(false);
  readonly error = signal('');
  readonly data = signal<Data | null>(null);
  readonly days = signal(30);
  readonly page = signal(1);
  readonly source = signal<'specialty' | 'accreditation'>('specialty');
  private request = 0;
  readonly titles = { overview: 'لوحة الذكاء الاصطناعي', audit: 'سجل تقييمات الذكاء الاصطناعي', matching: 'درجات المطابقة المحفوظة' };

  ngOnInit() { this.load(); }
  setPeriod(days: number) { this.days.set(days); this.page.set(1); this.load(); }
  setSource(source: 'specialty' | 'accreditation') { this.source.set(source); this.page.set(1); this.load(); }
  go(page: number) { if (page < 1 || page > 10_000 || this.loading()) return; this.page.set(page); this.load(); }
  load() {
    this.pending?.unsubscribe();
    const request = ++this.request;
    this.loading.set(true); this.error.set(''); this.data.set(null);
    this.pending = this.http.get<{ data: Data }>(`${environment.url_api}/admin/ai-console/${this.kind}`, {
      params: { days: this.days(), page: this.page(), source: this.source() },
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: r => { if (request !== this.request) return; this.data.set(r.data); this.loading.set(false); },
      error: () => { if (request !== this.request) return; this.loading.set(false); this.error.set('تعذّر تحميل السجلات. حاول مرة أخرى.'); },
    });
  }
}
