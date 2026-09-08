import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../../environments/environment';

type ProjectFilter = 'all' | 'run' | 'wait' | 'late';

interface ProjectKPI {
	icon: 'list' | 'lock' | 'clock' | 'ai';
	value: string | number;
	label: string;
	color: 'teal' | 'blue' | 'amber' | 'ai';
}

interface ProjectItem {
	id: string;
	workspaceId?: string | null;
	title: string;
	status: Exclude<ProjectFilter, 'all'>;
	rawStatus?: string;
	progress: number;
	provider: {
		initial: string;
		name: string;
		isVerified?: boolean;
	};
	contract: string;
	nextStep: string;
	heldAmount: number;
	completedStages: number;
	stagesCount: number;
	daysLeft: number;
	updatedAt?: string;
}

@Component({
	selector: 'app-active-project',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './active-project.html',
	styleUrl: './active-project.css',
})
export class ActiveProject implements OnInit {
	private http = inject(HttpClient);

	isLoading = signal(true);
	hasError = signal(false);
	kpis = signal<ProjectKPI[]>(this.emptyKpis());
	projects = signal<ProjectItem[]>([]);
	currentFilter = signal<ProjectFilter>('all');

	tabs = computed(() => [
		{ id: 'all' as const, label: 'الكل', count: this.projects().length },
		{ id: 'run' as const, label: 'قيد التنفيذ', count: this.projects().filter(project => project.status === 'run').length },
		{ id: 'wait' as const, label: 'بانتظار التسليم', count: this.projects().filter(project => project.status === 'wait').length },
		{ id: 'late' as const, label: 'متأخر', count: this.projects().filter(project => project.status === 'late').length },
	]);

	filteredProjects = computed(() => {
		const filter = this.currentFilter();
		return filter === 'all' ? this.projects() : this.projects().filter(project => project.status === filter);
	});

	ngOnInit() {
		this.fetchActiveProjects();
	}

	fetchActiveProjects() {
		this.isLoading.set(true);
		this.hasError.set(false);

		this.http.get<any>(`${environment.url_api}/client/my-requests/active-projects`).subscribe({
			next: response => {
				if (!response?.success || !response.data) {
					this.hasError.set(true);
					this.isLoading.set(false);
					return;
				}

				const projects = Array.isArray(response.data.projects)
					? response.data.projects.map((project: any) => this.normaliseProject(project))
					: [];
				projects.sort((a: ProjectItem, b: ProjectItem) => this.statusPriority(a.status) - this.statusPriority(b.status));
				this.projects.set(projects);
				this.kpis.set(this.normaliseKpis(response.data.kpis, projects));
				this.isLoading.set(false);
			},
			error: () => {
				this.hasError.set(true);
				this.isLoading.set(false);
			}
		});
	}

	setFilter(filter: ProjectFilter) {
		this.currentFilter.set(filter);
	}

	formatNumber(value: number | string) {
		return typeof value === 'number' ? value.toLocaleString('en-US') : value;
	}

	projectMeta(project: ProjectItem) {
		const stages = `${project.completedStages} من ${project.stagesCount} مراحل`;
		if (project.daysLeft < 0) return `${stages} · متأخر ${Math.abs(project.daysLeft)} ${this.dayLabel(Math.abs(project.daysLeft))}`;
		if (project.daysLeft === 0) return `${stages} · موعد التسليم اليوم`;
		return `${stages} · ${project.daysLeft} ${this.dayLabel(project.daysLeft)} متبقية`;
	}

	statusLabel(status: ProjectItem['status']) {
		if (status === 'wait') return 'بانتظار مراجعتك';
		if (status === 'late') return 'متأخر';
		return 'قيد التنفيذ';
	}

	private normaliseProject(project: any): ProjectItem {
		const rawStatus = String(project.rawStatus || project.status || '').toUpperCase();
		const displayStatus = String(project.status || '').toLowerCase();
		const daysLeft = Number.isFinite(Number(project.daysLeft)) ? Number(project.daysLeft) : 0;
		let status: ProjectItem['status'];
		if (displayStatus === 'wait' || displayStatus === 'run' || displayStatus === 'late') status = displayStatus;
		else if (['WAIT', 'AWAITING_DELIVERY', 'PENDING_SIGNATURE', 'PENDING_APPROVAL'].includes(rawStatus)) status = 'wait';
		else if (rawStatus === 'LATE' || daysLeft < 0) status = 'late';
		else status = 'run';

		return {
			id: String(project.id),
			workspaceId: project.workspaceId || null,
			title: project.title || 'مشروع بدون عنوان',
			status,
			rawStatus,
			progress: Math.min(100, Math.max(0, Math.round(Number(project.progress) || 0))),
			provider: {
				initial: project.provider?.initial || 'مـ',
				name: project.provider?.name || 'مقدم الخدمة',
				isVerified: Boolean(project.provider?.isVerified),
			},
			contract: project.contract || `CT-${String(project.id).slice(0, 4).toUpperCase()}`,
			nextStep: project.nextStep || 'متابعة تنفيذ المرحلة الحالية',
			heldAmount: Math.max(0, Number(project.heldAmount) || 0),
			completedStages: Math.max(0, Number(project.completedStages) || 0),
			stagesCount: Math.max(1, Number(project.stagesCount) || 1),
			daysLeft,
			updatedAt: project.updatedAt,
		};
	}

	private normaliseKpis(rawKpis: any, projects: ProjectItem[]): ProjectKPI[] {
		if (!Array.isArray(rawKpis) || rawKpis.length !== 4) {
			return this.kpisFromProjects(projects);
		}
		const colors: ProjectKPI['color'][] = ['teal', 'blue', 'amber', 'ai'];
		const icons: ProjectKPI['icon'][] = ['list', 'lock', 'clock', 'ai'];
		return rawKpis.map((kpi: any, index: number) => ({
			icon: icons[index],
			value: kpi.value ?? 0,
			label: kpi.label || this.emptyKpis()[index].label,
			color: colors[index],
		}));
	}

	private kpisFromProjects(projects: ProjectItem[]): ProjectKPI[] {
		const held = projects.reduce((sum, project) => sum + project.heldAmount, 0);
		const waiting = projects.filter(project => project.status === 'wait').length;
		const late = projects.filter(project => project.status === 'late').length;
		return [
			{ icon: 'list', value: projects.length, label: 'مشاريع نشطة', color: 'teal' },
			{ icon: 'lock', value: held, label: 'محتجز بالضمان ريال', color: 'blue' },
			{ icon: 'clock', value: waiting, label: 'بانتظار مراجعتك', color: 'amber' },
			{ icon: 'ai', value: late ? `${late} متأخر` : 'جيد', label: 'الحالة العامة', color: 'ai' },
		];
	}

	private emptyKpis(): ProjectKPI[] {
		return [
			{ icon: 'list', value: 0, label: 'مشاريع نشطة', color: 'teal' },
			{ icon: 'lock', value: 0, label: 'محتجز بالضمان ريال', color: 'blue' },
			{ icon: 'clock', value: 0, label: 'بانتظار مراجعتك', color: 'amber' },
			{ icon: 'ai', value: '—', label: 'الحالة العامة', color: 'ai' },
		];
	}

	private statusPriority(status: ProjectItem['status']) {
		return status === 'wait' ? 0 : status === 'late' ? 1 : 2;
	}

	private dayLabel(days: number) {
		if (days === 1) return 'يوم';
		if (days === 2) return 'يومان';
		if (days >= 3 && days <= 10) return 'أيام';
		return 'يوماً';
	}
}
