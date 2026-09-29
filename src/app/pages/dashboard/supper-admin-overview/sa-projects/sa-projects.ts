import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  FilterKey,
  Project,
  PROJECTS,
  PROJECT_RISK_CLASSES,
  PROJECT_RISK_LABELS,
  PROJECT_STATUS_CLASSES,
  PROJECT_STATUS_LABELS,
} from './sa-projects.data';

@Component({
  selector: 'app-sa-projects',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-projects.html',
  styleUrl: './sa-projects.css',
})
export class SaProjects {
  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly statusClasses = PROJECT_STATUS_CLASSES;
  readonly riskLabels = PROJECT_RISK_LABELS;
  readonly riskClasses = PROJECT_RISK_CLASSES;

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'جارٍ' },
    { key: 'review', label: 'مراجعة التسليم' },
    { key: 'late', label: 'متأخر' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغى' },
  ];

  items = signal<Project[]>(PROJECTS);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((p) => {
      const matchesFilter = f === 'all' || p.status === f;
      const matchesSearch = !q || p.title.toLowerCase().includes(q) || p.client.toLowerCase().includes(q) || p.provider.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, active: 0, review: 0, late: 0, completed: 0, cancelled: 0 };
    for (const p of list) c[p.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    return {
      active: list.filter((p) => p.status === 'active').length,
      completed: list.filter((p) => p.status === 'completed').length,
      late: list.filter((p) => p.status === 'late').length,
      activeValue: list.filter((p) => p.status === 'active' || p.status === 'late').reduce((s, p) => s + p.escrowTotal, 0),
    };
  });

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }
}
