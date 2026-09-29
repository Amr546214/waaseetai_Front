import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Contract,
  CONTRACTS,
  CONTRACT_ESCROW_CLASSES,
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
  FilterKey,
} from './sa-contracts.data';

@Component({
  selector: 'app-sa-contracts',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-contracts.html',
  styleUrl: './sa-contracts.css',
})
export class SaContracts {
  readonly statusLabels = CONTRACT_STATUS_LABELS;
  readonly statusClasses = CONTRACT_STATUS_CLASSES;
  readonly escrowClasses = CONTRACT_ESCROW_CLASSES;

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'نشط' },
    { key: 'escrow-held', label: 'ضمان محتجز' },
    { key: 'dispute', label: 'متنازع عليه' },
    { key: 'completed', label: 'مكتمل' },
    { key: 'cancelled', label: 'ملغى' },
  ];

  items = signal<Contract[]>(CONTRACTS);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((c) => {
      const matchesFilter = f === 'all' || c.status === f;
      const matchesSearch = !q || c.id.toLowerCase().includes(q) || c.client.toLowerCase().includes(q) || c.provider.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, active: 0, 'escrow-held': 0, dispute: 0, completed: 0, cancelled: 0 };
    for (const item of list) c[item.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    return {
      active: list.filter((c) => c.status === 'active' || c.status === 'escrow-held').length,
      escrowTotal: list.filter((c) => c.escrow === 'محتجز').reduce((s, c) => s + c.valueNum, 0),
      disputes: list.filter((c) => c.status === 'dispute').length,
      completed: list.filter((c) => c.status === 'completed').length,
    };
  });

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }
}
