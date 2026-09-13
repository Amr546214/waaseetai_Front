import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface InfoRow {
  label: string;
  value: string;
  color?: string;
  isLink?: boolean;
}

@Component({
  selector: 'app-sa-gov-fees',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-gov-fees.html',
  styleUrl: './sa-gov-fees.css',
})
export class SaGovFees {
  toast = signal<string | null>(null);

  readonly readinessRows: InfoRow[] = [
    { label: 'إجمالي الإيرادات الخاضعة', value: '4,248,000 ر.س', color: '#2BD4C7' },
    { label: 'تجهيز مستقبلي غير مفعّل في V1', value: '—', color: '#6B7699' },
    { label: 'تعديلات وخصومات مقدَّرة', value: '-128,400 ر.س', color: '#D98A0B' },
    { label: 'إجمالي الالتزامات الحكومية التقديرية', value: '508,800 ر.س', color: '#fff' },
    { label: 'حالة الإقرار', value: '✓ مقدَّم', color: '#0FA99A' },
  ];

  readonly obligationRows: InfoRow[] = [
    { label: 'أساس الاحتساب المستقبلي', value: '12,400,000 ر.س', color: '#2BD4C7' },
    { label: 'الالتزام التقديري المستقبلي', value: '310,000 ر.س', color: '#FFB400' },
    { label: 'تاريخ الاستحقاق', value: '31 مارس 2026', color: '#6B7699' },
    { label: 'الحالة', value: '✓ مدفوعة', color: '#0FA99A' },
    { label: 'ملف الالتزامات الحكومية المستقبلية', value: 'تحميل PDF', color: '#5DA0FF', isLink: true },
  ];

  showToast(message: string) {
    this.toast.set(message);
    setTimeout(() => this.toast.set(null), 2500);
  }

  exportDeclaration() {
    this.showToast('تم تصدير الإقرار — تجهيز مستقبلي غير مفعّل في V1');
  }

  prepareFutureBilling() {
    this.showToast('تجهيز الفوترة المستقبلية للرسوم الحكومية غير مفعّل في V1');
  }
}
