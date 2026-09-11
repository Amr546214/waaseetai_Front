import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface EmployeeProject {
	id: string;
	title: string;
	provider: string;
	providerInitial: string;
	providerColor: string;
	contract: string;
	employee: string;
	employeeDept: string;
	nextStep: string;
	heldAmount: number;
	completedStages: number;
	stagesCount: number;
	daysLeft: number;
	progress: number;
	status: 'run' | 'wait';
	needsAttention: boolean;
}

@Component({
	selector: 'app-employee-projects',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './employee-projects.component.html',
	styleUrls: ['./employee-projects.component.css']
})
export class EmployeeProjectsComponent {
	activeFilter = signal<string>('all');

	kpis = [
		{ label: 'مشاريع الفريق النشطة', value: '9', color: '#2BD4C7', icon: 'list' },
		{ label: 'محتجز بالضمان ريال', value: '47,000', color: '#5DA0FF', icon: 'lock' },
		{ label: 'بانتظار مراجعة', value: '3', color: '#FFB400', icon: 'clock' },
		{ label: 'موظفون عاملون', value: '6', color: '#A56BE0', icon: 'ai' },
	];

	tabs = computed(() => [
		{ id: 'all', label: 'الكل', count: this.projects().length },
		{ id: 'run', label: 'قيد التنفيذ', count: this.projects().filter(p => p.status === 'run').length },
		{ id: 'wait', label: 'بانتظار التسليم', count: this.projects().filter(p => p.status === 'wait').length },
	]);

	projects = signal<EmployeeProject[]>([
		{
			id: 'CT-2291', title: 'تصميم هوية بصرية لمنتج', provider: 'أستوديو نون للتصميم', providerInitial: 'ن', providerColor: '#2ECC8A',
			contract: 'CT-2291', employee: 'سلطان العتيبي', employeeDept: 'المبيعات',
			nextStep: 'دليل الهوية الكامل، سُلّم وينتظر الاعتماد', heldAmount: 6500,
			completedStages: 2, stagesCount: 4, daysLeft: 12, progress: 60, status: 'wait', needsAttention: true,
		},
		{
			id: 'CT-2310', title: 'تطوير متجر إلكتروني للشركة', provider: 'تقنية الرواد', providerInitial: 'ت', providerColor: 'linear-gradient(135deg,#2B7FFF,#2BD4C7)',
			contract: 'CT-2310', employee: 'خالد المطيري', employeeDept: 'تقنية المعلومات',
			nextStep: 'ربط بوابات الدفع، قيد العمل لدى المقدّم', heldAmount: 18000,
			completedStages: 1, stagesCount: 3, daysLeft: 9, progress: 35, status: 'run', needsAttention: false,
		},
		{
			id: 'CT-2288', title: 'حملة تسويق رقمي للموسم', provider: 'ريم الإبداعية', providerInitial: 'ر', providerColor: 'linear-gradient(135deg,#2BD4C7,#2B7FFF)',
			contract: 'CT-2288', employee: 'نورة القحطاني', employeeDept: 'التسويق',
			nextStep: 'تقرير الأداء النهائي، سُلّم وينتظر الاعتماد', heldAmount: 12000,
			completedStages: 4, stagesCount: 5, daysLeft: 5, progress: 80, status: 'wait', needsAttention: true,
		},
	]);

	filteredProjects = computed<EmployeeProject[]>(() => {
		const filter = this.activeFilter();
		if (filter === 'all') return this.projects();
		return this.projects().filter(p => p.status === filter);
	});

	setFilter(filter: string) { this.activeFilter.set(filter); }
}
