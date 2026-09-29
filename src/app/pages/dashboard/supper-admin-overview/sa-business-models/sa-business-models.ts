import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BUSINESS_MODELS, BusinessModel, ModelStatus } from './sa-business-models.data';

type FilterKey = 'all' | ModelStatus;

@Component({
  selector: 'app-sa-business-models',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-business-models.html',
  styleUrl: './sa-business-models.css',
})
export class SaBusinessModels {
  toast = signal('');
  activeFilter = signal<FilterKey>('all');
  searchTerm = signal('');

  readonly filters: { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'pending', label: 'بانتظار الاعتماد' },
    { key: 'approved', label: 'معتمدة' },
    { key: 'rejected', label: 'مرفوضة' },
    { key: 'revision', label: 'بحاجة تعديل' },
  ];

  // MOCK — see sa-business-models.data.ts
  models = signal<BusinessModel[]>(BUSINESS_MODELS);

  filteredModels = computed(() => {
    const f = this.activeFilter();
    const q = this.searchTerm().trim().toLowerCase();
    return this.models().filter((m) => {
      const matchesFilter = f === 'all' || m.status === f;
      const matchesSearch = !q || m.name.toLowerCase().includes(q) || m.provider.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.models();
    return {
      all: list.length,
      pending: list.filter((m) => m.status === 'pending').length,
      approved: list.filter((m) => m.status === 'approved').length,
      rejected: list.filter((m) => m.status === 'rejected').length,
      revision: list.filter((m) => m.status === 'revision').length,
    };
  });

  avgAiScore = computed(() => {
    const list = this.models();
    if (!list.length) return 0;
    return Math.round(list.reduce((sum, m) => sum + m.aiScore, 0) / list.length);
  });

  countFor(key: FilterKey): number {
    return this.counts()[key];
  }

  setFilter(key: FilterKey) {
    this.activeFilter.set(key);
  }

  aiTier(score: number): 'high' | 'mid' | 'low' {
    return score >= 90 ? 'high' : score >= 70 ? 'mid' : 'low';
  }

  setStatus(model: BusinessModel, status: ModelStatus, msg: string) {
    this.models.update((list) => list.map((m) => (m.id === model.id ? { ...m, status } : m)));
    this.showToast(msg);
  }

  approveModel(model: BusinessModel) {
    this.setStatus(model, 'approved', `تم اعتماد النموذج "${model.name}"`);
  }

  rejectModel(model: BusinessModel) {
    this.setStatus(model, 'rejected', `تم رفض النموذج "${model.name}"`);
  }

  requestRevision(model: BusinessModel) {
    this.setStatus(model, 'revision', `طُلب تعديل النموذج "${model.name}"`);
  }

  approveAllFeatured() {
    const pending = this.models().filter((m) => m.status === 'pending' && m.aiScore >= 80);
    this.models.update((list) => list.map((m) => (m.status === 'pending' && m.aiScore >= 80 ? { ...m, status: 'approved' as ModelStatus } : m)));
    this.showToast(`تم اعتماد ${pending.length} نماذج بـ AI Score 80+`);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
