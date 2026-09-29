import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type TaskTab = 'open' | 'pending' | 'done' | 'all';
type TaskColumn = 'new' | 'progress' | 'overdue' | 'done';

interface AdminTask {
  id: string;
  title: string;
  type: string;
  assignee: string;
  priority: string;
  priorityColor: string;
  priorityBg: string;
  due: string;
  dueColor: string;
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  tab: TaskTab;
  column: TaskColumn;
}

@Component({
  selector: 'app-sa-tasks',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-tasks.html',
  styleUrl: './sa-tasks.css',
})
export class SaTasks {
  readonly tabs: { key: TaskTab; label: string }[] = [
    { key: 'open', label: 'جارية' },
    { key: 'pending', label: 'معلقة' },
    { key: 'done', label: 'مكتملة' },
    { key: 'all', label: 'الكل' },
  ];

  readonly tasks = signal<AdminTask[]>([
    { id: 'T-0241', title: 'حل نزاع D-248', type: 'نزاع', assignee: 'هيثم القرني', priority: 'عالية', priorityColor: '#FF8C69', priorityBg: 'rgba(255,140,105,.10)', due: 'اليوم', dueColor: '#FF8C69', statusLabel: 'جارٍ', statusColor: '#FFB400', statusBg: 'rgba(255,180,0,.10)', tab: 'open', column: 'progress' },
    { id: 'T-0240', title: 'مراجعة بلاغ FL-0482', type: 'بلاغ', assignee: 'هيثم القرني', priority: 'عالية', priorityColor: '#FF8C69', priorityBg: 'rgba(255,140,105,.10)', due: 'اليوم', dueColor: '#D98A0B', statusLabel: 'جارٍ', statusColor: '#FFB400', statusBg: 'rgba(255,180,0,.10)', tab: 'open', column: 'progress' },
    { id: 'T-0239', title: 'تذكرة دعم TK-2841 (SLA متأخر)', type: 'دعم', assignee: 'نوف السهلي', priority: 'عاجلة', priorityColor: '#FF5050', priorityBg: 'rgba(255,80,80,.10)', due: 'متأخر!', dueColor: '#FF5050', statusLabel: 'جارٍ', statusColor: '#FFB400', statusBg: 'rgba(255,180,0,.10)', tab: 'open', column: 'overdue' },
    { id: 'T-0238', title: 'اعتماد طلبات التخصص (9)', type: 'اعتماد', assignee: 'محمد الشهري', priority: 'متوسطة', priorityColor: '#D98A0B', priorityBg: 'rgba(255,180,0,.10)', due: '20 سبتمبر', dueColor: '#D98A0B', statusLabel: 'معلق', statusColor: '#5DA0FF', statusBg: 'rgba(43,127,255,.10)', tab: 'pending', column: 'new' },
    { id: 'T-0237', title: 'مراجعة سحوبات الأسبوع', type: 'مالي', assignee: 'خالد المطلق', priority: 'عادية', priorityColor: '#6B7699', priorityBg: 'rgba(255,255,255,.06)', due: '22 سبتمبر', dueColor: '#6B7699', statusLabel: 'معلق', statusColor: '#5DA0FF', statusBg: 'rgba(43,127,255,.10)', tab: 'pending', column: 'new' },
    { id: 'T-0236', title: 'تقرير أداء الفريق سبتمبر', type: 'تقرير', assignee: 'مدير النظام', priority: 'منخفضة', priorityColor: '#6B7699', priorityBg: 'rgba(255,255,255,.06)', due: '30 سبتمبر', dueColor: '#6B7699', statusLabel: 'معلق', statusColor: '#5DA0FF', statusBg: 'rgba(43,127,255,.10)', tab: 'pending', column: 'new' },
    { id: 'T-0235', title: 'حل نزاع D-244', type: 'نزاع', assignee: 'هيثم القرني', priority: 'عادية', priorityColor: '#6B7699', priorityBg: 'rgba(255,255,255,.06)', due: 'مكتمل', dueColor: '#0FA99A', statusLabel: 'مكتمل', statusColor: '#0FA99A', statusBg: 'rgba(15,169,154,.10)', tab: 'done', column: 'done' },
    { id: 'T-0234', title: 'إغلاق تذكرة TK-2830', type: 'دعم', assignee: 'ريم الحربي', priority: 'عادية', priorityColor: '#6B7699', priorityBg: 'rgba(255,255,255,.06)', due: 'مكتمل', dueColor: '#0FA99A', statusLabel: 'مكتمل', statusColor: '#0FA99A', statusBg: 'rgba(15,169,154,.10)', tab: 'done', column: 'done' },
  ]);

  readonly activeTab = signal<TaskTab>('open');
  readonly searchQuery = signal('');
  readonly employeeFilter = signal('all');
  readonly typeFilter = signal('all');

  readonly selectedTask = signal<AdminTask | null>(null);
  readonly showDetail = signal(false);

  readonly employees = computed(() => Array.from(new Set(this.tasks().map((t) => t.assignee))));
  readonly types = computed(() => Array.from(new Set(this.tasks().map((t) => t.type))));

  readonly filteredTasks = computed(() => {
    const tab = this.activeTab();
    const query = this.searchQuery().trim().toLowerCase();
    const employee = this.employeeFilter();
    const type = this.typeFilter();

    return this.tasks().filter((t) => {
      const matchesTab = tab === 'all' || t.tab === tab;
      const matchesQuery = !query || t.title.toLowerCase().includes(query) || t.id.toLowerCase().includes(query);
      const matchesEmployee = employee === 'all' || t.assignee === employee;
      const matchesType = type === 'all' || t.type === type;
      return matchesTab && matchesQuery && matchesEmployee && matchesType;
    });
  });

  readonly tabLabel = computed(() => {
    const tab = this.activeTab();
    return tab === 'open' ? 'المهام الجارية' : tab === 'pending' ? 'المهام المعلقة' : tab === 'done' ? 'المهام المكتملة' : 'كل المهام';
  });

  readonly kanbanColumns: { key: TaskColumn; label: string; color: string; bg: string; border: string }[] = [
    { key: 'new', label: 'جديدة', color: '#6B7699', bg: 'rgba(255,255,255,.02)', border: 'rgba(255,255,255,.07)' },
    { key: 'progress', label: 'جارية', color: '#5DA0FF', bg: 'rgba(43,127,255,.04)', border: 'rgba(43,127,255,.14)' },
    { key: 'overdue', label: 'متأخرة ⚠', color: '#FFB400', bg: 'rgba(255,180,0,.04)', border: 'rgba(255,180,0,.14)' },
    { key: 'done', label: 'مكتملة', color: '#0FA99A', bg: 'rgba(15,169,154,.04)', border: 'rgba(15,169,154,.14)' },
  ];

  readonly kanbanGroups = computed(() => {
    const all = this.tasks();
    return this.kanbanColumns.map((col) => ({
      ...col,
      items: all.filter((t) => t.column === col.key),
    }));
  });

  // Real per-employee open-task counts, derived from the actual `tasks` list
  // (grouped by assignee, counting non-completed tasks) instead of a
  // hardcoded array that could drift from the real data.
  private readonly workloadColors = ['#FF8C69', '#FFB400', '#0FA99A', '#5DA0FF', '#2BD4C7'];

  readonly workload = computed(() => {
    const counts = new Map<string, number>();
    for (const t of this.tasks()) {
      if (t.tab === 'done') continue;
      counts.set(t.assignee, (counts.get(t.assignee) ?? 0) + 1);
    }
    const maxCount = Math.max(1, ...Array.from(counts.values()));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count], i) => ({
        name,
        count,
        pct: Math.round((count / maxCount) * 100),
        color: this.workloadColors[i % this.workloadColors.length],
      }));
  });

  setTab(tab: TaskTab) {
    this.activeTab.set(tab);
  }

  openDetail(task: AdminTask) {
    this.selectedTask.set(task);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedTask.set(null);
  }
}
