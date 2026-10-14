import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AdminConsoleApiService, AdminRosterItem } from '../../../../core/services/admin-console-api.service';

interface Role {
  key: 'SUPER_ADMIN' | 'ADMIN';
  name: string;
  color: string;
  desc: string;
}

/**
 * Roles are a fixed pair in the backend (AccountType ADMIN / SUPER_ADMIN, enforced by authorize() on the routes); there is no role or
 * permission table, so roles/permissions cannot be created or edited. This page shows the real fixed roles read-only, with real member counts.
 */
@Component({
  selector: 'app-sa-roles',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-roles.html',
  styleUrl: './sa-roles.css',
})
export class SaRoles implements OnInit {
  private readonly api = inject(AdminConsoleApiService);

  readonly readOnlyReason = 'غير متاح: الأدوار ثابتة في النظام (مسؤول / مسؤول أعلى) ولا يوجد نموذج بيانات لإنشاء الأدوار أو تعديل صلاحياتها';

  readonly roles: Role[] = [
    { key: 'SUPER_ADMIN', name: 'مسؤول أعلى (Super Admin)', color: '#FF8C69', desc: 'وصول كامل إلى لوحة الإدارة، وهو الدور الوحيد المسموح له بحذف حسابات المستخدمين' },
    { key: 'ADMIN', name: 'مسؤول (Admin)', color: '#59C1F5', desc: 'وصول إلى لوحة الإدارة وإدارة المستخدمين (عرض، تصدير، تغيير حالة الحساب) دون صلاحية حذف الحسابات' },
  ];

  /** Rows that the server code actually enforces; [SUPER_ADMIN, ADMIN]. */
  readonly matrix: { label: string; grants: [boolean, boolean] }[] = [
    { label: 'الدخول إلى لوحة الإدارة', grants: [true, true] },
    { label: 'عرض المستخدمين وتصديرهم وتغيير حالة الحساب', grants: [true, true] },
    { label: 'حذف حسابات المستخدمين', grants: [true, false] },
  ];

  readonly admins = signal<AdminRosterItem[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly counts = computed(() => ({
    SUPER_ADMIN: this.admins().filter((a) => a.accountType === 'SUPER_ADMIN').length,
    ADMIN: this.admins().filter((a) => a.accountType === 'ADMIN').length,
  }));

  ngOnInit(): void {
    this.api.getAdmins().subscribe({
      next: (r) => { this.admins.set(r.data ?? []); this.loading.set(false); },
      error: () => { this.failed.set(true); this.loading.set(false); },
    });
  }
}
