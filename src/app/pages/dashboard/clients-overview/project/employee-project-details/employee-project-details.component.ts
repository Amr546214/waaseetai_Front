import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';

interface Milestone {
	id: string;
	title: string;
	date: string;
	state: 'done' | 'wait' | 'todo';
	lastDelivery: string;
	deliveryCount: string;
	heldAmount: number;
	releasedAmount?: number;
	quality?: string;
	aiMatch?: string;
	files?: string[];
}

@Component({
	selector: 'app-employee-project-details',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './employee-project-details.component.html',
	styleUrls: ['./employee-project-details.component.css']
})
export class EmployeeProjectDetailsComponent {
	private route = inject(ActivatedRoute);
	projectId = signal<string>('');

	activeTab = signal<'overview' | 'miles' | 'msgs' | 'files'>('overview');

	project = signal<any>(null);
	milestones = signal<Milestone[]>([]);

	ngOnInit() {
		const id = this.route.snapshot.paramMap.get('id') || '—';
		this.projectId.set(id);
		this.loadProject(id);
	}

	loadProject(id: string) {
		this.project.set({
			id,
			title: 'تصميم هوية بصرية متكاملة',
			provider: 'أستوديو نون للتصميم',
			providerInitial: 'هـ',
			contract: 'CT-2291',
			value: 8500,
			progress: 60,
			daysLeft: 12,
			completedStages: 2,
			stagesCount: 4,
			heldAmount: 4000,
			releasedAmount: 4500,
			commitment: 'ممتاز',
			startDate: '12 مايو',
			expectedDate: '8 يونيو',
			employee: 'سلطان العتيبي',
			employeeDept: 'المبيعات',
		});

		this.milestones.set([
			{
				id: 'm1', title: 'البحث والمفهوم البصري', date: 'اكتُمل 18 مايو', state: 'done',
				lastDelivery: 'التوجهات البصرية الأولية ولوحة الألوان', deliveryCount: 'تسليم واحد',
				heldAmount: 0, releasedAmount: 2000, quality: 'جودة عالية',
			},
			{
				id: 'm2', title: 'تصميم الشعار والهوية', date: 'اكتُمل 26 مايو', state: 'done',
				lastDelivery: 'الشعار النهائي بالنسخة الأفقية والخطوط المعتمدة', deliveryCount: 'تسليمان · تعديل واحد',
				heldAmount: 0, releasedAmount: 2500, quality: 'جودة عالية',
			},
			{
				id: 'm3', title: 'دليل الهوية الكامل', date: 'سُلّم 30 مايو', state: 'wait',
				lastDelivery: 'الدليل الكامل بقسم الاستخدامات الخاطئة وأمثلة التطبيق', deliveryCount: 'تسليمان · تعديل واحد',
				heldAmount: 2500, aiMatch: '94٪', files: ['دليل-الهوية.pdf'],
			},
			{
				id: 'm4', title: 'تسليم الملفات النهائية', date: 'يبدأ بعد الاعتماد', state: 'todo',
				lastDelivery: 'لم يبدأ التسليم بعد', deliveryCount: '',
				heldAmount: 1500,
			},
		]);
	}

	setTab(tab: 'overview' | 'miles' | 'msgs' | 'files') {
		this.activeTab.set(tab);
	}
}
