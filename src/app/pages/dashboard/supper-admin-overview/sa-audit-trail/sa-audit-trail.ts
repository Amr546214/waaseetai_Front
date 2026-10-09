import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AnomalySummaryComponent } from './anomaly-summary.component';

interface AuditEvent {
  type: string;
  color: string;
  bg: string;
  actor: string;
  actorColor: string;
  action: string;
  detail: string;
  time: string;
  /** Real event date (YYYY-MM-DD) used for from/to date-range filtering; `time` is only the human-readable relative label. */
  date: string;
  suspicious?: boolean;
}

@Component({
  selector: 'app-sa-audit-trail',
  standalone: true,
  imports: [CommonModule, RouterLink, AnomalySummaryComponent, WsSelectComponent, FormsModule],
  templateUrl: './sa-audit-trail.html',
  styleUrl: './sa-audit-trail.css',
})
export class SaAuditTrail {
  readonly actionTypes = ['كل العمليات', 'تعديل مستخدم', 'إجراء مالي', 'تغيير إعدادات', 'قبول/رفض', 'تسجيل دخول', '⚠ مشبوه'];
  readonly employees = ['كل الموظفين', 'مدير النظام', 'هيثم القرني', 'ريم الحربي', 'فهد العتيبي'];

  readonly typeFilter = signal('كل العمليات');
  readonly employeeFilter = signal('كل الموظفين');
  readonly searchQuery = signal('');
  readonly fromDate = signal('2026-08-01');
  readonly toDate = signal('2026-09-12');

  readonly events = signal<AuditEvent[]>([
    { type: 'تعديل مستخدم', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', actor: 'مدير النظام', actorColor: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', action: 'تعليق حساب عبدالرحمن الدوسري (U-00412)', detail: 'سبب: بلاغ احتيال مالي RPT-2026-0483 · IP: 197.32.14.88', time: 'قبل 18 دقيقة', date: '2026-09-12' },
    { type: 'إجراء مالي', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', actor: 'ريم الحربي', actorColor: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', action: 'الموافقة على طلب سحب TXN-9841 (1,850 $)', detail: 'لنورة السهلي · عبر PayPal · تم التحقق', time: 'قبل 42 دقيقة', date: '2026-09-12' },
    { type: 'قبول/رفض', color: '#2BD4C7', bg: 'rgba(43,212,199,.10)', actor: 'هيثم القرني', actorColor: 'linear-gradient(135deg,#FFB400,#FF8C69)', action: 'قبول حساب جديد ACC-2026-0839', detail: 'مقدم خدمة فرد · برمجة تطبيقات · بعد مراجعة الوثائق', time: 'قبل 1.5 ساعة', date: '2026-09-12' },
    { type: 'تغيير إعدادات', color: '#FFB400', bg: 'rgba(255,180,0,.12)', actor: 'مدير النظام', actorColor: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', action: 'تعديل نسبة رسوم النظام من 10% إلى 10%', detail: 'لم يتغير المبلغ · تحديث توثيقي فقط', time: 'قبل 3 ساعات', date: '2026-09-12' },
    { type: '⚠ مشبوه', color: '#FF8C69', bg: 'rgba(255,140,105,.14)', actor: 'فهد العتيبي', actorColor: 'linear-gradient(135deg,#FF8C69,#59C1F5)', action: 'تعديل إعدادات الرسوم الحكومية المستقبلية خارج أوقات الدوام', detail: 'IP: 185.220.101.42 (VPN غير معروف) · الساعة 02:14 ص', time: 'قبل 6 ساعات', date: '2026-09-12', suspicious: true },
    { type: 'تسجيل دخول', color: '#6B7699', bg: 'rgba(255,255,255,.08)', actor: 'ريم الحربي', actorColor: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', action: 'تسجيل دخول ناجح للوحة الإدارة', detail: 'IP: 197.32.14.99 · Chrome 129 · Windows 11 · الرياض', time: 'قبل 8 ساعات', date: '2026-09-12' },
    { type: 'إجراء مالي', color: '#0FA99A', bg: 'rgba(15,169,154,.12)', actor: 'مدير النظام', actorColor: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', action: 'إفراج عن ضمان PR-1301 دفعة ثانية 5,400 $', detail: 'لنورة السهلي بعد إتمام المرحلة 2', time: 'قبل 9 ساعات', date: '2026-09-12' },
    { type: 'قبول/رفض', color: '#FF6B6B', bg: 'rgba(255,107,107,.10)', actor: 'هيثم القرني', actorColor: 'linear-gradient(135deg,#FFB400,#FF8C69)', action: 'رفض طلب اعتماد تخصص للمستخدم U-04821', detail: 'سبب: الشهادات غير موثوقة + AI Score 42/100', time: 'قبل 11 ساعة', date: '2026-09-12' },
    { type: 'تعديل مستخدم', color: '#5DA0FF', bg: 'rgba(43,127,255,.12)', actor: 'مدير النظام', actorColor: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', action: 'رفع صلاحية هيثم القرني إلى مشرف نزاعات', detail: 'من: موظف دعم → إلى: مشرف نزاعات', time: 'أمس، 04:30 م', date: '2026-09-11' },
    { type: 'تغيير إعدادات', color: '#FFB400', bg: 'rgba(255,180,0,.12)', actor: 'مدير النظام', actorColor: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', action: 'تحديث قالب إشعار قبول الحساب', detail: 'AR + EN · SMS + Email · نشط فوراً', time: 'أمس، 02:15 م', date: '2026-09-11' },
  ]);

  readonly filteredEvents = computed(() => {
    const type = this.typeFilter();
    const employee = this.employeeFilter();
    const query = this.searchQuery().trim().toLowerCase();
    const from = this.fromDate();
    const to = this.toDate();
    return this.events().filter((e) => {
      const matchesType = type === 'كل العمليات' || e.type === type;
      const matchesEmployee = employee === 'كل الموظفين' || e.actor === employee;
      const matchesQuery = !query || e.action.toLowerCase().includes(query) || e.detail.toLowerCase().includes(query);
      const matchesFrom = !from || e.date >= from;
      const matchesTo = !to || e.date <= to;
      return matchesType && matchesEmployee && matchesQuery && matchesFrom && matchesTo;
    });
  });

  exportCsv() {
    const rows = ['النوع,الموظف,الإجراء,التاريخ'];
    this.events().forEach((e) => rows.push(`${e.type},${e.actor},"${e.action}",${e.time}`));
    const csv = '﻿' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
