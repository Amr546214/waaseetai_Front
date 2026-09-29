import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  Contract,
  ContractLogEntry,
  CONTRACTS,
  CONTRACT_ESCROW_CLASSES,
  CONTRACT_STATUS_CLASSES,
  CONTRACT_STATUS_LABELS,
} from '../sa-contracts.data';

@Component({
  selector: 'app-sa-contract-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-contract-detail.html',
  styleUrls: ['../sa-contracts.css', './sa-contract-detail.css'],
})
export class SaContractDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statusLabels = CONTRACT_STATUS_LABELS;
  readonly statusClasses = CONTRACT_STATUS_CLASSES;
  readonly escrowClasses = CONTRACT_ESCROW_CLASSES;

  selected = signal<Contract | null>(null);
  notFound = signal(false);
  actionMessage = signal('');

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      // Mock-only: look the contract up in the shared mock array by id.
      const found = id ? CONTRACTS.find((x) => String(x.id) === id) ?? null : null;
      this.selected.set(found);
      this.notFound.set(!found);
      this.actionMessage.set('');
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/contracts']);
  }

  feeAmount(c: Contract): number {
    return Math.round(c.valueNum * (c.feePct / 100));
  }

  netAmount(c: Contract): number {
    return c.valueNum - this.feeAmount(c);
  }

  // Admin actions below are mock-only: they update this page's local copy of
  // the contract (no backend endpoint), so changes don't persist on navigation.
  releaseEscrow() {
    const item = this.selected();
    if (!item) return;
    this.selected.update((s) => (s ? { ...s, escrow: 'مُفرَج' } : s));
    this.actionMessage.set('تم الإفراج اليدوي عن الضمان');
  }

  refundClient() {
    const item = this.selected();
    if (!item) return;
    this.selected.update((s) => (s ? { ...s, escrow: 'مُسترَد', status: 'cancelled' } : s));
    this.actionMessage.set('تم إعادة المبلغ للطالب');
  }

  openDispute() {
    const item = this.selected();
    if (!item) return;
    this.selected.update((s) => (s ? { ...s, status: 'dispute' } : s));
    this.actionMessage.set('تم فتح نزاع يدوياً على هذا العقد');
    this.pushLog('فتح نزاع يدوياً من قبل الإدارة', '#FF6B6B');
  }

  messageParties() {
    const item = this.selected();
    if (!item) return;
    this.actionMessage.set('تم إرسال رسالة إلى طرفي العقد');
    this.pushLog('إرسال رسالة إدارية إلى الطرفين', '#5DA0FF');
  }

  extendContract() {
    const item = this.selected();
    if (!item) return;
    const newDeadline = this.addDays(item.deadline, 7);
    this.selected.update((s) => (s ? { ...s, deadline: newDeadline } : s));
    this.actionMessage.set('تم تمديد الموعد النهائي للعقد 7 أيام');
    this.pushLog('تمديد الموعد النهائي للعقد 7 أيام بقرار إداري', '#FFB400');
  }

  cancelContract() {
    const item = this.selected();
    if (!item) return;
    this.selected.update((s) => (s ? { ...s, status: 'cancelled' } : s));
    this.actionMessage.set('تم إلغاء العقد من قبل الإدارة');
    this.pushLog('إلغاء العقد بقرار إداري', '#6B7699');
  }

  private pushLog(text: string, color: string) {
    const entry: ContractLogEntry = { text, time: 'الآن', color };
    const item = this.selected();
    if (!item) return;
    this.selected.update((s) => (s ? { ...s, log: [entry, ...s.log] } : s));
  }

  private addDays(dateStr: string, days: number): string {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }
}
