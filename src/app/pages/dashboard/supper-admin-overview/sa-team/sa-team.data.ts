// MOCK data for the super-admin team (platform employee monitoring) list +
// member detail page. There is no admin-team backend endpoint yet; both SaTeam
// (list) and SaTeamMemberDetail (routed `team/:id` page) read from this shared
// array. Members have no `id` field, so the routed `:id` is the member's
// (unique) `email`; pending invites have no email and are not clickable.

export type TeamTab = 'all' | 'support' | 'disputes' | 'content' | 'pending';
export type DetailTab = 'overview' | 'tasks' | 'perms' | 'log';

export interface TeamTaskRow {
  title: string;
  type: string;
  priority: { label: string; color: string; bg: string };
  due: { label: string; color: string };
  status: { label: string; color: string; bg: string };
}

export interface TeamPermRow {
  label: string;
  granted: boolean;
}

export interface TeamLogRow {
  action: string;
  time: string;
  color: string;
}

export interface TeamCaseRow {
  case: string;
  outcome: string;
  color: string;
  bg: string;
}

export interface TeamMetricRow {
  label: string;
  value: number;
  from: string;
  to: string;
  color: string;
}

export interface TeamCsat {
  avg: number;
  satisfaction: number;
  total: number;
  breakdown: { stars: string; pct: number; color: string }[];
}

export interface TeamPerfHistory {
  months: string[];
  values: number[];
  avg: number;
  trendUp: boolean;
}

export interface TeamQuickLink {
  label: string;
  tab: DetailTab;
  highlight: boolean;
}

export interface TeamMember {
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

export const TEAM_MEMBERS: TeamMember[] = [
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
];
