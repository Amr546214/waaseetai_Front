import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import {
  Offer,
  OfferStatus,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_CLASSES,
  OFFERS,
  offerPriceIntel,
} from './sa-offers.data';

type FilterKey = 'all' | OfferStatus;

@Component({
  selector: 'app-sa-offers',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-offers.html',
  styleUrl: './sa-offers.css',
})
export class SaOffers {
  readonly statusLabels: Record<OfferStatus, string> = OFFER_STATUS_LABELS;

  readonly statusClasses: Record<OfferStatus, string> = OFFER_STATUS_CLASSES;

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'بانتظار القرار' },
    { key: 'accepted', label: 'مقبول' },
    { key: 'rejected', label: 'مرفوض' },
    { key: 'flagged', label: 'مشبوه' },
  ];

  items = signal<Offer[]>(OFFERS);

  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  filtered = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.items().filter((o) => {
      const matchesFilter = f === 'all' || o.status === f;
      const matchesSearch = !q || o.provider.toLowerCase().includes(q) || o.request.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.items();
    const c: Record<FilterKey, number> = { all: list.length, pending: 0, accepted: 0, rejected: 0, flagged: 0 };
    for (const o of list) c[o.status]++;
    return c;
  });

  stats = computed(() => {
    const list = this.items();
    const avgRating = list.length ? (list.reduce((s, o) => s + o.rating, 0) / list.length).toFixed(1) : '0.0';
    return {
      total: list.length,
      accepted: list.filter((o) => o.status === 'accepted').length,
      avgRating,
      flagged: list.filter((o) => o.status === 'flagged').length,
    };
  });

  priceIntel(o: Offer): { label: string; cls: string } {
    return offerPriceIntel(o);
  }

  setFilter(f: FilterKey) {
    this.activeFilter.set(f);
  }

  onSearch(value: string) {
    this.searchTerm.set(value);
  }
}
