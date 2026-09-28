import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface Role {
  name: string;
  color: string;
  perms: number;
  members: number;
  desc: string;
}

interface AuditEntry {
  time: string;
  text: string;
  actor: string;
  kind: 'added' | 'removed' | 'new' | 'edited';
}

@Component({
  selector: 'app-sa-roles',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-roles.html',
  styleUrl: './sa-roles.css',
})
export class SaRoles {
  toast = signal('');
  editingRole = signal<Role | null>(null);

  roles = signal<Role[]>([
    { name: 'Super Admin', color: '#FF8C69', perms: 15, members: 1, desc: 'تحكم كامل — مالك وسيط AI' },
    { name: 'مدير فريق', color: '#D98A0B', perms: 11, members: 2, desc: 'يدير الموظفين ويوزع المهام' },
    { name: 'مشرف نزاعات', color: '#59C1F5', perms: 8, members: 4, desc: 'يحل النزاعات ويراجع البلاغات' },
    { name: 'مشرف دعم', color: '#2BD4C7', perms: 6, members: 5, desc: 'يعالج تذاكر الدعم الفني' },
    { name: 'مشرف محتوى', color: '#5DA0FF', perms: 5, members: 3, desc: 'يعتمد التخصصات والملفات' },
    { name: 'مشرف مالي', color: '#0FA99A', perms: 4, members: 2, desc: 'يراجع السحوبات والمعاملات' },
  ]);

  readonly permissionLabels = [
    'عرض المستخدمين',
    'تعليق المستخدمين',
    'حذف الحسابات',
    'حل النزاعات',
    'عرض البلاغات',
    'مراجعة الدعم',
    'اعتماد التخصصات',
    'تعديل الباقات',
    'الموافقة على السحوبات',
    'عرض التقارير المالية',
    'إدارة الصلاحيات',
    'Audit Trail',
    'تعديل الإعدادات',
  ];

  // matrix[permissionIndex][roleIndex] = 1 | 0, aligned with `roles` order above
  readonly matrix: number[][] = [
    [1, 1, 1, 1, 0, 0],
    [1, 1, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
    [1, 1, 1, 0, 0, 0],
    [1, 1, 1, 1, 0, 0],
    [1, 1, 0, 1, 0, 0],
    [1, 1, 0, 0, 1, 0],
    [1, 1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 1],
    [1, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0],
  ];

  auditTrail: AuditEntry[] = [
    { time: 'منذ 2h', text: 'مدير النظام أضاف صلاحية <strong>مراجعة النزاعات</strong> لدور "مشرف دعم"', actor: 'مدير النظام', kind: 'added' },
    { time: 'أمس', text: 'هيثم القرني حُذفت منه صلاحية <strong>Super Admin Access</strong>', actor: 'هيثم القرني', kind: 'removed' },
    { time: '3 أيام', text: 'أُنشئ دور جديد "مراجع بلاغات" مع 5 صلاحيات', actor: 'مدير النظام', kind: 'new' },
    { time: 'أسبوع', text: 'صلاحية "تعديل الباقات" نُقلت من "مشرف" → "Super Admin" فقط', actor: 'مدير النظام', kind: 'edited' },
  ];

  readonly auditKindLabels: Record<AuditEntry['kind'], string> = {
    added: 'أُضيفت',
    removed: 'حُذفت',
    new: 'دور جديد',
    edited: 'تعديل',
  };

  openEdit(role: Role) {
    this.editingRole.set(role);
  }

  closeEdit() {
    this.editingRole.set(null);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }

  addRole() {
    this.showToast('فتح نموذج إضافة دور جديد');
  }
}
