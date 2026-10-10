import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ProviderProfileService } from '../../../../../core/services/provider-profile.service';
import { ProfileAiReviewComponent } from '../../../../../shared/ai/profile-ai-review.component';
import { AuthStore } from '../../../../../core/store/auth.store';
import { AccountType } from '../../../../../core/models/auth.model';

@Component({
  selector: 'app-profile-requests',
  standalone: true,
  imports: [CommonModule, RouterModule, ProfileAiReviewComponent],
  templateUrl: './requests.html',
  styleUrls: ['./requests.css'],
})
export class Requests implements OnInit {
  private providerProfileService = inject(ProviderProfileService);
  private authStore = inject(AuthStore);

  activeFilter = signal<string>('ALL');
  requestsData = signal<any | null>(null);
  isLoading = signal<boolean>(true);
  /** The read failed (401/429/5xx/network): never shown as zero counters / "no requests". */
  loadError = signal<boolean>(false);
  
  showToast = signal<string>('');

  /**
   * "Edit and send again" after a rejection: only a category the data page really edits is linked (never a guess).
   * DOCUMENTS (ID, certificate, commercial register, VAT) -> the documents tab. The legacy PROFILE e-mail / phone shapes -> the contact tab,
   * the legacy national id -> the documents tab. CONTACT / PayPal are confirmed by a code and are never rejected; BANKING is retired: no button.
   */
  resubmitTab(req: { status?: string; category?: string; fieldName?: string } | null | undefined): 'docs' | 'contact' | null {
    if (req?.status !== 'REJECTED') return null;
    if (req.category === 'DOCUMENTS') return 'docs';
    if (req.category === 'PROFILE') {
      if (req.fieldName === 'EMAIL' || req.fieldName === 'PHONE_NUMBER') return 'contact';
      if (req.fieldName === 'NATIONAL_ID') return 'docs';
    }
    return null;
  }

  isCompanyMode = computed<boolean>(() => {
    const user = this.authStore.currentUser();
    return user?.accountType === AccountType.PROVIDER_COMPANY;
  });

  // Company filter state
  coStatusFilter = signal<string>('all');
  coTypeFilter = signal<string>('all');
  coSearchQuery = signal('');

  coFilteredRequests = computed(() => {
    const reqs = this.requestsData()?.requests || [];
    const status = this.coStatusFilter();
    const type = this.coTypeFilter();
    const q = this.coSearchQuery().toLowerCase();
    return reqs.filter((r: any) => {
      const matchStatus = status === 'all' || this.mapStatusToCo(r.status) === status;
      const matchType = type === 'all' || this.mapTypeToCo(r) === type;
      const matchQ = !q || (r.id || '').toLowerCase().includes(q);
      return matchStatus && matchType && matchQ;
    });
  });

  coKpis = computed(() => {
    const reqs = this.requestsData()?.requests || [];
    return {
      pending: reqs.filter((r: any) => r.status === 'PENDING_HUMAN_REVIEW' || r.status === 'IN_AI_REVIEW').length,
      approved: reqs.filter((r: any) => r.status === 'APPROVED').length,
      rejected: reqs.filter((r: any) => r.status === 'REJECTED').length,
      action: reqs.filter((r: any) => r.status === 'PENDING_OTP').length,
    };
  });

  private mapStatusToCo(status: string): string {
    if (status === 'PENDING_HUMAN_REVIEW' || status === 'IN_AI_REVIEW') return 'pending';
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'rejected';
    if (status === 'PENDING_OTP') return 'action';
    return 'all';
  }

  private mapTypeToCo(req: any): string {
    const field = (req.fieldLabel || req.field || '').toLowerCase();
    if (field.includes('تخصص') || field.includes('specialty')) return 'specialties';
    if (field.includes('مستند') || field.includes('document') || field.includes('شهادة')) return 'documents';
    return 'official';
  }

  setCoStatusFilter(filter: string) {
    this.coStatusFilter.set(filter);
  }

  setCoTypeFilter(filter: string) {
    this.coTypeFilter.set(filter);
  }

  updateCoSearch(event: Event) {
    const input = event.target as HTMLInputElement;
    this.coSearchQuery.set(input.value);
  }

  coStatusLabel(status: string): string {
    if (status === 'PENDING_OTP') return 'يحتاج إجراء';
    if (status === 'IN_AI_REVIEW' || status === 'PENDING_HUMAN_REVIEW') return 'قيد المراجعة';
    if (status === 'APPROVED') return 'مكتمل';
    if (status === 'REJECTED') return 'مرفوض';
    return 'ملغي';
  }

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.isLoading.set(true);
    this.loadError.set(false);
    this.providerProfileService.getRequests(this.activeFilter()).subscribe({
      next: (res: any) => {
        if (res?.success && res.data) {
          this.requestsData.set(res.data);
        } else {
          this.requestsData.set(null);
          this.loadError.set(true);
        }
        this.isLoading.set(false);
      },
      error: (err: any) => {
        console.error('Failed to load requests', err);
        this.requestsData.set(null);
        this.loadError.set(true);
        this.isLoading.set(false);
      }
    });
  }

  setFilter(filter: string) {
    this.activeFilter.set(filter);
    this.loadRequests();
  }

  cancelRequest(id: string) {
    if (confirm(`هل أنت متأكد من سحب هذا الطلب؟`)) {
      this.providerProfileService.cancelRequest(id).subscribe({
        next: (res: any) => {
          if (res.success) {
            this.displayToast(`تم سحب الطلب بنجاح`);
            this.loadRequests();
          }
        },
        error: (err: any) => {
          console.error('Failed to cancel request', err);
          this.displayToast(`حدث خطأ أثناء الإلغاء`);
        }
      });
    }
  }

  displayToast(msg: string) {
    this.showToast.set(msg);
    setTimeout(() => this.showToast.set(''), 3000);
  }

  displayEntries(rawValue: unknown): Array<{ label: string; value: string }> {
    if (rawValue === null || rawValue === undefined || rawValue === '' || rawValue === 'غير محدد') {
      return [{ label: 'القيمة', value: 'غير محدد' }];
    }

    let parsed: unknown = rawValue;
    if (typeof rawValue === 'string') {
      try {
        parsed = JSON.parse(rawValue);
      } catch {
        return [{ label: 'القيمة', value: this.formatValue('value', rawValue) }];
      }
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return [{ label: 'القيمة', value: this.formatValue('value', parsed) }];
    }

    const entries = Object.entries(parsed as Record<string, unknown>)
      // legacy bank values (requests filed before PayPal became the only payout method) are never shown
      .filter(([key]) => !['password', 'metadata', 'accountHolderName', 'ibanNumber', 'bankName', 'iban', 'accountNumber'].includes(key))
      .map(([key, value]) => ({ label: this.fieldLabel(key), value: this.formatValue(key, value) }));

    return entries.length ? entries : [{ label: 'القيمة', value: 'غير محدد' }];
  }

  private fieldLabel(key: string): string {
    const labels: Record<string, string> = {
      email: 'البريد الإلكتروني', phoneNumber: 'رقم الجوال', alternativePhone: 'رقم واتساب',
      idDocumentUrl: 'الهوية الوطنية', commercialRegistration: 'السجل التجاري', vatCertificateUrl: 'شهادة VAT',
      firstName: 'الاسم الأول', lastName: 'اسم العائلة', headline: 'المسمى المهني', bio: 'الوصف المهني',
      hourlyRate: 'سعر الساعة', yearsOfExperience: 'سنوات الخبرة', availabilityStatus: 'حالة التوفر',
      mainSpecialty: 'التخصص الرئيسي', country: 'الدولة', city: 'المدينة', location: 'العنوان',
      websiteUrl: 'الموقع الشخصي', linkedinUrl: 'LinkedIn', twitterUrl: 'Twitter / X', githubUrl: 'GitHub / Behance',
      languages: 'اللغات', preferences: 'التفضيلات'
    };
    return labels[key] || key;
  }

  private formatValue(key: string, value: unknown): string {
    if (value === null || value === undefined || value === '') return 'غير محدد';
    if (key.toLowerCase().includes('document') || key.toLowerCase().includes('certificate') || key === 'commercialRegistration') {
      return this.fileNameOnly(value);
    }
    if (key.toLowerCase().includes('idnumber')) return this.mask(String(value), 3);
    if (Array.isArray(value)) return value.length ? value.map(item => String(item).replace('|', ' — ')).join('، ') : 'غير محدد';
    if (typeof value === 'object') return 'تم تحديث الإعدادات';
    if (value === true) return 'مفعّل';
    if (value === false) return 'غير مفعّل';
    const statuses: Record<string, string> = { AVAILABLE: 'متاح للعمل', BUSY: 'مشغول حاليًا', OFFLINE: 'غير متاح' };
    return statuses[String(value)] || String(value);
  }

  private fileNameOnly(value: unknown): string {
    if (Array.isArray(value)) return value.map(item => this.fileNameOnly(item)).join('، ');
    const raw = String(value || '');
    if (!raw || raw.startsWith('data:')) return 'ملف مرفق';
    try {
      const lastPart = decodeURIComponent(new URL(raw).pathname.split('/').filter(Boolean).pop() || 'ملف مرفق');
      return lastPart.replace(/-\d{10,}(?=\.[^.]+$|$)/, '');
    } catch {
      const lastPart = raw.split(/[\\/]/).pop() || raw;
      return lastPart.replace(/-\d{10,}(?=\.[^.]+$|$)/, '');
    }
  }

  private mask(value: string, visible: number): string {
    if (value.includes('*') || value.length <= visible) return value;
    return `${'*'.repeat(Math.min(12, value.length - visible))}${value.slice(-visible)}`;
  }
}
