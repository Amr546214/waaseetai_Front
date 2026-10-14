import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  SpecialtyDecision, SpecialtyReviewDetail, STATUS_CLASS, STATUS_TEXT, initialOf, isWebUrl, parseAiFeedback,
} from '../sa-specialties-accreditation.data';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { SaSpecialtyReviewService } from '../sa-specialty-review.service';
import { SaSpecialtyDecisionModal } from '../sa-specialty-decision-modal';

@Component({
  selector: 'app-sa-specialty-accreditation-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, SaSpecialtyDecisionModal],
  templateUrl: './sa-specialty-accreditation-detail.html',
  styleUrls: ['../sa-specialties-accreditation.css', './sa-specialty-accreditation-detail.css'],
})
export class SaSpecialtyAccreditationDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(SaSpecialtyReviewService);
  private notify = inject(UiNotificationService);

  detail = signal<SpecialtyReviewDetail | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');

  pendingDecision = signal<SpecialtyDecision | null>(null);
  deciding = signal(false);
  decisionError = signal('');

  readonly statusText = STATUS_TEXT;
  readonly statusClass = STATUS_CLASS;
  readonly initialOf = initialOf;
  readonly isWebUrl = isWebUrl;

  /** Stored AI result of the assessment (null when the specialty has none). */
  aiFeedback = computed(() => parseAiFeedback(this.detail()?.aiFeedback));


  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (!id) {
        this.notFound.set(true);
        this.loading.set(false);
        return;
      }
      this.fetch(id);
    });
  }

  private fetch(id: string): void {
    this.loading.set(true);
    this.notFound.set(false);
    this.error.set('');
    this.detail.set(null);
    this.api.get(id).subscribe({
      next: (res) => {
        this.loading.set(false);
        if (res?.data) this.detail.set(res.data);
        else this.notFound.set(true);
      },
      error: (err) => {
        this.loading.set(false);
        if (err?.status === 404) this.notFound.set(true);
        else this.error.set(err?.error?.message || 'تعذر تحميل تفاصيل طلب اعتماد التخصص');
      },
    });
  }

  retry(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.fetch(id);
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/specialties-accreditation']);
  }

  isPending(): boolean {
    return this.detail()?.status === 'UNDER_AI_REVIEW';
  }

  openDecision(decision: SpecialtyDecision) {
    if (!this.isPending()) return;
    this.decisionError.set('');
    this.pendingDecision.set(decision);
  }

  closeDecision() {
    if (this.deciding()) return;
    this.pendingDecision.set(null);
    this.decisionError.set('');
  }

  decisionSummary(): string {
    const d = this.detail();
    return d ? `${d.provider.name || '—'} · ${d.specialty?.nameAr || '—'}` : '';
  }

  confirmDecision(reason: string) {
    const d = this.detail();
    const decision = this.pendingDecision();
    if (!d || !decision || this.deciding()) return;
    this.deciding.set(true);
    this.decisionError.set('');
    this.api.decide(d.id, decision, reason).subscribe({
      next: () => {
        this.deciding.set(false);
        this.pendingDecision.set(null);
        this.notify.success(decision === 'APPROVED' ? 'تم قبول التخصص وإشعار مقدم الخدمة' : 'تم رفض التخصص وإشعار مقدم الخدمة بالسبب');
        this.fetch(d.id);
      },
      error: (err) => {
        this.deciding.set(false);
        this.decisionError.set(err?.error?.message || 'تعذر تنفيذ القرار');
        if (err?.status === 409) this.fetch(d.id);
      },
    });
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return new Intl.DateTimeFormat('ar-SA', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
  }

  score(v: number | null | undefined): string {
    return v == null ? '—' : String(v);
  }
}
