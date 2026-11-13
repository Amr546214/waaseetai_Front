import { assistantMarkdown } from '../../../../../core/help/assistant-content';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { BusinessModelReviewApi, MODEL_ACTIONS, MODEL_STATUSES, ModelAction, modelError, ReviewModelDetail } from '../business-model-review.api';

@Component({
  selector: 'app-sa-business-model-detail',
  imports: [RouterLink, FormsModule],
  templateUrl: './sa-business-model-detail.html',
  styleUrls: ['../sa-business-models.css', '../business-model-review.css', './sa-business-model-detail.css'],
})
export class SaBusinessModelDetail implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(BusinessModelReviewApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly access = inject(AdminAccessService);
  readonly states = MODEL_STATUSES;
  readonly labels = MODEL_ACTIONS;
  readonly model = signal<ReviewModelDetail | null>(null);
  readonly error = signal('');
  readonly decisionError = signal('');
  readonly saved = signal(false);
  readonly busy = signal(false);
  readonly loading = signal(false);
  readonly selected = signal<ModelAction | null>(null);
  readonly markdown = assistantMarkdown;
  reason = '';

  ngOnInit() { this.load(); }

  load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) { this.error.set('النموذج غير موجود.'); return; }
    this.loading.set(true);
    this.error.set('');
    this.api.detail(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => { this.model.set(data); this.loading.set(false); },
      error: e => {
        this.model.set(null);
        this.error.set(modelError(e, 'تعذّر تحميل النموذج.'));
        this.loading.set(false);
      },
    });
  }

  choose(action: ModelAction | null) {
    this.selected.set(action);
    this.reason = '';
    this.saved.set(false);
    this.decisionError.set('');
  }

  confirm() {
    const model = this.model();
    const action = this.selected();
    const reason = this.reason.trim();
    if (!this.access.can('content.manage') || this.busy() || this.loading() || !model || !action || !model.actions.includes(action)) return;
    if (action === 'REJECT' && !reason) { this.decisionError.set('سبب الرفض مطلوب.'); return; }
    this.busy.set(true);
    this.decisionError.set('');
    this.api.decide(model.id, action, reason, model.status).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.busy.set(false); this.choose(null); this.saved.set(true); this.load(); },
      error: e => {
        this.busy.set(false);
        if (e.status === 409) { this.choose(null); this.load(); }
        this.decisionError.set(modelError(e, 'تعذّر حفظ القرار. حدّث الصفحة للتحقق من الحالة.'));
      },
    });
  }
}
