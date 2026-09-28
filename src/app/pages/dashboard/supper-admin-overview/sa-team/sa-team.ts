import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

type TeamTab = 'all' | 'support' | 'disputes' | 'content' | 'pending';

interface TeamMember {
  name: string;
  role: string;
  dept: string;
  avatar: string;
  color: string;
  online: boolean;
  tasksOpen: number;
  solved: number;
  score: number;
  tab: TeamTab;
  pending?: boolean;
  email?: string;
  joined?: string;
}

@Component({
  selector: 'app-sa-team',
  standalone: true,
  imports: [CommonModule],
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

  selectedMember = signal<TeamMember | null>(null);
  showDetail = signal(false);

  readonly tabs: { key: TeamTab; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'support', label: 'مشرفو الدعم' },
    { key: 'disputes', label: 'مشرفو النزاعات' },
    { key: 'content', label: 'مشرفو المحتوى' },
    { key: 'pending', label: 'دعوات معلقة' },
  ];

  readonly roles = ['مشرف نزاعات', 'مشرف دعم', 'مشرف محتوى', 'مشرف مالي'];

  members = signal<TeamMember[]>([
    { name: 'هيثم القرني', role: 'مشرف نزاعات', dept: 'النزاعات والبلاغات', avatar: 'ه', color: 'linear-gradient(135deg,#59C1F5,#5DA0FF)', online: true, tasksOpen: 8, solved: 142, score: 94, tab: 'disputes', email: 'haitham.q@waseet.ai', joined: '2024-03-12' },
    { name: 'نوف السهلي', role: 'مشرف دعم', dept: 'الدعم الفني', avatar: 'ن', color: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', online: true, tasksOpen: 5, solved: 89, score: 91, tab: 'support', email: 'nouf.s@waseet.ai', joined: '2024-05-02' },
    { name: 'محمد الشهري', role: 'مشرف محتوى', dept: 'اعتماد التخصصات', avatar: 'م', color: 'linear-gradient(135deg,#FFB400,#D98A0B)', online: false, tasksOpen: 3, solved: 67, score: 88, tab: 'content', email: 'mohammed.sh@waseet.ai', joined: '2024-01-20' },
    { name: 'ريم الحربي', role: 'مشرف دعم', dept: 'الدعم الفني', avatar: 'ر', color: 'linear-gradient(135deg,#FF8C69,#D98A0B)', online: true, tasksOpen: 6, solved: 104, score: 89, tab: 'support', email: 'reem.h@waseet.ai', joined: '2023-11-08' },
    { name: 'خالد المطلق', role: 'مشرف مالي', dept: 'المالية والسحوبات', avatar: 'خ', color: 'linear-gradient(135deg,#0FA99A,#2BD4C7)', online: true, tasksOpen: 4, solved: 58, score: 86, tab: 'all', email: 'khalid.m@waseet.ai', joined: '2024-02-14' },
    { name: 'سارة العتيبي', role: 'مشرف نزاعات', dept: 'النزاعات والبلاغات', avatar: 'س', color: 'linear-gradient(135deg,#5DA0FF,#2BD4C7)', online: false, tasksOpen: 2, solved: 71, score: 82, tab: 'disputes', email: 'sarah.o@waseet.ai', joined: '2024-06-30' },
    { name: 'فهد الرشيدي', role: 'مشرف محتوى', dept: 'اعتماد التخصصات', avatar: 'ف', color: 'linear-gradient(135deg,#59C1F5,#FF8C69)', online: true, tasksOpen: 7, solved: 43, score: 79, tab: 'content', email: 'fahad.r@waseet.ai', joined: '2024-04-17' },
    { name: 'منى الدوسري', role: 'مشرف دعم', dept: 'الدعم الفني', avatar: 'م', color: 'linear-gradient(135deg,#2B7FFF,#59C1F5)', online: false, tasksOpen: 1, solved: 92, score: 90, tab: 'support', email: 'mona.d@waseet.ai', joined: '2023-09-25' },
    { name: 'تركي الشمري', role: 'مشرف مالي', dept: 'المالية والسحوبات', avatar: 'ت', color: 'linear-gradient(135deg,#FFB400,#0FA99A)', online: true, tasksOpen: 9, solved: 38, score: 76, tab: 'all', email: 'turki.sh@waseet.ai', joined: '2024-07-01' },
    { name: 'لمى المالكي', role: 'مشرف نزاعات', dept: 'النزاعات والبلاغات', avatar: 'ل', color: 'linear-gradient(135deg,#FF8C69,#59C1F5)', online: true, tasksOpen: 4, solved: 29, score: 84, tab: 'disputes', email: 'lama.m@waseet.ai', joined: '2024-08-19' },
    { name: 'عبدالله الغامدي', role: 'مشرف محتوى', dept: 'اعتماد التخصصات', avatar: 'ع', color: 'linear-gradient(135deg,#2BD4C7,#FFB400)', online: false, tasksOpen: 3, solved: 51, score: 81, tab: 'content', email: 'abdullah.g@waseet.ai', joined: '2024-03-03' },
    { name: 'رانيا الزهراني', role: 'مشرف دعم', dept: 'الدعم الفني', avatar: 'ر', color: 'linear-gradient(135deg,#5DA0FF,#FF8C69)', online: true, tasksOpen: 5, solved: 77, score: 87, tab: 'support', email: 'rania.z@waseet.ai', joined: '2024-05-27' },
    { name: 'دعوة معلقة', role: 'مشرف نزاعات', dept: '—', avatar: '?', color: 'rgba(255,255,255,.12)', online: false, tasksOpen: 0, solved: 0, score: 0, tab: 'pending', pending: true },
    { name: 'دعوة معلقة', role: 'مشرف دعم', dept: '—', avatar: '?', color: 'rgba(255,255,255,.12)', online: false, tasksOpen: 0, solved: 0, score: 0, tab: 'pending', pending: true },
  ]);

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

  openDetail(member: TeamMember) {
    if (member.pending) return;
    this.selectedMember.set(member);
    this.showDetail.set(true);
  }

  closeDetail() {
    this.showDetail.set(false);
    this.selectedMember.set(null);
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
