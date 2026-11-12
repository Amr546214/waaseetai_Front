import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthStore } from '../../../../../core/store/auth.store';
import { MessageContext } from '../../../../../core/services/chat.service';
import { WalletBreakdownComponent, WalletBreakdownRow } from '../../../../../shared/wallet/wallet-breakdown.component';
import { ClientFinanceService, ClientWalletTransactionDetail } from '../../../../../core/services/client-finance.service';

@Component({
  selector: 'app-transaction-details',
  standalone: true,
  imports: [CommonModule, RouterLink, WalletBreakdownComponent],
  templateUrl: './transaction-details.html',
  styleUrl: './transaction-details.css',
})
export class TransactionDetails implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private financeService = inject(ClientFinanceService);
  private authStore = inject(AuthStore);

  transaction = signal<ClientWalletTransactionDetail | null>(null);
  loading = signal(true);
  error = signal('');
  /** 404: not this account's transaction (or no such id); anything else is a load failure the user can retry */
  notFound = signal(false);

  /** «تفصيل المبالغ والخصومات» of this operation, from its stored record */
  breakdownRows = computed<WalletBreakdownRow[]>(() => {
    const tx = this.transaction();
    return tx ? [{ id: tx.id, title: this.title(), breakdown: tx.breakdown ?? null, storedAmount: Math.abs(tx.amount), storedCurrency: tx.currency }] : [];
  });

  isEscrow = computed(() => this.transaction()?.type === 'ESCROW_LOCK');
  isDeposit = computed(() => this.transaction()?.type === 'DEPOSIT');
  // A refund returns money to the wallet, like a deposit.
  direction = computed<'in' | 'out'>(() => this.isDeposit() || this.transaction()?.type === 'REFUND' || this.transaction()?.type === 'AMENDMENT_REFUND' || this.transaction()?.type === 'CASHBACK' ? 'in' : 'out');
  isFailed = computed(() => this.transaction()?.status === 'FAILED');
  // payments are stored negative: the sign is shown once, from the direction; a failed attempt moved no money, so it has no sign
  amountAbs = computed(() => Math.abs(this.transaction()?.amount ?? 0));
  sign = computed(() => this.isFailed() ? '' : (this.direction() === 'out' ? '-' : '+'));
  isDone = computed(() => this.transaction()?.status === 'COMPLETED');
  isHeld = computed(() => this.transaction()?.status === 'HELD');

  title = computed(() => {
    const tx = this.transaction();
    if (!tx) return '';
    if (tx.description) return tx.description;
    return this.isEscrow() ? 'إيداع بالضمان' : (this.isDeposit() ? 'إيداع رصيد بالمحفظة' : 'معاملة مالية');
  });

  typeLabel = computed(() => {
    const tx = this.transaction();
    if (!tx) return '';
    if (tx.type === 'ESCROW_LOCK') return 'إيداع بحساب الضمان';
    if (tx.type === 'DEPOSIT') return 'إيداع رصيد بالمحفظة';
    if (tx.type === 'ORDER_PAYMENT') return 'دفع طلب خدمة من المحفظة';
    if (tx.type === 'REFUND') return 'استرداد إلى المحفظة';
    if (tx.type === 'AMENDMENT_TOPUP') return 'زيادة ميزانية عقد من المحفظة';
    if (tx.type === 'AMENDMENT_REFUND') return 'استرداد خفض ميزانية عقد إلى المحفظة';
    if (tx.type === 'CASHBACK') return 'كاش باك مشروع مكتمل في المحفظة';
    return tx.type;
  });

  paymentMethodLabel = computed(() => {
    const m = this.transaction()?.paymentMethod;
    if (!m) return '—';
    return ({ PAYPAL: 'PayPal', WALLET: 'رصيد المحفظة' } as Record<string, string>)[m] ?? m;
  });

  /** held / released / remaining of the escrow, from the stored escrow only */
  escrowRemaining = computed(() => {
    const e = this.transaction()?.escrow;
    return e ? Math.max(0, Math.round((e.amount - e.releasedAmount) * 100) / 100) : 0;
  });

  currencyLabel = computed(() => this.transaction()?.currency === 'USD' ? '$' : (this.transaction()?.currency ?? ''));

  statusLabel = computed(() => this.isFailed() ? 'فشلت' : this.isHeld() ? 'محجوز في الضمان' : (this.isDone() ? 'مكتمل' : 'قيد المعالجة'));

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('رقم المعاملة غير صالح');
      this.loading.set(false);
      return;
    }

    this.load(id);
  }

  retry() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.load(id);
  }

  private load(id: string) {
    this.loading.set(true);
    this.error.set('');
    this.notFound.set(false);
    // One read by id (owner only on the server): the same page opens from the wallet list and from a direct URL, whatever the list holds.
    this.financeService.getTransaction(id).subscribe({
      next: response => {
        if (response?.success && response.data) this.transaction.set(response.data);
        else this.error.set('تعذر تحميل بيانات المعاملة');
        this.loading.set(false);
      },
      error: (err) => {
        if (err?.status === 404) { this.notFound.set(true); this.error.set('تعذر العثور على هذه المعاملة'); }
        else this.error.set('تعذر تحميل بيانات المعاملة');
        this.loading.set(false);
      }
    });
  }

  goBack() {
    this.router.navigate(['/client-overview/finance/wallet']);
  }

  formatDateTime(value: string | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    const datePart = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
    const timePart = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { hour: '2-digit', minute: '2-digit' }).format(date);
    return `${datePart} · ${timePart}`;
  }

  /** Inquiry: a transaction that belongs to a project opens the messages with that project as context; a wallet-only one (a deposit) goes to the support tickets. */
  inquire() {
    const tx = this.transaction();
    if (tx?.project) {
      const ctx: MessageContext = { type: 'PROJECT', projectId: tx.project.id, projectTitle: tx.project.title };
      this.router.navigate(['/client-overview/messages'], { state: { messageContext: ctx } });
    } else {
      this.router.navigate(['/client-overview/help/tickets/new']);
    }
  }

  /** Receipt: a printable page built from the stored values only (print dialog -> save as PDF). Offered for a transaction that moved money. */
  canPrintReceipt = computed(() => !!this.transaction() && !this.isFailed());

  printReceipt() {
    const tx = this.transaction();
    if (!tx || this.isFailed()) return;
    const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    const rows: Array<[string, string]> = [
      ['رقم المعاملة', tx.referenceId || tx.id],
      ['النوع', this.typeLabel()],
      ['المبلغ', `${this.amountAbs().toFixed(2)} ${this.currencyLabel()}`],
      ['الحالة', this.statusLabel()],
      ['التاريخ والوقت', this.formatDateTime(tx.createdAt)],
      ['طريقة الدفع', this.paymentMethodLabel()],
    ];
    const u = this.authStore.currentUser();
    const clientName = `${u?.firstName || ''} ${u?.lastName || ''}`.trim();
    if (clientName) rows.splice(1, 0, ['صاحب الحساب (طالب الخدمة)', clientName]);
    if (tx.project) rows.splice(rows.length - 2, 0, ['المشروع', tx.project.title]);
    if (tx.project?.providerName) rows.splice(rows.length - 2, 0, ['مقدم الخدمة', tx.project.providerName]);
    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>إيصال معاملة</title>
<style>body{font-family:system-ui,Tahoma,sans-serif;margin:32px;color:#111}h1{font-size:20px;margin:0 0 4px}p{color:#555;margin:0 0 20px}table{width:100%;border-collapse:collapse}td{padding:10px 8px;border-bottom:1px solid #ddd}td:first-child{color:#555;width:35%}</style></head><body>
<h1>إيصال معاملة مالية</h1><p>${esc(this.title())}</p><table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</table></body></html>`;
    const w = window.open('', '_blank', 'width=720,height=800');
    if (!w) return;
    w.document.open(); w.document.write(html); w.document.close();
    w.focus(); w.print();
  }
}
