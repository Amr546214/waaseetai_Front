import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  CONTRACT_STATUS_LABELS,
  OFFER_STATUS_LABELS,
  REQUEST_STATUS_LABELS,
  apiErrorMessage,
} from '../../sa-requests/sa-requests.service';
import {
  AdminOfferDetail,
  NEGOTIATION_STATE_LABELS,
  OFFER_STATUS_CLASSES,
  SaOffersService,
  feedbackSummary,
  toList,
} from '../sa-offers.service';

@Component({
  selector: 'app-sa-offer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-offer-detail.html',
  styleUrls: ['../sa-offers.css', './sa-offer-detail.css'],
})
export class SaOfferDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(SaOffersService);

  readonly statusLabels = OFFER_STATUS_LABELS;
  readonly statusClasses = OFFER_STATUS_CLASSES;
  readonly requestLabels = REQUEST_STATUS_LABELS;
  readonly contractLabels = CONTRACT_STATUS_LABELS;
  readonly negotiationLabels = NEGOTIATION_STATE_LABELS;
  readonly toList = toList;

  selected = signal<AdminOfferDetail | null>(null);
  loading = signal(true);
  notFound = signal(false);
  error = signal('');
  private id = '';

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  load(): void {
    if (!this.id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.notFound.set(false);
    this.api.get(this.id).subscribe({
      next: (res) => {
        this.selected.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.selected.set(null);
        this.loading.set(false);
        if (err?.status === 404) this.notFound.set(true);
        else this.error.set(apiErrorMessage(err, 'تعذّر تحميل العرض'));
      },
    });
  }

  aiSummary(d: AdminOfferDetail): string {
    return feedbackSummary(d.aiReview);
  }

  entryKind(kind: string): string {
    const k = (kind || '').toUpperCase();
    if (k.includes('COUNTER')) return 'عرض مضاد';
    if (k.includes('REQUEST')) return 'طلب تفاوض';
    return kind || '—';
  }
}
