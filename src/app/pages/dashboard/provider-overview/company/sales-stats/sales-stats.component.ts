import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface TopModel {
	name: string;
	member: string;
	deals: number;
	revenue: number;
	share: number;
}

interface MonthlyBar {
	month: string;
	value: number;
}

interface FunnelRow {
	label: string;
	count: number;
	pct: number;
	color: string;
}

interface TeamPerf {
	name: string;
	initials: string;
	color: string;
	deals: number;
	revenue: number;
	conversion: number;
}

@Component({
	selector: 'app-sales-stats',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './sales-stats.component.html',
	styleUrls: ['./sales-stats.component.css']
})
export class SalesStatsComponent {
	kpis = [
		{ label: 'إجمالي الإيرادات (ريال)', value: '87,400', color: '#2BD4C7', delta: '↑ 22% عن الشهر الماضي', deltaDir: 'up' },
		{ label: 'صفقات مكتملة', value: '58', color: '#5DA0FF', delta: '↑ 18% عن الشهر الماضي', deltaDir: 'up' },
		{ label: 'معدل التحويل', value: '38%', color: '#FFB400', delta: '↑ 5 نقاط عن الشهر الماضي', deltaDir: 'up' },
		{ label: 'متوسط قيمة الصفقة (ريال)', value: '1,507', color: '#2ECC8A', delta: '↓ 4% عن الشهر الماضي', deltaDir: 'down' },
	];

	monthlyData: MonthlyBar[] = [
		{ month: 'أبريل', value: 48000 },
		{ month: 'مايو', value: 55000 },
		{ month: 'يونيو', value: 62000 },
		{ month: 'يوليو', value: 58000 },
		{ month: 'أغسطس', value: 71000 },
		{ month: 'سبتمبر', value: 87400 },
	];

	funnel: FunnelRow[] = [
		{ label: 'مشاهدات النماذج', count: 2841, pct: 100, color: 'linear-gradient(90deg,rgba(43,127,255,.5),rgba(43,127,255,.3))' },
		{ label: 'طلبات واردة', count: 1932, pct: 68, color: 'linear-gradient(90deg,rgba(43,212,199,.5),rgba(43,212,199,.3))' },
		{ label: 'مُسندة للفريق', count: 1476, pct: 52, color: 'linear-gradient(90deg,rgba(165,107,224,.5),rgba(165,107,224,.3))' },
		{ label: 'قيد التفاوض', count: 1250, pct: 44, color: 'linear-gradient(90deg,rgba(217,138,11,.5),rgba(217,138,11,.3))' },
		{ label: 'صفقات مكتملة', count: 1080, pct: 38, color: 'linear-gradient(90deg,rgba(15,169,154,.6),rgba(15,169,154,.4))' },
	];

	topModels: TopModel[] = [
		{ name: 'هوية بصرية متكاملة', member: 'سارة الزهراني', deals: 24, revenue: 37600, share: 43 },
		{ name: 'موقع متجر إلكتروني', member: 'فهد العتيبي', deals: 12, revenue: 21600, share: 25 },
		{ name: 'تطبيق حجوزات', member: 'ريم الدوسري', deals: 11, revenue: 16800, share: 19 },
		{ name: 'كتابة محتوى تسويقي', member: 'نواف الحربي', deals: 11, revenue: 11400, share: 13 },
	];

	teamPerf: TeamPerf[] = [
		{ name: 'سارة الزهراني', initials: 'سا', color: 'linear-gradient(135deg,#A56BE0,#7B2FBE)', deals: 24, revenue: 37600, conversion: 42 },
		{ name: 'فهد العتيبي', initials: 'فه', color: 'linear-gradient(135deg,#2B7FFF,#1A5FCC)', deals: 12, revenue: 21600, conversion: 35 },
		{ name: 'ريم الدوسري', initials: 'ري', color: 'linear-gradient(135deg,#2BD4C7,#0FA99A)', deals: 11, revenue: 16800, conversion: 31 },
		{ name: 'نواف الحربي', initials: 'نو', color: 'linear-gradient(135deg,#D98A0B,#B87209)', deals: 11, revenue: 11400, conversion: 28 },
	];

	get maxMonthly(): number {
		return Math.max(...this.monthlyData.map(m => m.value));
	}

	barHeight(value: number): number {
		return Math.round((value / this.maxMonthly) * 100);
	}
}
