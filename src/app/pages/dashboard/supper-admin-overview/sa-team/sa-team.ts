import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { WsSelectComponent } from '../../../../shared/forms/select.component';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TEAM_MEMBERS, TeamMember, TeamTab } from './sa-team.data';

@Component({
  selector: 'app-sa-team',
  standalone: true,
  imports: [CommonModule, RouterLink, WsSelectComponent, FormsModule],
  templateUrl: './sa-team.html',
  styleUrl: './sa-team.css',
})
export class SaTeam {
  activeTab = signal<TeamTab>('all');
  searchTerm = signal('');
  roleFilter = signal('');
  statusFilter = signal('');
  showInvite = signal(false);
  inviteEmail = signal('');
  inviteRole = signal('مشرف دعم');
  toast = signal('');

  readonly tabs: { key: TeamTab; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'support', label: 'مشرفو الدعم' },
    { key: 'disputes', label: 'مشرفو النزاعات' },
    { key: 'content', label: 'مشرفو المحتوى' },
    { key: 'pending', label: 'دعوات معلقة' },
  ];

  readonly roles = ['مشرف نزاعات', 'مشرف دعم', 'مشرف محتوى', 'مشرف مالي'];

  // MOCK — see sa-team.data.ts
  members = signal<TeamMember[]>(TEAM_MEMBERS);

  totalCount = computed(() => this.members().filter((m) => !m.pending).length);
  onlineCount = computed(() => this.members().filter((m) => m.online && !m.pending).length);
  pendingCount = computed(() => this.members().filter((m) => m.pending).length);
  openTasksCount = computed(() => this.members().reduce((s, m) => s + m.tasksOpen, 0));
  avgScore = computed(() => {
    const active = this.members().filter((m) => !m.pending);
    if (!active.length) return 0;
    return Math.round(active.reduce((s, m) => s + m.score, 0) / active.length);
  });

  heavyLoad = computed(() => this.members().filter((m) => !m.pending && m.tasksOpen > 8).length);
  mediumLoad = computed(() => this.members().filter((m) => !m.pending && m.tasksOpen >= 4 && m.tasksOpen <= 7).length);
  lightLoad = computed(() => this.members().filter((m) => !m.pending && m.tasksOpen < 4).length);
  avgTasksPerMember = computed(() => {
    const active = this.members().filter((m) => !m.pending);
    if (!active.length) return '0';
    return (active.reduce((s, m) => s + m.tasksOpen, 0) / active.length).toFixed(1);
  });

  filteredMembers = computed(() => {
    const tab = this.activeTab();
    const q = this.searchTerm().trim().toLowerCase();
    const role = this.roleFilter();
    const status = this.statusFilter();

    let list = tab === 'all' ? this.members().filter((m) => !m.pending) : this.members().filter((m) => (tab === 'pending' ? m.pending : m.tab === tab));

    if (q) list = list.filter((m) => m.name.toLowerCase().includes(q));
    if (role) list = list.filter((m) => m.role === role);
    if (status) list = list.filter((m) => (status === 'نشط' ? m.online : !m.online));

    return list;
  });

  scoreColor(score: number): string {
    if (score >= 90) return '#0FA99A';
    if (score >= 80) return '#FFB400';
    return '#FF8C69';
  }

  setTab(tab: TeamTab) {
    this.activeTab.set(tab);
  }

  openInvite() {
    this.showInvite.set(true);
  }

  closeInvite() {
    this.showInvite.set(false);
    this.inviteEmail.set('');
    this.inviteRole.set('مشرف دعم');
  }

  sendInvite() {
    const email = this.inviteEmail().trim();
    if (!email) return;
    this.members.update((list) => [
      ...list,
      { name: 'دعوة معلقة', role: this.inviteRole(), dept: '—', avatar: '?', color: 'rgba(255,255,255,.12)', online: false, tasksOpen: 0, solved: 0, score: 0, tab: 'pending', pending: true },
    ]);
    this.showToast(`تم إرسال دعوة إلى ${email}`);
    this.closeInvite();
  }

  showToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 3000);
  }
}
