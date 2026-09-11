import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface Employee {
	id: string; name: string; role: string; status: 'active' | 'on-leave' | 'suspended';
	avatar: string; services: number; rating: number;
}

@Component({
	selector: 'app-provider-hr',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './provider-hr.component.html',
	styleUrls: ['./provider-hr.component.css']
})
export class ProviderHrComponent {
	activeTab = 'employees';

	tabs = [
		{ id: 'employees', label: 'الموظفون' },
		{ id: 'services', label: 'الخدمات والتكليفات' },
		{ id: 'performance', label: 'الأداء' }
	];

	stats = [
		{ lbl: 'الموظفون الإداريون', val: 4, color: 'teal' },
		{ lbl: 'الخدمات النشطة', val: 12, color: 'blue' },
		{ lbl: 'متوسط التقييم', val: '4.6', color: 'amber' },
		{ lbl: 'ساعات العمل هذا الشهر', val: 640, color: 'green' }
	];

	employees: Employee[] = [
		{ id: '1', name: 'أحمد العتيبي', role: 'مدير تنفيذي', status: 'active', avatar: 'أ', services: 5, rating: 4.8 },
		{ id: '2', name: 'سارة القحطاني', role: 'مصممة', status: 'active', avatar: 'س', services: 4, rating: 4.7 },
		{ id: '3', name: 'محمد الزهراني', role: 'مطور', status: 'on-leave', avatar: 'م', services: 3, rating: 4.5 },
		{ id: '4', name: 'نورة الحربي', role: 'كاتبة محتوى', status: 'active', avatar: 'ن', services: 0, rating: 4.9 }
	];

	services = [
		{ id: '1', name: 'تصميم تطبيق تجارة', assignedTo: 'سارة القحطاني', status: 'in-progress', deadline: '2026-09-20' },
		{ id: '2', name: 'تطوير واجهة موقع', assignedTo: 'محمد الزهراني', status: 'on-hold', deadline: '2026-09-25' },
		{ id: '3', name: 'كتابة محتوى تسويقي', assignedTo: 'نورة الحربي', status: 'in-progress', deadline: '2026-09-15' },
		{ id: '4', name: 'استشارة تقنية', assignedTo: 'أحمد العتيبي', status: 'completed', deadline: '2026-09-10' }
	];

	performance = [
		{ name: 'أحمد العتيبي', completed: 18, rating: 4.8, onTime: 95 },
		{ name: 'سارة القحطاني', completed: 14, rating: 4.7, onTime: 90 },
		{ name: 'محمد الزهراني', completed: 12, rating: 4.5, onTime: 85 },
		{ name: 'نورة الحربي', completed: 8, rating: 4.9, onTime: 100 }
	];

	switchTab(tab: string) {
		this.activeTab = tab;
	}

	statusLabel(s: string): string {
		return s === 'active' ? 'نشط' : s === 'on-leave' ? 'في إجازة' : 'موقوف';
	}

	serviceStatusLabel(s: string): string {
		return s === 'in-progress' ? 'قيد التنفيذ' : s === 'on-hold' ? 'معلق' : 'مكتمل';
	}
}
