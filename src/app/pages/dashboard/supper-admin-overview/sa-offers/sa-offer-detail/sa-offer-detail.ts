import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  NegotiationKind,
  Offer,
  OfferStatus,
  OFFER_STATUS_LABELS,
  OFFER_STATUS_CLASSES,
  OFFERS,
  offerPriceIntel,
} from '../sa-offers.data';

@Component({
  selector: 'app-sa-offer-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-offer-detail.html',
  styleUrls: ['../sa-offers.css', './sa-offer-detail.css'],
})
export class SaOfferDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statusLabels: Record<OfferStatus, string> = OFFER_STATUS_LABELS;

  readonly statusClasses: Record<OfferStatus, string> = OFFER_STATUS_CLASSES;

  readonly negDotClasses: Record<NegotiationKind, string> = {
    step: 'of-dot-step',
    accepted: 'of-dot-accept',
    rejected: 'of-dot-reject',
    flagged: 'of-dot-flag',
  };

  selected = signal<Offer | null>(null);
  notFound = signal(false);
  actionMessage = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      this.actionMessage.set('');
      // Mock data only — no backend endpoint for offers yet.
      const item = id ? OFFERS.find((o) => String(o.id) === id) : undefined;
      this.selected.set(item ?? null);
      this.notFound.set(!item);
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/offers']);
  }

  priceIntel(o: Offer): { label: string; cls: string } {
    return offerPriceIntel(o);
  }

  notifyProvider() {
    this.actionMessage.set('تم إرسال إشعار لمقدم الخدمة');
  }

  suspendOffer() {
    const item = this.selected();
    if (!item) return;
    this.selected.update((s) => (s ? { ...s, status: 'rejected' } : s));
    this.actionMessage.set('تم تعليق العرض');
  }

  cancelContract() {
    this.actionMessage.set('تم إرسال طلب إلغاء العقد المرتبط للمراجعة');
  }
}
