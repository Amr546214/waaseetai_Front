import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SUPPORT_TICKETS, Ticket, TicketStatus } from './sa-support.data';

type FilterKey = 'all' | TicketStatus;

@Component({
  selector: 'app-sa-support',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-support.html',
  styleUrl: './sa-support.css',
})
export class SaSupport {
  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'open', label: 'مفتوح' },
    { key: 'pending', label: 'بانتظار رد المستخدم' },
    { key: 'escalated', label: 'مصعَّد' },
  ];

  // MOCK — see sa-support.data.ts
  tickets = signal<Ticket[]>(SUPPORT_TICKETS);

  filteredTickets = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.tickets().filter((t) => {
      const matchesFilter = f === 'all' || t.status === f;
      const matchesSearch = !q || t.id.toLowerCase().includes(q) || t.user.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.tickets();
    return {
      all: list.length,
      open: list.filter((t) => t.status === 'open').length,
      pending: list.filter((t) => t.status === 'pending').length,
      escalated: list.filter((t) => t.status === 'escalated').length,
      resolved: list.filter((t) => t.status === 'resolved').length,
    };
  });

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
  }
}
