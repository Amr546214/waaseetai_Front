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

	// The backend has no spending limits, penalty rules or company policies for a client account yet: the lists stay empty (the page says so)
	// instead of showing example figures and rules that nobody configured.
	limits: SpendingLimit[] = [];

	penalties: PenaltyRule[] = [];

	policies: { title: string; desc: string }[] = [];

	switchTab(tab: string) {
		this.activeTab = tab;
	}

	percentSpent(limit: SpendingLimit): number {
		return limit.limit > 0 ? Math.round((limit.spent / limit.limit) * 100) : 0;
	}

	severityLabel(s: string): string {
		return s === 'high' ? 'عالية' : s === 'med' ? 'متوسطة' : 'منخفضة';
	}
}
