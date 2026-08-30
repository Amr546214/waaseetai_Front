import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountLogsService } from '../../../../../core/services/account-logs.service';

interface AuditListItem {
  id: string; eventType: string; category: string; title: string; summary: string; status: string; statusText?: string;
  source: string; severity: string; occurredAt: string; ipAddress?: string | null; device?: string | null; hasDetails: boolean;
}

@Component({
  selector: 'app-profile-logs', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './logs.html', styleUrl: './logs.css',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class Logs implements OnInit {
  private service = inject(AccountLogsService);
  state = signal<'loading' | 'error' | 'default'>('loading');
  logs = signal<AuditListItem[]>([]);
  counts = signal({ total: 0, pending: 0, approved: 0, rejected: 0, completed: 0 });
  pagination = signal({ page: 1, limit: 20, total: 0, pages: 1 });
  detail = signal<any | null>(null);
  detailLoading = signal(false);
  search = '';
  category = '';
  status = '';
  source = '';
  from = '';
  to = '';
  private searchTimer?: ReturnType<typeof setTimeout>;

  ngOnInit() { this.load(1); }

  load(page = this.pagination().page) {
    this.state.set('loading');
    this.service.getUserLogs({ page, limit: 20, search: this.search.trim(), category: this.category, status: this.status, source: this.source, from: this.from, to: this.to }).subscribe({
      next: response => { this.logs.set(response.data.items || []); this.counts.set(response.data.counts); this.pagination.set(response.data.pagination); this.state.set('default'); },
      error: () => this.state.set('error')
    });
  }

  onSearch() { clearTimeout(this.searchTimer); this.searchTimer = setTimeout(() => this.load(1), 350); }
  resetFilters() { this.search = this.category = this.status = this.source = this.from = this.to = ''; this.load(1); }
  openDetail(item: AuditListItem) {
    this.detailLoading.set(true); this.detail.set({ id: item.id, title: item.title });
    this.service.getUserLog(item.id).subscribe({ next: response => { this.detail.set(response.data); this.detailLoading.set(false); }, error: () => { this.detail.set(null); this.detailLoading.set(false); } });
  }
  closeDetail() { this.detail.set(null); }
  previousPage() { if (this.pagination().page > 1) this.load(this.pagination().page - 1); }
  nextPage() { if (this.pagination().page < this.pagination().pages) this.load(this.pagination().page + 1); }

  statusLabel(status: string) { return ({ IN_REVIEW: 'قيد المراجعة', APPROVED: 'معتمد', REJECTED: 'مرفوض', COMPLETED: 'مكتمل' } as any)[status] || status; }
  sourceLabel(source: string) { return ({ USER: 'المستخدم', AI: 'الذكاء الاصطناعي', ADMIN: 'مراجع بشري', SYSTEM: 'النظام' } as any)[source] || source; }
  categoryLabel(category: string) { return ({ PROFILE_COMPLETION: 'الملف والبيانات', SECURITY_CHANGE: 'الأمان والجلسات', ROLE_ADDITION: 'الأدوار والحسابات', SYSTEM_AUDIT: 'النظام' } as any)[category] || category; }
  eventIcon(eventType: string) { return eventType.includes('SESSION') || eventType.includes('LOGIN') ? '⌁' : eventType.includes('PASSWORD') || eventType.includes('OTP') ? '⌾' : eventType.includes('ROLE') ? '◎' : eventType.includes('REVIEW') ? '✦' : '✓'; }
  formatDate(value: string) { return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  objectEntries(value: unknown) { return value && typeof value === 'object' && !Array.isArray(value) ? Object.entries(value as Record<string, unknown>) : []; }
  displayValue(value: unknown) { if (value === null || value === undefined || value === '') return 'غير محدد'; if (typeof value === 'object') return JSON.stringify(value, null, 2); return String(value); }
}
