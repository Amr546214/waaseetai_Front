import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  DeliverableFilter,
  DeliverableStatus,
  Project,
  PROJECTS,
  PROJECT_RISK_CLASSES,
  PROJECT_RISK_LABELS,
  PROJECT_STATUS_CLASSES,
  PROJECT_STATUS_LABELS,
} from '../sa-projects.data';

@Component({
  selector: 'app-sa-project-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './sa-project-detail.html',
  styleUrls: ['../sa-projects.css', './sa-project-detail.css'],
})
export class SaProjectDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  readonly statusLabels = PROJECT_STATUS_LABELS;
  readonly statusClasses = PROJECT_STATUS_CLASSES;
  readonly riskLabels = PROJECT_RISK_LABELS;
  readonly riskClasses = PROJECT_RISK_CLASSES;

  readonly deliverableStatusLabels: Record<DeliverableStatus, string> = {
    accepted: 'مقبول',
    pending: 'قيد المراجعة',
    rejected: 'مرفوض',
  };
  readonly deliverableStatusClasses: Record<DeliverableStatus, string> = {
    accepted: 'pj-dstatus-accepted',
    pending: 'pj-dstatus-pending',
    rejected: 'pj-dstatus-rejected',
  };

  readonly deliverableTabs: { key: DeliverableFilter; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'accepted', label: 'مقبولة' },
    { key: 'pending', label: 'قيد المراجعة' },
    { key: 'rejected', label: 'مرفوضة' },
  ];

  selected = signal<Project | null>(null);
  notFound = signal(false);
  actionMessage = signal('');
  deliverableFilter = signal<DeliverableFilter>('all');

  filteredDeliverables = computed(() => {
    const d = this.selected();
    if (!d) return [];
    const f = this.deliverableFilter();
    return f === 'all' ? d.deliverables : d.deliverables.filter((x) => x.status === f);
  });

  deliverableCounts = computed(() => {
    const d = this.selected();
    const c: Record<DeliverableFilter, number> = { all: 0, accepted: 0, pending: 0, rejected: 0 };
    if (!d) return c;
    c.all = d.deliverables.length;
    for (const item of d.deliverables) c[item.status]++;
    return c;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      // Mock-only: look the project up in the shared mock array by id.
      const found = id ? PROJECTS.find((x) => String(x.id) === id) ?? null : null;
      this.selected.set(found);
      this.notFound.set(!found);
      this.actionMessage.set('');
      this.deliverableFilter.set('all');
    });
  }

  goBack(): void {
    this.router.navigate(['/supper-admin-overview/projects']);
  }

  setDeliverableFilter(f: DeliverableFilter) {
    this.deliverableFilter.set(f);
  }

  extendDeadline() {
    this.actionMessage.set('تم تمديد مهلة المشروع بنجاح');
  }

  messageParties() {
    this.actionMessage.set('تم إرسال إشعار لطرفي المشروع');
  }

  escalate() {
    const item = this.selected();
    if (!item) return;
    this.actionMessage.set('تم تصعيد المشروع إلى قسم النزاعات');
  }
}
