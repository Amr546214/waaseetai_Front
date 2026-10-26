import { WsAmountPipe } from '../../../../../shared/money/money.pipe';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AMENDMENT_EFFECT_NOTE, AMENDMENT_RECORDED_BADGE } from '../../../../../core/constants/amendment-effect';
import { AdminContractDetail, AdminOpsApiService } from '../../../../../core/services/admin-ops-api.service';
import {
  AMENDMENT_STATUS_LABELS,
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
  DELIVERY_STATUS_LABELS,
  DISPUTE_STATUS_LABELS,
  ESCROW_STATUS_CLASSES,
  ESCROW_STATUS_LABELS,
  FINANCE_ACTION_DISABLED_REASON,
  FINANCE_ACTION_NOTE,
  STAGE_STATUS_LABELS,
  initials,
  label,
} from '../../sa-projects/sa-projects.labels';

@Component({
  selector: 'app-sa-contract-detail',
  standalone: true,
  imports: [WsAmountPipe, CommonModule, RouterLink],
  templateUrl: './sa-contract-detail.html',
  styleUrls: ['../sa-contracts.css', './sa-contract-detail.css'],
})
export class SaContractDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private api = inject(AdminOpsApiService);
  private destroyRef = inject(DestroyRef);

  readonly statusLabels = CONTRACT_STATUS_LABELS;
  readonly statusClasses = CONTRACT_STATUS_CLASSES;
  readonly escrowLabels = ESCROW_STATUS_LABELS;
  readonly escrowClasses = ESCROW_STATUS_CLASSES;
  readonly stageLabels = STAGE_STATUS_LABELS;
  readonly deliveryLabels = DELIVERY_STATUS_LABELS;
  readonly disputeLabels = DISPUTE_STATUS_LABELS;
  readonly amendmentLabels = AMENDMENT_STATUS_LABELS;
  readonly amendmentEffectNote = AMENDMENT_EFFECT_NOTE;
  readonly amendmentRecordedBadge = AMENDMENT_RECORDED_BADGE;
  readonly financeReason = FINANCE_ACTION_DISABLED_REASON;
  readonly financeNote = FINANCE_ACTION_NOTE;
  readonly initials = initials;
  readonly label = label;

  selected = signal<AdminContractDetail | null>(null);
  loading = signal(true);
  error = signal(false);
  notFound = signal(false);

  /** Only a v2 fee policy carries meaningful commission / provider-net figures. */
  showFees = computed(() => this.selected()?.escrow?.feePolicyVersion === 2);

  private req?: Subscription;
  private id = '';

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.req?.unsubscribe());
    this.route.paramMap.subscribe((params) => {
      this.id = params.get('id') ?? '';
      this.load();
    });
  }

  load(): void {
    this.req?.unsubscribe();
    this.loading.set(true);
    this.error.set(false);
    this.notFound.set(false);
    if (!this.id) {
      this.loading.set(false);
      this.notFound.set(true);
      return;
    }
    this.req = this.api.getContract(this.id).subscribe({
      next: (res) => {
        this.selected.set(res.data);
        this.loading.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.selected.set(null);
        this.loading.set(false);
        if (err?.status === 404) this.notFound.set(true);
        else this.error.set(true);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/contracts']);
  }
}
