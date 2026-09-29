import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { environment } from '../../../../../../environments/environment';
import { AuthStore } from '../../../../../core/store/auth.store';
import { MessageContext } from '../../../../../core/services/chat.service';

interface FinancialEvent {
  id: string; type: 'credit' | 'hold'; category: 'STAGE_RELEASE' | 'ESCROW_RELEASE' | 'ESCROW_FUNDED';
  amount: number; currency: 'SAR'; title: string; description: string; projectId: string;
  projectTitle: string; stageId: string | null; status: 'COMPLETED' | 'HELD' | 'RELEASED' | 'REFUNDED'; createdAt: string;
}

// Routed transaction-detail page (design: P-PR-016-txn). Reuses the same
// FinancialEvent shape and labels as the transactions list's former modal
// (transactions.ts) — there is no dedicated GET-by-id endpoint for provider
// finance transactions, so, like the client-side transaction-details page,
// this fetches the full list and finds the matching id client-side.
@Component({ selector: 'app-transaction-details', standalone: true, imports: [CommonModule, RouterModule], templateUrl: './transaction-details.html' })
export class TransactionDetails implements OnInit {
  private http = inject(HttpClient);
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
    this.http.get<any>(`${environment.url_api}/provider/finance/transactions`).subscribe({
      next: res => {
        const found = (res?.data?.events || []).find((t: FinancialEvent) => t.id === id) || null;
        if (found) {
          this.txn.set(found);
        } else {
          this.error.set('تعذر العثور على هذه المعاملة');
        }
        this.loading.set(false);
      },
      error: err => {
        this.error.set(err.error?.message || 'تعذر تحميل بيانات المعاملة');
        this.loading.set(false);
      }
    });
  }

  typeLabel(t: FinancialEvent) {
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

  printReceipt() { window.print(); }
}
