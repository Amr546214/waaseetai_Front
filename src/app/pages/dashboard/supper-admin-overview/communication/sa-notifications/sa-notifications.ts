import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NotificationTemplates } from './notification-templates';
import { WsDatePipe } from '../../../../../shared/ws-date/ws-date.pipe';
import { AdminNotificationHistoryApi, Category, HistoryCursor, HistoryFilters, HistoryPage, NOTIFICATION_CATEGORIES } from './admin-notification-history.api';

const TYPES: Record<string, string> = {
  PLATFORM_REPORT_DECIDED: 'قرار في بلاغ', GENERAL: 'إشعار عام',
  CHAT: 'رسالة محادثة', NEW_TICKET: 'تذكرة دعم جديدة', NEW_DISPUTE: 'نزاع جديد',
};

@Component({
  selector: 'app-sa-notifications',
  imports: [FormsModule, RouterLink, WsDatePipe, NotificationTemplates],
  templateUrl: './sa-notifications.html',
  styleUrl: './sa-notifications.css',
})
export class SaNotifications implements OnInit {
  private readonly api = inject(AdminNotificationHistoryApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly showTemplates = signal(false);
  readonly categories = NOTIFICATION_CATEGORIES;
  readonly categoryKeys = Object.keys(NOTIFICATION_CATEGORIES) as Category[];
  readonly page = signal<HistoryPage | null>(null);
  readonly pageNumber = signal(1);
  readonly busy = signal(false);
  readonly error = signal('');
  private filters: HistoryFilters = { range: '24h', category: '', read: '' };
  private cursors: (HistoryCursor | null)[] = [null];
  private retryAction = () => this.applyFilters();
  range: HistoryFilters['range'] = '24h';
  category: HistoryFilters['category'] = '';
  read: HistoryFilters['read'] = '';

  ngOnInit() { this.applyFilters(); }

  applyFilters() {
    const filters = { range: this.range, category: this.category, read: this.read };
    this.load(filters, [null]);
  }

  next() {
    const cursor = this.page()?.nextCursor;
    if (cursor) this.load(this.filters, [...this.cursors, cursor]);
  }

  previous() {
    if (this.cursors.length > 1) this.load(this.filters, this.cursors.slice(0, -1));
  }

  retry() { this.retryAction(); }
  typeLabel(type: string) { return Object.hasOwn(TYPES, type) ? TYPES[type] : type; }

  private load(filters: HistoryFilters, cursors: (HistoryCursor | null)[]) {
    if (this.busy()) return;
    this.retryAction = () => this.load(filters, cursors);
    this.busy.set(true);
    this.error.set('');
    this.api.list(filters, cursors.at(-1) ?? null).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => {
        this.filters = filters;
        this.cursors = cursors;
        this.page.set(data);
        this.pageNumber.set(cursors.length);
        this.busy.set(false);
      },
      error: err => {
        this.busy.set(false);
        this.error.set(err.status === 403 ? 'السجل متاح لمدير النظام فقط.' : 'تعذّر تحميل سجل الإشعارات.');
      },
    });
  }
}
