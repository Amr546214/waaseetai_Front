import { Component, OnInit, Signal, WritableSignal, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthStore } from '../../../../core/store/auth.store';
import { AccountType } from '../../../../core/models/auth.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { SaUsersService, AdminUser, AdminUsersStats, AdminUsersQueryParams } from './sa-users.service';

@Component({
  selector: 'app-sa-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sa-users.html',
  styleUrl: './sa-users.css'
})
export class SaUsers implements OnInit {
  private usersService = inject(SaUsersService);
  private authStore = inject(AuthStore);

  /** Permanent delete is a SUPER_ADMIN-only action on the server; the control is hidden for other admins. */
  readonly isSuperAdmin = computed(() => this.authStore.currentUser()?.accountType === AccountType.SUPER_ADMIN);
  toast = signal<{ text: string; kind: 'ok' | 'err' } | null>(null);
  loadError = signal('');
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  // Reactive State Signals
  selectedAccountType = signal<string>('all');
  selectedStatus = signal<string>('ALL');
  selectedFinancialRange = signal<string>('ALL');
  selectedRating = signal<string>('ALL');
  selectedJoinedDate = signal<string>('ALL');
  selectedLastActive = signal<string>('ALL');
  searchQuery = signal<string>('');
  currentPage = signal<number>(1);
  limit = signal<number>(15);

  users = signal<AdminUser[]>([]);
  usersStats = signal<AdminUsersStats | null>(null);
  totalUsersCount = signal<number>(0);
  totalPages = signal<number>(1);
  loading = signal<boolean>(false);

  isDropdownOpen: Record<string, boolean> = {};
  private searchSubject = new Subject<string>();

  // Dictionaries for UI badging and colors
  // AI Cleanup Batch 3: the "AI مخاطر" column (and its RL/RC/RB colour maps) was
  // removed. The backend returns aiRiskLevel || 'LOW' / aiRiskScore || 10, but no
  // risk engine ever writes those fields, so every user showed a fake "Low" risk.
  
  SL: Record<string, string> = { active: 'نشط', suspended: 'موقوف', suspended_review: 'معلق مراجعة', pending_verification: 'معلق' };
  SC: Record<string, string> = { active: 's-active', suspended: 's-suspended', suspended_review: 's-pending', pending_verification: 's-pending' };
  
  LC: Record<string, string> = { Bronze: '#CD7F32', Silver: '#A8A9AD', Gold: '#D98A0B', Platinum: '#5DA0FF' };
  LB: Record<string, string> = { Bronze: 'rgba(205,127,50,.12)', Silver: 'rgba(168,169,173,.12)', Gold: 'rgba(255,180,0,.12)', Platinum: 'rgba(93,160,255,.12)' };

  COLS: Record<string, string[]> = {
    'all':       ['المستخدم','النوع','الحالة','آخر نشاط','القيمة المالية','التقييم/المستوى','المشاريع','إجراءات'],
    'sk-ind':    ['المستخدم','الحالة','آخر نشاط','القيمة المالية','المشاريع','عدد الطلبات','آخر طلب','متوسط قيمة الطلب','إجراءات'],
    'sk-co':     ['الشركة','الحالة','آخر نشاط','القيمة المالية','المشاريع','المسؤول','حجم الفريق','ميزانية الشهر الحالي','إجراءات'],
    'pr-ind':    ['المستخدم','الحالة','آخر نشاط','القيمة المالية','التقييم','المستوى','التخصص','المشاريع الجارية','إجمالي الإيرادات','إجراءات'],
    'pr-co':     ['الشركة','الحالة','آخر نشاط','القيمة المالية','عدد المقدمين','التخصصات','المشاريع الجارية','إجمالي الإيرادات','إجراءات'],
    'affiliate': ['المستخدم','الحالة','آخر نشاط','القيمة المالية (عمولات)','المستوى','إجمالي الإحالات','هذا الشهر','نسبة التحويل','إجراءات'],
    'admin':     ['المستخدم','الحالة','آخر دخول','الدور','الدور النشط','مهام جارية','مهام مكتملة','آخر إجراء','إجراءات']
  };

  get currentCols() {
    return this.COLS[this.selectedAccountType()] || this.COLS['all'];
  }

  get currentKPIs() {
    const stats = this.usersStats();
    const tab = this.selectedAccountType();

    const formatNumber = (num?: number) => (num !== undefined ? num.toLocaleString('en-US') : '0');
    // No fabricated numbers: when getStats() genuinely doesn't return a field
    // (e.g. per-account-type spend/orders/commissions/ratings), show an honest
    // placeholder instead — matching the "غير متاح" convention used elsewhere
    // in the codebase (see request-details.ts) rather than inventing a value.
    const NA = 'غير متاح';

    if (!stats) {
      return [
        { ic: 'i-person', bg: 'rgba(43,212,199,.12)', cl: '#2BD4C7', lbl: 'إجمالي المستخدمين', val: '0', sub: 'جاري التحميل...', subCl: '#0FA99A' },
        { ic: 'i-check', bg: 'rgba(15,169,154,.12)', cl: '#0FA99A', lbl: 'نشطون هذا الشهر', val: '0', sub: '0% من الإجمالي', subCl: '#6B7699' },
        { ic: 'i-pause', bg: 'rgba(255,140,105,.12)', cl: '#FF8C69', lbl: 'موقوفون', val: '0', sub: '0 بانتظار مراجعة', subCl: '#D98A0B' },
        { ic: 'i-bell', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'جدد هذا الأسبوع', val: '0', sub: '0% من الأسبوع الماضي', subCl: '#0FA99A' }
      ];
    }

    if (tab === 'sk-ind') {
      return [
        { ic: 'i-person', bg: 'rgba(43,212,199,.12)', cl: '#2BD4C7', lbl: 'طلاب الخدمة الفرد', val: formatNumber(stats.tabCounts['sk-ind']), sub: stats.totalUsers.growth, subCl: '#0FA99A' },
        { ic: 'i-list', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'إجمالي الطلبات', val: NA, sub: 'غير متوفر في الإحصائيات الحالية', subCl: '#6B7699' },
        { ic: 'i-wallet', bg: 'rgba(43,212,199,.12)', cl: '#2BD4C7', lbl: 'إجمالي الإنفاق', val: NA, sub: 'غير متوفر في الإحصائيات الحالية', subCl: '#6B7699' },
        { ic: 'i-bell', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'جدد هذا الأسبوع', val: formatNumber(stats.newThisWeek.count), sub: stats.newThisWeek.growth, subCl: '#0FA99A' }
      ];
    } else if (tab === 'sk-co') {
      return [
        { ic: 'i-person', bg: 'rgba(255,180,0,.12)', cl: '#D98A0B', lbl: 'شركات طالبة', val: formatNumber(stats.tabCounts['sk-co']), sub: stats.totalUsers.growth, subCl: '#0FA99A' },
        { ic: 'i-wallet', bg: 'rgba(255,180,0,.12)', cl: '#FFB400', lbl: 'إجمالي الميزانيات', val: NA, sub: 'غير متوفر في الإحصائيات الحالية', subCl: '#6B7699' },
        { ic: 'i-check', bg: 'rgba(15,169,154,.12)', cl: '#0FA99A', lbl: 'المستخدمون النشطون', val: formatNumber(stats.activeThisMonth.count), sub: stats.activeThisMonth.ratio, subCl: '#6B7699' },
        { ic: 'i-bell', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'شركات جديدة', val: formatNumber(stats.newThisWeek.count), sub: stats.newThisWeek.growth, subCl: '#0FA99A' }
      ];
    } else if (tab === 'pr-ind') {
      return [
        { ic: 'i-person', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'مقدمو الخدمة الفرد', val: formatNumber(stats.tabCounts['pr-ind']), sub: stats.totalUsers.growth, subCl: '#0FA99A' },
        { ic: 'i-wallet', bg: 'rgba(15,169,154,.12)', cl: '#0FA99A', lbl: 'نشطون هذا الشهر', val: formatNumber(stats.activeThisMonth.count), sub: stats.activeThisMonth.ratio, subCl: '#0FA99A' },
        { ic: 'i-check', bg: 'rgba(255,180,0,.12)', cl: '#FFB400', lbl: 'متوسط التقييم', val: NA, sub: 'غير متوفر في الإحصائيات الحالية', subCl: '#6B7699' },
        { ic: 'i-bell', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'مقدمون جدد', val: formatNumber(stats.newThisWeek.count), sub: stats.newThisWeek.growth, subCl: '#0FA99A' }
      ];
    } else if (tab === 'pr-co') {
      return [
        { ic: 'i-person', bg: 'rgba(89,193,245,.12)', cl: '#59C1F5', lbl: 'شركات مقدمة', val: formatNumber(stats.tabCounts['pr-co']), sub: stats.totalUsers.growth, subCl: '#0FA99A' },
        { ic: 'i-wallet', bg: 'rgba(15,169,154,.12)', cl: '#0FA99A', lbl: 'نشطون هذا الشهر', val: formatNumber(stats.activeThisMonth.count), sub: stats.activeThisMonth.ratio, subCl: '#0FA99A' },
        { ic: 'i-escrow', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'الموقوفون والمراجعة', val: formatNumber(stats.suspendedCount.count), sub: `${stats.suspendedCount.pendingReview} بانتظار مراجعة`, subCl: '#6B7699' },
        { ic: 'i-bell', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'شركات جديدة', val: formatNumber(stats.newThisWeek.count), sub: stats.newThisWeek.growth, subCl: '#0FA99A' }
      ];
    } else if (tab === 'affiliate') {
      return [
        { ic: 'i-market', bg: 'rgba(15,169,154,.12)', cl: '#0FA99A', lbl: 'وسطاء تسويقيون', val: formatNumber(stats.tabCounts['affiliate']), sub: stats.totalUsers.growth, subCl: '#0FA99A' },
        { ic: 'i-check', bg: 'rgba(43,212,199,.12)', cl: '#2BD4C7', lbl: 'نشطون هذا الشهر', val: formatNumber(stats.activeThisMonth.count), sub: stats.activeThisMonth.ratio, subCl: '#6B7699' },
        { ic: 'i-wallet', bg: 'rgba(255,180,0,.12)', cl: '#FFB400', lbl: 'عمولات مستحقة', val: NA, sub: 'غير متوفر في الإحصائيات الحالية', subCl: '#6B7699' },
        { ic: 'i-bell', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'وسطاء جدد', val: formatNumber(stats.newThisWeek.count), sub: stats.newThisWeek.growth, subCl: '#0FA99A' }
      ];
    } else if (tab === 'admin') {
      return [
        { ic: 'i-person', bg: 'rgba(255,180,0,.12)', cl: '#FFB400', lbl: 'موظفو الإدارة', val: formatNumber(stats.tabCounts['admin']), sub: 'كل الأدوار', subCl: '#6B7699' },
        { ic: 'i-check', bg: 'rgba(43,212,199,.12)', cl: '#2BD4C7', lbl: 'نشطون هذا الشهر', val: formatNumber(stats.activeThisMonth.count), sub: stats.activeThisMonth.ratio, subCl: '#6B7699' },
        { ic: 'i-bell', bg: 'rgba(15,169,154,.12)', cl: '#0FA99A', lbl: 'جدد هذا الأسبوع', val: formatNumber(stats.newThisWeek.count), sub: stats.newThisWeek.growth, subCl: '#0FA99A' },
        { ic: 'i-shield', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'حالات المراجعة', val: formatNumber(stats.suspendedCount.pendingReview), sub: 'بانتظار الحل', subCl: '#D98A0B' }
      ];
    }

    return [
      { ic: 'i-person', bg: 'rgba(43,212,199,.12)', cl: '#2BD4C7', lbl: 'إجمالي المستخدمين', val: formatNumber(stats.totalUsers.count), sub: stats.totalUsers.growth, subCl: '#0FA99A' },
      { ic: 'i-check', bg: 'rgba(15,169,154,.12)', cl: '#0FA99A', lbl: 'نشطون هذا الشهر', val: formatNumber(stats.activeThisMonth.count), sub: stats.activeThisMonth.ratio, subCl: '#6B7699' },
      { ic: 'i-pause', bg: 'rgba(255,140,105,.12)', cl: '#FF8C69', lbl: 'موقوفون', val: formatNumber(stats.suspendedCount.count), sub: `${stats.suspendedCount.pendingReview} بانتظار مراجعة`, subCl: '#D98A0B' },
      { ic: 'i-bell', bg: 'rgba(43,127,255,.12)', cl: '#5DA0FF', lbl: 'جدد هذا الأسبوع', val: formatNumber(stats.newThisWeek.count), sub: stats.newThisWeek.growth, subCl: '#0FA99A' }
    ];
  }

  ngOnInit() {
    this.fetchStats();
    this.fetchUsers();

    // Setup debounced search subscription (350ms)
    this.searchSubject.pipe(
      debounceTime(350),
      distinctUntilChanged()
    ).subscribe(query => {
      this.searchQuery.set(query);
      this.currentPage.set(1);
      this.fetchUsers();
    });
  }

  onSearchInput(value: string) {
    this.searchSubject.next(value);
  }

  fetchStats() {
    this.usersService.getStats().subscribe({
      next: (res) => {
        if (res.success) {
          this.usersStats.set(res.data);
        }
      },
      error: (err) => console.error('Failed to load user stats:', err)
    });
  }

  fetchUsers() {
    this.loading.set(true);
    this.loadError.set('');
    const params: AdminUsersQueryParams = {
      page: this.currentPage(),
      limit: this.limit(),
      search: this.searchQuery(),
      accountType: this.selectedAccountType(),
      status: this.selectedStatus(),
      financialRange: this.selectedFinancialRange(),
      rating: this.selectedRating(),
      joinedDate: this.selectedJoinedDate(),
      lastActive: this.selectedLastActive()
    };

    this.usersService.getUsers(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.users.set(res.data);
          this.totalUsersCount.set(res.meta.total);
          this.totalPages.set(res.meta.totalPages);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.loadError.set(err?.error?.message || 'تعذر تحميل المستخدمين، حاول مرة أخرى');
        this.loading.set(false);
      }
    });
  }

  setTab(tab: string) {
    this.selectedAccountType.set(tab);
    this.currentPage.set(1);
    this.fetchUsers();
  }

  setStatusFilter(status: string) {
    this.selectedStatus.set(status);
    this.currentPage.set(1);
    this.fetchUsers();
  }

  setFinancialFilter(range: string) {
    this.selectedFinancialRange.set(range);
    this.currentPage.set(1);
    this.fetchUsers();
  }

  setRatingFilter(rating: string) {
    this.selectedRating.set(rating);
    this.currentPage.set(1);
    this.fetchUsers();
  }

  setDateFilter(dateRange: string) {
    this.selectedJoinedDate.set(dateRange);
    this.currentPage.set(1);
    this.fetchUsers();
  }

  setLastActiveFilter(lastActive: string) {
    this.selectedLastActive.set(lastActive);
    this.currentPage.set(1);
    this.fetchUsers();
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
      this.fetchUsers();
    }
  }

  // ── status change: always through a confirmation; suspending needs a written reason (the server refuses without one)
  statusTarget = signal<AdminUser | null>(null);
  statusReason = signal('');
  statusBusy = signal(false);
  statusError = signal('');

  toggleStatus(user: AdminUser) {
    this.closeDropdowns();
    this.statusTarget.set(user);
    this.statusReason.set('');
    this.statusError.set('');
  }

  closeStatusModal() { if (!this.statusBusy()) this.statusTarget.set(null); }

  get statusWillSuspend(): boolean { return this.statusTarget()?.status === 'active'; }

  confirmStatus() {
    const user = this.statusTarget();
    if (!user || this.statusBusy()) return;
    const suspend = user.status === 'active';
    const reason = this.statusReason().trim();
    if (suspend && reason.length < 3) { this.statusError.set('سبب الإيقاف مطلوب (3 أحرف على الأقل)'); return; }
    this.statusBusy.set(true);
    this.usersService.updateUserStatus(user.id, suspend ? 'SUSPENDED' : 'ACTIVE', suspend ? reason : undefined).subscribe({
      next: () => {
        this.statusBusy.set(false);
        this.statusTarget.set(null);
        this.showToast(suspend ? 'تم إيقاف الحساب وتسجيل الإجراء في سجل التدقيق' : 'تم تفعيل الحساب وتسجيل الإجراء في سجل التدقيق', 'ok');
        this.fetchUsers();
        this.fetchStats();
      },
      error: (err) => { this.statusBusy.set(false); this.statusError.set(err?.error?.message || 'تعذر تغيير حالة الحساب'); }
    });
  }

  showToast(text: string, kind: 'ok' | 'err') {
    this.toast.set({ text, kind });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.set(null), 3500);
  }

  isDeleteModalOpen = signal<boolean>(false);
  userToDelete = signal<AdminUser | null>(null);

  openDeleteModal(user: AdminUser) {
    this.userToDelete.set(user);
    this.isDeleteModalOpen.set(true);
    this.closeDropdowns();
  }

  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
    this.userToDelete.set(null);
  }

  confirmDelete() {
    const user = this.userToDelete();
    if (!user) return;
    
    this.usersService.deleteUser(user.id).subscribe({
      next: (res) => {
        if (res.success) {
          this.showToast('تم حذف الحساب', 'ok');
          this.fetchUsers();
          this.fetchStats();
          this.closeDeleteModal();
        }
      },
      error: (err) => {
        this.showToast(err?.error?.message || 'تعذر حذف الحساب. قد لا تملك الصلاحية الكافية.', 'err');
        this.closeDeleteModal();
      }
    });
  }

  toggleDropdown(event: Event, id: string) {
    event.stopPropagation();
    if (this.isDropdownOpen[id]) {
      this.isDropdownOpen[id] = false;
    } else {
      this.isDropdownOpen = {};
      this.isDropdownOpen[id] = true;
    }
  }

  @HostListener('document:click')
  closeDropdowns() {
    this.isDropdownOpen = {};
  }

  exportCSV() {
    const params: AdminUsersQueryParams = {
      search: this.searchQuery(),
      accountType: this.selectedAccountType(),
      status: this.selectedStatus(),
      financialRange: this.selectedFinancialRange(),
      rating: this.selectedRating(),
      joinedDate: this.selectedJoinedDate(),
      lastActive: this.selectedLastActive()
    };
    this.usersService.downloadCsv(params).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'users-export.csv';
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('تم تنزيل ملف المستخدمين', 'ok');
      },
      error: (err) => this.showToast(err?.error?.message || 'تعذر تصدير الملف', 'err')
    });
  }
}
