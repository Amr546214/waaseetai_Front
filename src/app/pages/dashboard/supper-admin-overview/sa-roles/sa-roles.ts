import { Component, computed, signal } from '@angular/core';
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
  editName = signal('');
  editDesc = signal('');

  private readonly newRoleColors = ['#FF8C69', '#D98A0B', '#59C1F5', '#2BD4C7', '#5DA0FF', '#0FA99A', '#9B8AFB', '#F472B6'];

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
  matrix = signal<number[][]>([
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
  ]);

  // roles with `perms` recomputed live from the matrix, so the count shown on each
  // card always matches what's actually toggled on in the table below.
  rolesView = computed(() => {
    const mx = this.matrix();
    return this.roles().map((r, ri) => ({
      ...r,
      perms: mx.reduce((sum, row) => sum + (row[ri] ? 1 : 0), 0),
    }));
  });

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
    this.editName.set(role.name);
    this.editDesc.set(role.desc);
  }

  closeEdit() {
    this.editingRole.set(null);
    this.editName.set('');
    this.editDesc.set('');
  }

  saveEdit() {
    const role = this.editingRole();
    if (!role) return;
    const newName = this.editName().trim();
    const newDesc = this.editDesc().trim();
    if (!newName) {
      this.showToast('اسم الدور مطلوب');
      return;
    }
    const originalName = role.name;
    this.roles.update((roles) => roles.map((r) => (r.name === originalName ? { ...r, name: newName, desc: newDesc } : r)));
    this.pushAudit(`تم تعديل دور "${originalName}"${newName !== originalName ? ` إلى "${newName}"` : ''}`, 'edited');
    this.showToast(`تم حفظ التعديلات على دور ${newName}`);
    this.closeEdit();
  }

  togglePermission(pi: number, ri: number) {
    this.matrix.update((mx) => {
      const next = mx.map((row) => [...row]);
      next[pi][ri] = next[pi][ri] ? 0 : 1;
      return next;
    });
    const granted = !!this.matrix()[pi][ri];
    const role = this.roles()[ri];
    const permLabel = this.permissionLabels[pi];
    if (role) {
      this.pushAudit(
        `${granted ? 'أُضيفت' : 'حُذفت'} صلاحية <strong>${permLabel}</strong> ${granted ? 'لدور' : 'من دور'} "${role.name}"`,
        granted ? 'added' : 'removed',
      );
    }
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }

  addRole() {
    const name = window.prompt('اسم الدور الجديد:');
    if (!name || !name.trim()) return;
    const trimmedName = name.trim();
    if (this.roles().some((r) => r.name === trimmedName)) {
      this.showToast('يوجد دور بنفس الاسم بالفعل');
      return;
    }
    const desc = (window.prompt('وصف الدور (اختياري):') || '').trim();
    const color = this.newRoleColors[this.roles().length % this.newRoleColors.length];

    this.roles.update((roles) => [...roles, { name: trimmedName, color, perms: 0, members: 0, desc }]);
    this.matrix.update((mx) => mx.map((row) => [...row, 0]));
    this.pushAudit(`أُنشئ دور جديد "${trimmedName}"`, 'new');
    this.showToast(`تمت إضافة دور "${trimmedName}"`);
  }

  private pushAudit(text: string, kind: AuditEntry['kind']) {
    this.auditTrail = [{ time: 'الآن', text, actor: 'أنت', kind }, ...this.auditTrail];
  }
}
