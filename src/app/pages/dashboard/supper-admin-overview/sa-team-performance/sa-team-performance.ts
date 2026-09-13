import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type Period = 'month' | 'quarter' | 'year';

interface TeamMember {
  name: string;
  role: string;
  avatarColor: string;
  tasks: number;
  sla: number;
  rating: number;
  score: number;
}

interface BenchmarkRow {
  metric: string;
  team: string;
  teamColor: string;
  target: string;
  status: string;
  statusColor: string;
}

@Component({
  selector: 'app-sa-team-performance',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sa-team-performance.html',
  styleUrl: './sa-team-performance.css',
})
export class SaTeamPerformance {
  readonly period = signal<Period>('month');

  readonly months = ['أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر'];
  readonly current = [78, 82, 85, 88, 91, 94];
  readonly previous = [65, 68, 70, 72, 75, 79];

  readonly chartBars = computed(() =>
    this.months.map((m, i) => ({
      label: m.substring(0, 3),
      current: this.current[i],
      previous: this.previous[i],
      currentPct: Math.round((this.current[i] / 100) * 100),
      previousPct: Math.round((this.previous[i] / 100) * 100),
    }))
  );

  readonly members = signal<TeamMember[]>([
    { name: 'هيثم القرني', role: 'مشرف نزاعات', avatarColor: '#A56BE0', tasks: 142, sla: 98, rating: 4.8, score: 94 },
    { name: 'نوف السهلي', role: 'مشرف دعم', avatarColor: '#2BD4C7', tasks: 89, sla: 95, rating: 4.7, score: 91 },
    { name: 'ريم الحربي', role: 'مشرف دعم', avatarColor: '#FF8C69', tasks: 104, sla: 97, rating: 4.6, score: 89 },
    { name: 'محمد الشهري', role: 'مشرف محتوى', avatarColor: '#FFB400', tasks: 67, sla: 93, rating: 4.5, score: 88 },
    { name: 'منى الدوسري', role: 'مشرف دعم', avatarColor: '#5DA0FF', tasks: 92, sla: 96, rating: 4.7, score: 90 },
    { name: 'خالد المطلق', role: 'مشرف مالي', avatarColor: '#0FA99A', tasks: 58, sla: 91, rating: 4.4, score: 86 },
  ]);

  readonly benchmarks: BenchmarkRow[] = [
    { metric: 'معدل إنجاز المهام', team: '87%', teamColor: '#2BD4C7', target: '80%', status: '↑ فوق المعيار', statusColor: '#0FA99A' },
    { metric: 'وقت الرد على التذاكر', team: '3.2h', teamColor: '#2BD4C7', target: '4h', status: '↑ أسرع', statusColor: '#0FA99A' },
    { metric: 'حل النزاعات', team: '7.4 يوم', teamColor: '#FFB400', target: '7 يوم', status: '≈ في المعيار', statusColor: '#FFB400' },
    { metric: 'رضا المستخدم', team: '4.6★', teamColor: '#2BD4C7', target: '4.2★', status: '↑ ممتاز', statusColor: '#0FA99A' },
  ];

  readonly selectedMember = signal<TeamMember | null>(null);
  readonly showDetail = signal(false);

  setPeriod(p: Period) {
    this.period.set(p);
  }

  scoreColor(score: number): string {
    return score >= 90 ? '#0FA99A' : score >= 80 ? '#FFB400' : '#FF8C69';
  }

  openDetail(m: TeamMember) {
    this.selectedMember.set(m);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedMember.set(null);
  }
}
