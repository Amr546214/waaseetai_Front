import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface TeamMember {
	id: string;
	name: string;
	initials: string;
	spec: string;
	avatarBg: string;
	level: string;
	levelColor: string;
	avail: 'free' | 'busy';
	availLabel: string;
	projects: number;
	revenue: number;
	activeProjects: number;
	rating: number;
	revenueShare: number;
	tags: string[];
	roles: string[];
	type: 'provider' | 'employee' | 'pending' | 'inactive';
}

@Component({
	selector: 'app-company-team-management',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './team-management.component.html',
	styleUrls: ['./team-management.component.css']
})
export class CompanyTeamManagementComponent {
	activeTab = signal<string>('providers');
	searchQuery = signal<string>('');
	specFilter = signal<string>('all');
	availFilter = signal<string>('all');

	tabs = [
		{ id: 'providers', label: 'مقدمو الخدمات', count: 8 },
		{ id: 'employees', label: 'الموظفون', count: 3 },
		{ id: 'pending', label: 'دعوات معلقة', count: 2 },
		{ id: 'inactive', label: 'غير نشط', count: 0 },
	];

	specOptions = [
		{ id: 'all', label: 'الكل' },
		{ id: 'design', label: 'تصميم' },
		{ id: 'web', label: 'ويب' },
		{ id: 'app', label: 'تطبيقات' },
		{ id: 'content', label: 'محتوى' },
	];

	availOptions = [
		{ id: 'all', label: 'الكل' },
		{ id: 'free', label: 'متاح' },
		{ id: 'busy', label: 'مشغول' },
	];

	members: TeamMember[] = [
		{ id: 'TM-001', name: 'سارة الزهراني', initials: 'سا', spec: 'مصممة UI/UX', avatarBg: 'linear-gradient(135deg,#A56BE0,#7B2FBE)', level: '★ 7 · خبير', levelColor: '#2ECC8A', avail: 'busy', availLabel: 'مشغول', projects: 21, revenue: 37380, activeProjects: 2, rating: 4.9, revenueShare: 43, tags: ['UI/UX', 'هوية بصرية'], roles: ['مقدم قياسي'], type: 'provider' },
		{ id: 'TM-002', name: 'فهد العتيبي', initials: 'فه', spec: 'مطوّر ويب', avatarBg: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)', level: '★ 6 · متقن', levelColor: '#5DA0FF', avail: 'busy', availLabel: 'مشغول', projects: 14, revenue: 24500, activeProjects: 1, rating: 4.7, revenueShare: 28, tags: ['Laravel', 'Vue.js'], roles: ['مقدم قياسي'], type: 'provider' },
		{ id: 'TM-003', name: 'ريم الدوسري', initials: 'ري', spec: 'مطوّرة تطبيقات', avatarBg: 'linear-gradient(135deg,#0FA99A,#0D8A7E)', level: '★ 5 · متقن', levelColor: '#5DA0FF', avail: 'free', availLabel: 'متاح', projects: 9, revenue: 18600, activeProjects: 0, rating: 4.8, revenueShare: 21, tags: ['React Native', 'Flutter'], roles: ['مقدم قياسي'], type: 'provider' },
		{ id: 'TM-004', name: 'خالد الحربي', initials: 'خا', spec: 'مطوّر ويب', avatarBg: 'linear-gradient(135deg,#A56BE0,#7B2FBE)', level: '★ 4 · متمكن', levelColor: '#FFB400', avail: 'busy', availLabel: 'مشغول', projects: 7, revenue: 12100, activeProjects: 1, rating: 4.5, revenueShare: 14, tags: ['Node.js', 'Express'], roles: ['مقدم قياسي'], type: 'provider' },
		{ id: 'TM-005', name: 'نورة القحطاني', initials: 'نو', spec: 'كاتبة محتوى', avatarBg: 'linear-gradient(135deg,#FFB400,#D98A0B)', level: '★ 5 · متقن', levelColor: '#5DA0FF', avail: 'free', availLabel: 'متاح', projects: 12, revenue: 9800, activeProjects: 0, rating: 4.6, revenueShare: 11, tags: ['محتوى', 'تسويق'], roles: ['مقدم قياسي'], type: 'provider' },
		{ id: 'TM-006', name: 'عبدالله الشمري', initials: 'عب', spec: 'محاسب', avatarBg: 'linear-gradient(135deg,#6B7699,#4A5568)', level: 'موظف', levelColor: '#6B7699', avail: 'free', availLabel: 'متاح', projects: 0, revenue: 0, activeProjects: 0, rating: 0, revenueShare: 0, tags: ['مالية'], roles: ['محاسب'], type: 'employee' },
		{ id: 'TM-007', name: 'منى العتيبي', initials: 'من', spec: 'مديرة مشاريع', avatarBg: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)', level: 'موظف', levelColor: '#6B7699', avail: 'busy', availLabel: 'مشغول', projects: 0, revenue: 0, activeProjects: 0, rating: 0, revenueShare: 0, tags: ['إدارة'], roles: ['مدير مشاريع'], type: 'employee' },
		{ id: 'TM-008', name: 'سعد الدوسري', initials: 'سع', spec: 'مراقب جودة', avatarBg: 'linear-gradient(135deg,#E05B6B,#C0394A)', level: 'موظف', levelColor: '#6B7699', avail: 'free', availLabel: 'متاح', projects: 0, revenue: 0, activeProjects: 0, rating: 0, revenueShare: 0, tags: ['جودة'], roles: ['مراقب جودة'], type: 'employee' },
	];

	filteredMembers = computed(() => {
		let list = this.members.filter(m => {
			if (this.activeTab() === 'providers') return m.type === 'provider';
			if (this.activeTab() === 'employees') return m.type === 'employee';
			if (this.activeTab() === 'pending') return m.type === 'pending';
			if (this.activeTab() === 'inactive') return m.type === 'inactive';
			return true;
		});
		if (this.specFilter() !== 'all') {
			const specMap: { [k: string]: string[] } = { design: ['UI/UX', 'هوية بصرية', 'تصميم'], web: ['ويب', 'Laravel', 'Vue.js', 'Node.js'], app: ['تطبيقات', 'React Native', 'Flutter'], content: ['محتوى', 'تسويق'] };
			const specs = specMap[this.specFilter()] || [];
			list = list.filter(m => m.tags.some(t => specs.some(s => t.includes(s))) || m.spec.includes(specs[0] || ''));
		}
		if (this.availFilter() !== 'all') {
			list = list.filter(m => m.avail === this.availFilter());
		}
		if (this.searchQuery().trim()) {
			const q = this.searchQuery().trim().toLowerCase();
			list = list.filter(m => m.name.toLowerCase().includes(q) || m.spec.toLowerCase().includes(q));
		}
		return list;
	});

	setTab(tab: string) { this.activeTab.set(tab); }
	setSpec(id: string) { this.specFilter.set(id); }
	setAvail(id: string) { this.availFilter.set(id); }
	onSearch(event: Event) { this.searchQuery.set((event.target as HTMLInputElement).value); }
}
