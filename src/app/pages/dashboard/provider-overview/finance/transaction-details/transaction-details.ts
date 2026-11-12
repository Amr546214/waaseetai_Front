import { reportMoney } from '../../../../../core/reports/report-document';
import { walletReportSections } from '../../../../../core/reports/wallet-report';
import { ReportPrintService } from '../../../../../core/reports/report-print.service';
import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import { AuthStore } from '../../../../../core/store/auth.store';
import { MessageContext } from '../../../../../core/services/chat.service';
import { WalletUnifyService } from '../../../../../core/services/wallet-unify.service';
import { WalletBreakdown } from '../../../../../core/models/wallet-unify.model';
import { WalletBreakdownComponent, WalletBreakdownRow } from '../../../../../shared/wallet/wallet-breakdown.component';

interface FinancialEvent {
  id: string; type: 'credit' | 'hold'; category: 'STAGE_RELEASE' | 'ESCROW_RELEASE' | 'ESCROW_FUNDED' | 'CANCELLATION_SETTLEMENT' | 'ADMIN_RELEASE';
  breakdown?: WalletBreakdown;
  amount: number; currency: 'USD'; title: string; description: string; projectId: string;
  projectTitle: string; stageId: string | null; status: 'COMPLETED' | 'HELD' | 'RELEASED' | 'REFUNDED'; createdAt: string;
}

// Routed transaction-detail page (design: P-PR-016-txn). Reuses the same
// FinancialEvent shape and labels as the transactions list's former modal
// (transactions.ts) — there is no dedicated GET-by-id endpoint for provider
// finance transactions, so, like the client-side transaction-details page,
// this fetches the full list and finds the matching id client-side.
@Component({ selector: 'app-transaction-details', standalone: true, imports: [CommonModule, RouterModule, WalletBreakdownComponent], templateUrl: './transaction-details.html' })
export class TransactionDetails implements OnInit {
  private readonly reportPrinter = inject(ReportPrintService);
  private http = inject(HttpClient);
  private walletApi = inject(WalletUnifyService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authStore = inject(AuthStore);

  loading = signal(true);
  error = signal('');
  txn = signal<FinancialEvent | null>(null);

  providerName = computed(() => {
    const user = this.authStore.currentUser();
    if (!user) return '—';
    return `${user.firstName || ''} ${user.lastName || ''}`.trim() || '—';
  });

  ngOnInit() { this.load(); }

  load() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('رقم المعاملة غير صالح');
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    // One read by id (owner only on the server: another provider's record answers 404 like an unknown id).
    this.walletApi.detail('provider', id).subscribe({
      next: res => {
        const d = res?.data;
        if (res?.success && d) {
          this.txn.set({ ...d, projectId: d.projectId ?? d.project?.id, projectTitle: d.projectTitle ?? d.project?.title ?? '' } as FinancialEvent);
        } else {
          this.error.set('تعذر العثور على هذه المعاملة');
        }
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err?.status === 404 ? 'تعذر العثور على هذه المعاملة' : (err.error?.message || 'تعذر تحميل بيانات المعاملة'));
        this.loading.set(false);
      }
    });
  }

  breakdownRows = computed<WalletBreakdownRow[]>(() => {
    const t = this.txn();
    return t ? [{ id: t.id, title: t.title || t.projectTitle || '', breakdown: t.breakdown ?? null, storedAmount: t.amount, storedCurrency: t.currency }] : [];
  });

  typeLabel(t: FinancialEvent) {
    if (t.category === 'CANCELLATION_SETTLEMENT' || t.id.startsWith('cancellation-settlement-')) return 'تسوية إلغاء متبادل';
    if (t.category === 'ADMIN_RELEASE' || t.id.startsWith('admin-release-')) return 'صرف إداري للضمان';
    if (t.category === 'ESCROW_FUNDED') return 'تمويل حساب الضمان';
    if (t.category === 'ESCROW_RELEASE') return 'إفراج من حساب الضمان';
    return 'إفراج أرباح مرحلة';
  }

  statusLabel(t: FinancialEvent) {
    if (t.type === 'credit') return 'مفرج ومكتمل';
    if (t.status === 'HELD') return 'محتجز في الضمان';
    if (t.status === 'REFUNDED') return 'مسترد';
    return 'تم الإفراج';
  }

  inquireAboutTxn(t: FinancialEvent) {
    const ctx: MessageContext = { type: 'PROJECT', projectId: t.projectId, projectTitle: t.projectTitle };
    this.router.navigate(['/provider-overview/messages'], { state: { messageContext: ctx } });
  }

  printReceipt() {
    const tx=this.txn();if(!tx||this.loading()||this.error())return;
    this.reportPrinter.print({title:'إيصال حركة مالية لمقدم الخدمة',metadata:[['رقم المعاملة',tx.id]],sections:[{title:'بيانات الحركة',facts:[['نوع الحركة',this.typeLabel(tx)],['الحالة',this.statusLabel(tx)],['المشروع',tx.projectTitle],['التاريخ',new Date(tx.createdAt).toLocaleString('ar-EG')],['القيمة المسجلة',reportMoney(tx.amount,tx.currency)],['الوصف',tx.description]]},...walletReportSections(tx.breakdown)]});
  }
}
