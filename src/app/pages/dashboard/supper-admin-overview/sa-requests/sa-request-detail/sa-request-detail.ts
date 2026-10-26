import { WsAmountPipe } from '../../../../../shared/money/money.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { UiNotificationService } from '../../../../../core/services/ui-notification.service';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SaNotifyModal } from '../../sa-notify-modal';
import {
  AdminRequestDetail,
  REQUEST_STATUS_LABELS,
  REQUEST_STATUS_CLASSES,
  OFFER_STATUS_LABELS,
  CONTRACT_STATUS_LABELS,
  SaRequestsService,
  apiErrorMessage,
  formatBudget,
} from '../sa-requests.service';

@Component({
  selector: 'app-sa-request-detail',
  standalone: true,
  imports: [WsAmountPipe, CommonModule, RouterLink, SaNotifyModal],
  templateUrl: './sa-request-detail.html',
  styleUrls: ['../sa-requests.css', './sa-request-detail.css'],
})
export class SaRequestDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private api = inject(SaRequestsService);
  private notify = inject(UiNotificationService);

  readonly statusLabels = REQUEST_STATUS_LABELS;
  readonly statusClasses = REQUEST_STATUS_CLASSES;
  readonly offerLabels = OFFER_STATUS_LABELS;
  readonly contractLabels = CONTRACT_STATUS_LABELS;

  readonly stateChangeReason = 'غير متاح حاليًا — لا يوجد مسار إداري لتغيير حالة الطلب، ويحتاج قرارًا من المنتج (أثره على العروض والضمان)';
  notifyOpen = signal(false);
  selected = signal<AdminRequestDetail | null>(null);
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
        else this.error.set(apiErrorMessage(err, 'تعذّر تحميل الطلب'));
      },
    });
  }

  budget(d: AdminRequestDetail): string {
    return formatBudget(d.budget);
  }

  /** conditions.outputs may be an array or a string. */
  outputs(d: AdminRequestDetail): string[] {
    const o = d.conditions?.outputs;
    if (!o) return [];
    return Array.isArray(o) ? o : [o];
  }

  yesNo(v: boolean | null | undefined): string {
    return v === true ? 'نعم' : v === false ? 'لا' : '—';
  }

  onNotifySent(): void {
    this.notifyOpen.set(false);
    this.notify.success('تم إرسال الرسالة لصاحب الطلب وتسجيلها في سجل التدقيق');
  }
}
