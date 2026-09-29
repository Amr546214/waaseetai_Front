import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ChecklistState, ComplaintReport, IpStatus, REPORTS, ReportStatus } from '../sa-reports.data';

@Component({
  selector: 'app-sa-report-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-report-detail.html',
  styleUrls: ['../sa-reports.css', './sa-report-detail.css'],
})
export class SaReportDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  toast = signal('');
  selected = signal<ComplaintReport | null>(null);
  notFound = signal(false);

  readonly ipStatusLabel: Record<IpStatus, string> = {
    blocked: 'محجوب', normal: 'طبيعي', shared: 'مُشترك',
  };

  readonly checklistIcon: Record<ChecklistState, string> = {
    done: '✓', pending: '⏳', todo: '◯',
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      // Mock-only: look the report up in the shared mock array by id.
      const found = id ? REPORTS.find((x) => String(x.id) === id) ?? null : null;
      this.selected.set(found);
      this.notFound.set(!found);
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/reports']);
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

  markInvestigating(report: ComplaintReport) {
    this.setStatus(report, 'investigating', `تم نقل البلاغ ${report.id} لقيد التحقيق`);
  }

  // Mock-only: status changes update this page's local copy of the report (no
  // backend endpoint), so they don't persist on navigation.
  private setStatus(report: ComplaintReport, status: ReportStatus, msg: string) {
    this.selected.update((r) => (r && r.id === report.id ? { ...r, status } : r));
    this.showToast(msg);
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
