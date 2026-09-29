import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { BUSINESS_MODELS, BusinessModel, ModelStatus } from '../sa-business-models.data';

@Component({
  selector: 'app-sa-business-model-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-business-model-detail.html',
  styleUrls: ['../sa-business-models.css', './sa-business-model-detail.css'],
})
export class SaBusinessModelDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  toast = signal('');
  selectedId = signal<string | null>(null);

  // MOCK — see sa-business-models.data.ts. Approve/reject/revision only update
  // this local signal (no backend endpoint yet); nothing is persisted.
  models = signal<BusinessModel[]>(BUSINESS_MODELS);

  selected = computed(() => this.models().find((m) => String(m.id) === this.selectedId()) ?? null);

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.selectedId.set(params.get('id'));
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/business-models']);
  }

  ratingPct(rating: number): number {
    return Math.round((rating / 5) * 100);
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

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
