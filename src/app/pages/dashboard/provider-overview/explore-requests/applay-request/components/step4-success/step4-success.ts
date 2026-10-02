import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-step4-success',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './step4-success.html'
})
export class Step4Success {
  @Input() currentAudit!: any;
  @Input() totalAmount = 0;
  @Input() totalDays = 0;
  @Input() totalPct = 0;
  @Input() proposal!: any;
  @Input() projectDetails: any = null;
  @Input() portfolioOptions: any[] = [];

  /**
   * True only when a real WaseetAI proposal-quality score is present. The
   * parent's "unavailable" fallback leaves overallScore null.
   */
  hasAuditResult(): boolean {
    return typeof this.currentAudit?.finalMetrics?.overallScore === 'number';
  }

  getPortfolioItem(id: string) {
    return this.portfolioOptions.find((p: any) => p.id === id);
  }
}
