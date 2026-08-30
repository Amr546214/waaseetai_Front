import { Component, signal, computed, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ActiveProjectsService } from '../../../../../core/services/active.service';

interface Project {
	id: string;
	title: string;
	status: 'wait' | 'run' | 'late';
	statusLabel: string;
	progress: number;
	providerName: string;
	providerInitial: string;
	providerAvatarColor: string;
	currentStage: string;
	escrowAmount: string;
	rawPrice?: number;
	escrowLabel: string;
	meta: string;
	contractRef?: string;
	approvedStagesCount?: number;
	stagesCount?: number;
	daysLeft?: number;
}

@Component({
	selector: 'app-active',
	standalone: true,
	imports: [RouterLink],
	templateUrl: './active.html',
	styleUrl: './active.css',
})
export class Active implements OnInit {
	private activeProjectsService = inject(ActiveProjectsService);
	activeFilter = signal<'all' | 'run' | 'wait' | 'late'>('all');

	projects = signal<Project[]>([]);
	isLoading = signal(true);
	error = signal('');

	ngOnInit() {
		this.loadProjects();
	}

	loadProjects() {
		this.isLoading.set(true);
		this.error.set('');
		this.activeProjectsService.getActiveProjects().subscribe({
			next: (res) => {
				if (res && res.data) {
					this.projects.set(res.data);
				}
				this.isLoading.set(false);
			},
			error: (err) => {
				console.error('Error fetching active projects', err);
				this.error.set(err.error?.message || 'تعذر تحميل المشاريع النشطة');
				this.isLoading.set(false);
			}
		});
	}

	filteredProjects = computed(() => {
		const f = this.activeFilter();
		if (f === 'all') return this.projects();
		return this.projects().filter(p => p.status === f);
	});

	counts = computed(() => {
		const projs = this.projects();
		const totalEscrow = projs.reduce((sum, p) => {
			const price = p.rawPrice ?? (parseFloat((p.escrowAmount || '').replace(/[^0-9.]/g, '')) || 0);
			return sum + price;
		}, 0);
		const lateCount = projs.filter(p => p.status === 'late').length;

		return {
			all: projs.length,
			run: projs.filter(p => p.status === 'run').length,
			wait: projs.filter(p => p.status === 'wait').length,
			late: lateCount,
			totalEscrowFormatted: totalEscrow.toLocaleString('en-US'),
			healthStatus: lateCount > 0 ? 'تحتاج انتباه' : (projs.length > 0 ? 'ممتاز' : 'جيد')
		};
	});

	setFilter(filter: 'all' | 'run' | 'wait' | 'late') {
		this.activeFilter.set(filter);
	}
}
