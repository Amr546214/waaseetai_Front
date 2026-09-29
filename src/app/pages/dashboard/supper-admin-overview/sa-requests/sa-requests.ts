import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  ReqStatus,
  ServiceRequest,
  REQ_STATUS_LABELS,
  REQ_STATUS_CLASSES,
  SERVICE_REQUESTS,
} from './sa-requests.data';

type FilterKey = 'all' | ReqStatus;

@Component({
  selector: 'app-sa-requests',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-requests.html',
  styleUrl: './sa-requests.css',
})
export class SaRequests {
  readonly statusLabels: Record<ReqStatus, string> = REQ_STATUS_LABELS;

  readonly statusClasses: Record<ReqStatus, string> = REQ_STATUS_CLASSES;

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'open', label: 'مفتوح' },
    { key: 'in-progress', label: 'جارٍ' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغى' },
    { key: 'flagged', label: 'مُبلَّغ عنه' },
  ];

  items = signal<ServiceRequest[]>(SERVICE_REQUESTS);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((r) => {
      const matchesFilter = f === 'all' || r.status === f;
      const matchesSearch = !q || r.title.toLowerCase().includes(q) || r.client.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, open: 0, 'in-progress': 0, completed: 0, cancelled: 0, flagged: 0 };
    for (const r of list) c[r.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    return {
      total: list.length,
      open: list.filter((r) => r.status === 'open').length,
      completed: list.filter((r) => r.status === 'completed').length,
      needsReview: list.filter((r) => !r.aiClean).length,
    };
  });

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }
}
