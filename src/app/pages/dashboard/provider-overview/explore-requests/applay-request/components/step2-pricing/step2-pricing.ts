import { ProviderFeePreviewComponent } from '../../../../../../../shared/fee-policy/provider-fee-preview.component';
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Milestone } from '../../applay-request';
import { WsAmountPipe } from '../../../../../../../shared/money/money.pipe';

@Component({
  selector: 'app-step2-pricing',
  standalone: true,
  imports: [WsAmountPipe, ProviderFeePreviewComponent, CommonModule, FormsModule],
  templateUrl: './step2-pricing.html',
  styleUrl: './step2-pricing.css'
})
export class Step2Pricing {
  @Input() proposal!: any;
  @Input() totalBudget = 0;
  @Input() totalDays = 0;
  @Input() totalPct = 0;
  @Input() totalAmount = 0;
  /** currency of the request being answered (the offer is in it); absent = legacy USD */
  @Input() currency?: string;
  @Input() isFetchingAiSuggest = false;

  @Output() updateTotalBudget = new EventEmitter<number>();
  @Output() useAISuggest = new EventEmitter<void>();
  @Output() addMilestone = new EventEmitter<void>();
  @Output() removeMilestone = new EventEmitter<string>();
  @Output() updateMilestone = new EventEmitter<{id: string, updates: Partial<Milestone>}>();

  get hasMissingPriceOrDuration(): boolean {
    const ms: Milestone[] = this.proposal?.milestones ?? [];
    return !(Number(this.totalBudget) > 0) || ms.length === 0 || ms.some(m => !(Number(m.days) > 0) || !(Number(m.pct) > 0) || !String(m.name ?? '').trim());
  }

  getAmount(pct: number | null): number {
    if (!pct) return 0;
    return Math.round((this.totalBudget * pct) / 100);
  }
}
