import { Component, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ThemeService } from '../../../../core/services/theme.service';

@Component({
	selector: 'app-reports',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './reports.html',
	styleUrl: './reports.css'
})
export class Reports {
	public themeService = inject(ThemeService);

	// Tabs: 'orders' | 'projects' | 'finance' | 'disputes'
	activeTab = signal<'orders' | 'projects' | 'finance' | 'disputes'>('orders');

	// Filters
	dateFilter = signal<'month' | '3m' | '6m' | 'year' | 'custom'>('month');
	searchQuery = signal<string>('');
	showDatePicker = signal<boolean>(false);

	// Sub-filters for tabs
	ordersStatusFilter = signal<string>('all');
	projectsStatusFilter = signal<string>('all');
	projectsRatingFilter = signal<string>('all');
	projectsDurationFilter = signal<string>('all');
	financeTypeFilter = signal<string>('all');
	financeStatusFilter = signal<string>('all');
	disputesStatusFilter = signal<string>('all');
	disputesReasonFilter = signal<string>('all');

	// Actions
	switchTab(tab: 'orders' | 'projects' | 'finance' | 'disputes') {
		this.activeTab.set(tab);
	}

	setDate(range: 'month' | '3m' | '6m' | 'year') {
		this.dateFilter.set(range);
	}

	openDatePicker() {
		this.showDatePicker.set(true);
	}

	closeDatePicker() {
		this.showDatePicker.set(false);
	}

	dpApply() {
		this.dateFilter.set('custom');
		this.closeDatePicker();
	}

	resetAllFilters() {
		this.dateFilter.set('month');
		this.searchQuery.set('');
		this.ordersStatusFilter.set('all');
		this.projectsStatusFilter.set('all');
		this.projectsRatingFilter.set('all');
		this.projectsDurationFilter.set('all');
		this.financeTypeFilter.set('all');
		this.financeStatusFilter.set('all');
		this.disputesStatusFilter.set('all');
		this.disputesReasonFilter.set('all');
	}

	activeFiltersCount = computed(() => {
		let count = 0;
		if (this.dateFilter() !== 'month') count++;
		if (this.searchQuery() !== '') count++;
		if (this.activeTab() === 'orders' && this.ordersStatusFilter() !== 'all') count++;
		if (this.activeTab() === 'projects') {
			if (this.projectsStatusFilter() !== 'all') count++;
			if (this.projectsRatingFilter() !== 'all') count++;
			if (this.projectsDurationFilter() !== 'all') count++;
		}
		if (this.activeTab() === 'finance') {
			if (this.financeTypeFilter() !== 'all') count++;
			if (this.financeStatusFilter() !== 'all') count++;
		}
		if (this.activeTab() === 'disputes') {
			if (this.disputesStatusFilter() !== 'all') count++;
			if (this.disputesReasonFilter() !== 'all') count++;
		}
		return count;
	});

	exportRpt(type: string) {
		alert('جاري التصدير بصيغة: ' + type);
	}

}
