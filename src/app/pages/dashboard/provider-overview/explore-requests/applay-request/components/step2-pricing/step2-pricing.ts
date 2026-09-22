import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Milestone } from '../../applay-request';

@Component({
  selector: 'app-step2-pricing',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './step2-pricing.html',
  styleUrl: './step2-pricing.css'
})
export class Step2Pricing {
  @Input() proposal!: any;
  @Input() totalBudget = 0;
  @Input() totalDays = 0;
  @Input() totalPct = 0;
  @Input() totalAmount = 0;

  @Output() updateTotalBudget = new EventEmitter<number>();
  @Output() addMilestone = new EventEmitter<void>();
  @Output() removeMilestone = new EventEmitter<string>();
  @Output() updateMilestone = new EventEmitter<{id: string, updates: Partial<Milestone>}>();

  getAmount(pct: number | null): number {
    if (!pct) return 0;
    return Math.round((this.totalBudget * pct) / 100);
  }
}
