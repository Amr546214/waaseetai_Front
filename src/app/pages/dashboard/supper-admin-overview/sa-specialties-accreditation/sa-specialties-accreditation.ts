import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ACCREDITATION_REQUESTS, AI_REC_LABELS, AccreditationRequest, ReqStatus } from './sa-specialties-accreditation.data';

type FilterKey = 'all' | ReqStatus;

@Component({
  selector: 'app-sa-specialties-accreditation',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-specialties-accreditation.html',
  styleUrl: './sa-specialties-accreditation.css',
})
export class SaSpecialtiesAccreditation {
  toast = signal('');
  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'بانتظار المراجعة' },
    { key: 'approved', label: 'مقبول' },
    { key: 'rejected', label: 'مرفوض' },
  ];

  readonly aiLabels = AI_REC_LABELS;

  // MOCK — see sa-specialties-accreditation.data.ts
  requests = signal<AccreditationRequest[]>(ACCREDITATION_REQUESTS);

  filteredRequests = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.requests().filter((r) => {
      const matchesFilter = f === 'all' || r.status === f;
      const matchesSearch = !q || r.provider.toLowerCase().includes(q) || r.specialty.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.requests();
    return {
      all: list.length,
      pending: list.filter((r) => r.status === 'pending').length,
      approved: list.filter((r) => r.status === 'approved').length,
      rejected: list.filter((r) => r.status === 'rejected').length,
    };
  });

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
  }

  approveRequest(req: AccreditationRequest) {
    this.requests.update((list) => list.map((r) => (r.id === req.id ? { ...r, status: 'approved' as ReqStatus } : r)));
    this.showToast(`تم قبول اعتماد ${req.provider} في تخصص ${req.specialty}`);
  }

  rejectRequest(req: AccreditationRequest) {
    this.requests.update((list) => list.map((r) => (r.id === req.id ? { ...r, status: 'rejected' as ReqStatus } : r)));
    this.showToast(`تم رفض طلب اعتماد ${req.provider}`);
  }

  approveAllSafe() {
    const safe = this.requests().filter((r) => r.status === 'pending' && r.aiRec === 'accept');
    this.requests.update((list) => list.map((r) => (r.status === 'pending' && r.aiRec === 'accept' ? { ...r, status: 'approved' as ReqStatus } : r)));
    this.showToast(`تم قبول ${safe.length} طلباً بتوصية AI`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
