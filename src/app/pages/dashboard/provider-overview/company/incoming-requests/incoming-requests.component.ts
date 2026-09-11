import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface IncomingRequest {
	id: string;
	tplName: string;
	client: string;
	clientInitials: string;
	clientColor: string;
	tplType: string;
	budget: number;
	days: number;
	arrivedAt: string;
	status: 'new' | 'assigned' | 'negotiate' | 'done';
	assignedMember?: string;
	aiSuggestedMember?: string;
	aiMatch?: number;
}

interface TeamMember {
	id: string;
	name: string;
	specialty: string;
	color: string;
	initials: string;
	match?: number;
	busy?: boolean;
}

@Component({
	selector: 'app-incoming-requests',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './incoming-requests.component.html',
	styleUrls: ['./incoming-requests.component.css']
})
export class IncomingRequestsComponent {
	activeTab = signal<string>('all');
	activeTpl = signal<string>('all');
	activeMember = signal<string>('all');
	searchQuery = signal<string>('');
	toast = signal<string | null>(null);
	assigningFor = signal<string | null>(null);

	teamMembers: TeamMember[] = [
		{ id: 'sara', name: 'سارة الزهراني', specialty: 'مصممة UI/UX', color: 'linear-gradient(135deg,#A56BE0,#7B2FBE)', initials: 'سا' },
		{ id: 'fahad', name: 'فهد العتيبي', specialty: 'مطوّر ويب', color: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)', initials: 'فه' },
		{ id: 'reem', name: 'ريم الدوسري', specialty: 'مطوّرة تطبيقات', color: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', initials: 'ري' },
		{ id: 'nawaf', name: 'نواف الحربي', specialty: 'كاتب محتوى', color: 'linear-gradient(135deg,#D98A0B,#B87209)', initials: 'نو' },
		{ id: 'khaled', name: 'خالد القحطاني', specialty: 'مطوّر Full-Stack', color: 'linear-gradient(135deg,#5DA0FF,#2B7FFF)', initials: 'خا', busy: true },
	];

	tplFilters = [
		{ id: 'all', label: 'كل النماذج' },
		{ id: 'identity', label: 'هوية بصرية' },
		{ id: 'web', label: 'موقع ويب' },
		{ id: 'app', label: 'تطبيق موبايل' },
		{ id: 'content', label: 'محتوى' },
	];

	memberFilters = [
		{ id: 'all', label: 'الكل' },
		{ id: 'sara', label: 'سارة' },
		{ id: 'fahad', label: 'فهد' },
		{ id: 'reem', label: 'ريم' },
		{ id: 'nawaf', label: 'نواف' },
	];

	tabs = [
		{ id: 'all', label: 'الكل', count: 16 },
		{ id: 'new', label: 'جديدة', count: 8 },
		{ id: 'assigned', label: 'مُسندة', count: 5 },
		{ id: 'negotiate', label: 'قيد التفاوض', count: 3 },
		{ id: 'done', label: 'مغلقة', count: 0 },
	];

	kpis = [
		{ label: 'طلبات جديدة', value: 8, sub: 'تنتظر الإسناد', color: '#2BD4C7' },
		{ label: 'مُسندة', value: 5, sub: 'لأعضاء الفريق', color: '#5DA0FF' },
		{ label: 'قيد التفاوض', value: 3, sub: 'مفاوضات جارية', color: '#FFB400' },
		{ label: 'مكتملة هذا الشهر', value: 19, sub: '↑ 31% عن الشهر الماضي', color: '#2ECC8A' },
	];

	requests: IncomingRequest[] = [
		{ id: 'RQ-001', tplName: 'هوية بصرية متكاملة — مطعم راقي', client: 'شركة المطاعم الذهبية', clientInitials: 'مط', clientColor: 'linear-gradient(135deg,#A56BE0,#7B2FBE)', tplType: 'identity', budget: 12000, days: 14, arrivedAt: 'وصل منذ ساعتين', status: 'new', aiSuggestedMember: 'سارة الزهراني', aiMatch: 94 },
		{ id: 'RQ-002', tplName: 'موقع متجر إلكتروني متكامل', client: 'متجر الأناقة', clientInitials: 'أن', clientColor: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)', tplType: 'web', budget: 28000, days: 30, arrivedAt: 'وصل منذ 5 ساعات', status: 'new', aiSuggestedMember: 'فهد العتيبي', aiMatch: 88 },
		{ id: 'RQ-003', tplName: 'تطبيق حجوزات لصالون beauty', client: 'صالون لافندر', clientInitials: 'لا', clientColor: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', tplType: 'app', budget: 35000, days: 45, arrivedAt: 'وصل أمس', status: 'new', aiSuggestedMember: 'ريم الدوسري', aiMatch: 82 },
		{ id: 'RQ-004', tplName: 'كتابة محتوى تسويقي لموقع عقاري', client: 'العقارية الذكية', clientInitials: 'عق', clientColor: 'linear-gradient(135deg,#D98A0B,#B87209)', tplType: 'content', budget: 6000, days: 10, arrivedAt: 'وصل أمس', status: 'new', aiSuggestedMember: 'نواف الحربي', aiMatch: 75 },
		{ id: 'RQ-005', tplName: 'هوية بصرية لشركة تقنية', client: 'تك سولوشنز', clientInitials: 'تك', clientColor: 'linear-gradient(135deg,#5DA0FF,#2B7FFF)', tplType: 'identity', budget: 15000, days: 18, arrivedAt: 'مُسندة منذ يومين', status: 'assigned', assignedMember: 'سارة الزهراني', aiSuggestedMember: 'سارة الزهراني', aiMatch: 91 },
		{ id: 'RQ-006', tplName: 'موقع تعريفي لشركة عقارية', client: 'الدار العقارية', clientInitials: 'دا', clientColor: 'linear-gradient(135deg,#A56BE0,#7B2FBE)', tplType: 'web', budget: 18000, days: 21, arrivedAt: 'مُسندة منذ 3 أيام', status: 'assigned', assignedMember: 'فهد العتيبي', aiSuggestedMember: 'فهد العتيبي', aiMatch: 86 },
		{ id: 'RQ-007', tplName: 'تطبيق توصيل طلبات', client: 'دليفري برو', clientInitials: 'دل', clientColor: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', tplType: 'app', budget: 45000, days: 60, arrivedAt: 'قيد التفاوض', status: 'negotiate', assignedMember: 'ريم الدوسري', aiSuggestedMember: 'ريم الدوسري', aiMatch: 79 },
		{ id: 'RQ-008', tplName: 'حملة محتوى لمنتج جديد', client: 'بيوتي كير', clientInitials: 'بي', clientColor: 'linear-gradient(135deg,#D98A0B,#B87209)', tplType: 'content', budget: 8000, days: 12, arrivedAt: 'قيد التفاوض', status: 'negotiate', assignedMember: 'نواف الحربي', aiSuggestedMember: 'نواف الحربي', aiMatch: 72 },
	];

	filteredRequests = computed<IncomingRequest[]>(() => {
		let list = this.requests;
		const tab = this.activeTab();
		if (tab !== 'all') list = list.filter(r => r.status === tab);
		const tpl = this.activeTpl();
		if (tpl !== 'all') list = list.filter(r => r.tplType === tpl);
		const mem = this.activeMember();
		if (mem !== 'all') {
			list = list.filter(r => {
				const member = this.teamMembers.find(m => m.id === mem);
				return r.assignedMember === member?.name || r.aiSuggestedMember === member?.name;
			});
		}
		const q = this.searchQuery().trim();
		if (q) list = list.filter(r => r.client.includes(q) || r.tplName.includes(q));
		return list;
	});

	setTab(id: string) { this.activeTab.set(id); }
	setTpl(id: string) { this.activeTpl.set(id); }
	setMember(id: string) { this.activeMember.set(id); }
	onSearch(e: Event) { this.searchQuery.set((e.target as HTMLInputElement).value); }

	openAssign(reqId: string) { this.assigningFor.set(reqId); }
	closeAssign() { this.assigningFor.set(null); }

	doAssign(req: IncomingRequest, member: TeamMember) {
		req.assignedMember = member.name;
		req.status = 'assigned';
		this.assigningFor.set(null);
		this.showToast(`تم إسناد الطلب لـ ${member.name}`);
	}

	showToast(msg: string) {
		this.toast.set(msg);
		setTimeout(() => this.toast.set(null), 3000);
	}

	statusLabel(status: string): string {
		const map: Record<string, string> = { new: 'جديد', assigned: 'مُسند', negotiate: 'قيد التفاوض', done: 'مغلق' };
		return map[status] || status;
	}
}
