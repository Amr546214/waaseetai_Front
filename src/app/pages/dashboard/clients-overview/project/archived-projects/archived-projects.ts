import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

type ProjectStatus = 'done' | 'cancel' | 'arch';
type FilterStatus = 'all' | ProjectStatus;

interface ArchivedProject {
	id: string;
	title: string;
	provider: string;
	amount: string;
	dateStr: string;
	status: ProjectStatus;
	icon: string;
}

@Component({
	selector: 'app-archived-projects',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './archived-projects.html',
})
export class ArchivedProjects {
	searchQuery = signal<string>('');
	activeFilter = signal<FilterStatus>('all');

	projects = signal<ArchivedProject[]>([
		{
			id: 'PRJ-3092',
			title: 'تصميم هوية بصرية متكاملة',
			provider: 'نورة التميمي',
			amount: '4,500 ريال',
			dateStr: 'أُغلق 18 يونيو',
			status: 'done',
			icon: 'check'
		},
		{
			id: 'PRJ-3071',
			title: 'ترجمة تقرير مالي (40 صفحة)',
			provider: 'خالد العتيبي',
			amount: '1,200 ريال',
			dateStr: 'أُغلق 9 يونيو',
			status: 'done',
			icon: 'doc'
		},
		{
			id: 'PRJ-3055',
			title: 'حملة تسويق رقمي لمتجر إلكتروني',
			provider: 'ريم السالم',
			amount: '6,800 ريال',
			dateStr: 'أُغلق 28 مايو',
			status: 'done',
			icon: 'market'
		},
		{
			id: 'PRJ-3040',
			title: 'تطوير صفحة هبوط',
			provider: 'ملغى قبل التسليم',
			amount: 'استُرد المبلغ',
			dateStr: '20 مايو',
			status: 'cancel',
			icon: 'list'
		},
		{
			id: 'PRJ-2988',
			title: 'كتابة محتوى مدونة (12 مقالًا)',
			provider: 'سلمان الدوسري',
			amount: '2,400 ريال',
			dateStr: 'مؤرشف منذ مارس',
			status: 'arch',
			icon: 'doc'
		}
	]);

	filteredProjects = computed(() => {
		const filter = this.activeFilter();
		const query = this.searchQuery().toLowerCase();
		
		return this.projects().filter(p => {
			const matchesFilter = filter === 'all' || p.status === filter;
			const matchesSearch = p.id.toLowerCase().includes(query) || p.title.toLowerCase().includes(query) || p.provider.toLowerCase().includes(query);
			return matchesFilter && matchesSearch;
		});
	});

	setFilter(filter: FilterStatus) {
		this.activeFilter.set(filter);
	}

	updateSearch(event: Event) {
		const target = event.target as HTMLInputElement;
		this.searchQuery.set(target.value);
	}

	getCount(status: FilterStatus): number {
		if (status === 'all') return this.projects().length;
		return this.projects().filter(p => p.status === status).length;
	}
}
