import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

interface SpendingLimit {
	id: string; category: string; limit: number; spent: number; period: string;
}

interface PenaltyRule {
	id: string; title: string; desc: string; severity: 'low' | 'med' | 'high';
}

@Component({
	selector: 'app-spending-limits',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './spending-limits.component.html',
	styleUrls: ['./spending-limits.component.css']
})
export class SpendingLimitsComponent {
	activeTab = 'limits';

	tabs = [
		{ id: 'limits', label: 'حدود الإنفاق' },
		{ id: 'penalties', label: 'نظام العقوبات' },
		{ id: 'policies', label: 'السياسات' }
	];

	limits: SpendingLimit[] = [
		{ id: '1', category: 'إنشاء الطلبات', limit: 100000, spent: 45000, period: 'شهري' },
		{ id: '2', category: 'توقيع العقود', limit: 50000, spent: 12000, period: 'شهري' },
		{ id: '3', category: 'إيداع الضمان', limit: 30000, spent: 8500, period: 'شهري' },
		{ id: '4', category: 'سحب المحفظة', limit: 20000, spent: 5000, period: 'أسبوعي' },
		{ id: '5', category: 'تعديل النطاق', limit: 15000, spent: 3200, period: 'شهري' }
	];

	penalties: PenaltyRule[] = [
		{ id: '1', title: 'تأخر التسليم', desc: 'خصم 5% من قيمة المرحلة لكل يوم تأخر بعد المهلة المحددة', severity: 'med' },
		{ id: '2', title: 'إلغاء متكرر', desc: 'تجميد حساب 48 ساعة بعد 3 إلغاءات متتالية', severity: 'med' },
		{ id: '3', title: 'مخالفة جودة', desc: 'خصم 10% وتنبيه رسمي عند ثبوت مخالفة الجودة', severity: 'high' },
		{ id: '4', title: 'تلاعب بالنظام', desc: 'إيقاف فوري لل حساب ومراجعة امتثال كاملة', severity: 'high' },
		{ id: '5', title: 'تأخر سداد', desc: 'غرامة 2% من القيمة المستحقة لكل أسبوع تأخر', severity: 'low' }
	];

	policies = [
		{ title: 'سياسة الإنفاق', desc: 'حدود الإنفاق تُطبق على جميع الموظفين حسب الصلاحية المحددة لكل دور' },
		{ title: 'سياسة الموافقات', desc: 'الطلبات التي تتجاوز 10,000 دولار تتطلب موافقة مدير المشاريع' },
		{ title: 'سياسة العقوبات', desc: 'تُطبق العقوبات تلقائياً عند مخالفة الشروط مع إشعار مسبق' },
		{ title: 'سياسة المراجعة', desc: 'مراجعة دورية كل 30 يوم لحدود الإنفاق والصلاحيات' }
	];

	switchTab(tab: string) {
		this.activeTab = tab;
	}

	percentSpent(limit: SpendingLimit): number {
		return Math.round((limit.spent / limit.limit) * 100);
	}

	severityLabel(s: string): string {
		return s === 'high' ? 'عالية' : s === 'med' ? 'متوسطة' : 'منخفضة';
	}
}
