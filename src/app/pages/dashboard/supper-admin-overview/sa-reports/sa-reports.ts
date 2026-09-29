import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ComplaintReport, REPORTS, ReportStatus, ReportType, TabKey } from './sa-reports.data';

@Component({
  selector: 'app-sa-reports',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-reports.html',
  styleUrl: './sa-reports.css',
})
export class SaReports {
  toast = signal('');
  activeTab = signal<TabKey>('all');
  searchTerm = signal('');

  readonly tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'new', label: 'جديد' },
    { key: 'investigating', label: 'قيد التحقيق' },
    { key: 'content', label: 'محتوى مخالف' },
    { key: 'fraud', label: 'احتيال' },
    { key: 'behavior', label: 'سلوك مخالف' },
  ];

  readonly typeColors: Record<ReportType, string> = {
    fraud: '#FF8C69', content: '#D98A0B', behavior: '#59C1F5',
  };

  reports = signal<ComplaintReport[]>(REPORTS);

  filteredReports = computed(() => {
    const tab = this.activeTab();
    const q = this.searchTerm().trim().toLowerCase();
    return this.reports().filter((r) => {
      let matchesTab = true;
      if (tab === 'new') matchesTab = r.status === 'new';
      else if (tab === 'investigating') matchesTab = r.status === 'investigating';
      else if (tab !== 'all') matchesTab = r.type === tab;
      const matchesSearch = !q || r.reported.toLowerCase().includes(q) || r.id.toLowerCase().includes(q) || r.reporter.toLowerCase().includes(q);
      return matchesTab && matchesSearch;
    });
  });

  counts = computed(() => {
    const list = this.reports();
    return {
      all: list.length,
      new: list.filter((r) => r.status === 'new').length,
      investigating: list.filter((r) => r.status === 'investigating').length,
      content: list.filter((r) => r.type === 'content').length,
      fraud: list.filter((r) => r.type === 'fraud').length,
      behavior: list.filter((r) => r.type === 'behavior').length,
    };
  });

  kpiResolvedThisMonth = 48;
  kpiAiDetected = 12;

  countFor(key: TabKey): number {
    return this.counts()[key];
  }

  setTab(key: TabKey) {
    this.activeTab.set(key);
  }

  suspendImmediately(report: ComplaintReport) {
    this.setStatus(report, 'actioned', `تم تعليق الحساب المُبلَّغ عنه في البلاغ ${report.id} فوراً`);
  }

  issueWarning(report: ComplaintReport) {
    this.setStatus(report, 'actioned', `تم إرسال تحذير رسمي بخصوص البلاغ ${report.id}`);
  }

  dismiss(report: ComplaintReport) {
    this.setStatus(report, 'dismissed', `تم رفض البلاغ ${report.id}`);
  }

  private setStatus(report: ComplaintReport, status: ReportStatus, msg: string) {
    this.reports.update((list) => list.map((r) => (r.id === report.id ? { ...r, status } : r)));
    this.showToast(msg);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
