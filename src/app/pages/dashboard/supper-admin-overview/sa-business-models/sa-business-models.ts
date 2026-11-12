import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BusinessModelReviewApi, MODEL_STATUSES, modelError, ReviewPage } from './business-model-review.api';

@Component({
  selector: 'app-sa-business-models',
  imports: [FormsModule, RouterLink, WsSelectComponent],
  templateUrl: './sa-business-models.html',
  styleUrls: ['./sa-business-models.css'],
})
export class SaBusinessModels implements OnInit {
  private readonly api = inject(BusinessModelReviewApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly labels = MODEL_STATUSES;
  readonly statusOptions = [{ value: '', label: 'كل الحالات' }, ...Object.entries(MODEL_STATUSES).map(([value, label]) => ({value, label}))];
  readonly result = signal<ReviewPage | null>(null);
  readonly loading = signal(false);
  readonly error = signal('');
  search = '';
  status = '';
  private filters = { search: '', status: '' };

  ngOnInit() { this.applyFilters(); }

  applyFilters() {
    if (this.loading()) return;
    this.filters = { search: this.search.trim(), status: this.status };
    this.load(1);
  }

  clearFilters() { this.search = ''; this.status = ''; this.applyFilters(); }

  load(page: number) {
    if (this.loading() || page < 1) return;
    this.loading.set(true);
    this.error.set('');
    this.api.list(page, this.filters.search, this.filters.status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { this.result.set(data); this.loading.set(false); },
      error: e => {
        this.result.set(null);
        this.error.set(modelError(e, 'تعذّر تحميل النماذج. حاول مرة أخرى.'));
        this.loading.set(false);
      },
    });
  }
}
