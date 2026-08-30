import { Component, OnInit } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";

@Component({
	selector: 'supper-admin-overview',
	templateUrl: './supper-admin-overview.html',
	styleUrl: './supper-admin-overview.css',
	standalone: true,
	imports: [CommonModule, RouterLink]
})
export class SupperAdminOverview implements OnInit {
	revenueData = [58, 72, 84, 91, 108, 76, 95, 88, 112, 83, 124, 143];
	maxRevenue = 143;

	constructor() {}

	ngOnInit() {
		this.maxRevenue = Math.max(...this.revenueData);
	}

	getBarHeight(value: number): number {
		return Math.round((value / this.maxRevenue) * 100);
	}
}
