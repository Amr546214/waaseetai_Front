import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface TopModel {
	name: string;
	sales: number;
	percentage: number;
}

interface MonthlyBar {
	month: string;
	value: number;
}

@Component({
	selector: 'app-sales-stats',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './sales-stats.component.html',
	styleUrls: ['./sales-stats.component.css']
})
export class SalesStatsComponent {
	stats = [
		{ label: 'إجمالي المبيعات', value: '485,000', unit: 'ريال', icon: 'wallet', color: 'teal' },
		{ label: 'هذا الشهر', value: '72,500', unit: 'ريال', icon: 'calendar', color: 'blue' },
		{ label: 'متوسط الطلب', value: '12,250', unit: 'ريال', icon: 'chart', color: 'amber' },
		{ label: 'معدل التحويل', value: '68', unit: '%', icon: 'percent', color: 'teal' }
	];

	topModels: TopModel[] = [
		{ name: 'منصة تجارة إلكترونية', sales: 185000, percentage: 38 },
		{ name: 'تطبيق جوال', sales: 120000, percentage: 25 },
		{ name: 'نظام إدارة علاقات العملاء', sales: 95000, percentage: 20 },
		{ name: 'تصميم هوية بصرية', sales: 85000, percentage: 17 }
	];

	monthlyData: MonthlyBar[] = [
		{ month: 'يناير', value: 35000 },
		{ month: 'فبراير', value: 42000 },
		{ month: 'مارس', value: 38000 },
		{ month: 'أبريل', value: 45000 },
		{ month: 'مايو', value: 52000 },
		{ month: 'يونيو', value: 48000 },
		{ month: 'يوليو', value: 55000 },
		{ month: 'أغسطس', value: 62000 },
		{ month: 'سبتمبر', value: 72000 }
	];

	get maxMonthly(): number {
		return Math.max(...this.monthlyData.map(m => m.value));
	}

	barHeight(value: number): number {
		return Math.round((value / this.maxMonthly) * 100);
	}
}
