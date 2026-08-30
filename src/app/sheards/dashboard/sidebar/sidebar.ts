import { Component, Input, Output, EventEmitter, inject, signal, computed, ChangeDetectorRef, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { AuthStore } from '../../../core/store/auth.store';
import { DashboardStore } from '../../../core/store/dashboard.store';
import { AccountType, UserRole } from '../../../core/models/auth.model';
import { filter, map } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';
import { ChatStateService } from '../../../core/services/chat-state.service';
import { ProviderApiService } from '../../../core/services/provider-api.service';

export interface NavItem {
	type: 'header' | 'link' | 'accordion' | 'button' | 'divider';
	label?: string;
	icon?: string;
	route?: string;
	exact?: boolean;
	badge?: number;
	id?: string;
	children?: NavItem[];
	action?: string;
	disabled?: boolean;
}

@Component({
	selector: 'app-sidebar',
	standalone: true,
	imports: [CommonModule, RouterModule],
	templateUrl: './sidebar.html',
	styleUrl: './sidebar.css',
})
export class Sidebar implements OnInit {
	private authStore = inject(AuthStore);
	private router = inject(Router);
	public chatStateService = inject(ChatStateService);
	private cdRef = inject(ChangeDetectorRef);
	private providerApiService = inject(ProviderApiService);

	isProviderProfileIncomplete = signal<boolean>(false);

	constructor() {
		effect(() => {
			this.chatStateService.totalUnreadCount();
			this.cdRef.markForCheck();
		});
	}

	ngOnInit() {
		// Fetch provider stats if role is provider to check profile completeness
		if (this.effectiveRole() === UserRole.PROVIDER) {
			this.providerApiService.getOverviewStats().subscribe({
				next: (res) => {
					if (res.success && res.data?.summary) {
						this.isProviderProfileIncomplete.set(!res.data.summary.profileSetupCompleted || !res.data.summary.setupTestCompleted);
					}
				},
				error: (err) => console.error('Failed to load provider stats for sidebar', err)
			});
		}
	}

	@Input() isOpen = false;
	@Output() closeSidebar = new EventEmitter<void>();

	// Track active URL signal for automatic parent expansion
	currentUrl = toSignal(
		this.router.events.pipe(
			filter((e): e is NavigationEnd => e instanceof NavigationEnd),
			map(e => e.urlAfterRedirects)
		),
		{ initialValue: this.router.url }
	);

	// Manually toggled accordion ID; defaults to null to allow automatic URL matching
	activeAccordion = signal<string | null>(null);

	effectiveRole = computed<UserRole>(() => {
		const user = this.authStore.currentUser();
		const url = this.currentUrl() || '';

		if (user?.accountType === AccountType.SUPER_ADMIN) {
			return UserRole.SUPER_ADMIN;
		}

		if (user?.activeRole) {
			return user.activeRole;
		}

		// Fallback check against active URL route
		if (url.includes('/provider-overview')) {
			return UserRole.PROVIDER;
		}
		if (url.includes('/marketer-overview')) {
			return UserRole.AFFILIATE;
		}
		if (url.includes('/client-overview')) {
			return UserRole.CLIENT;
		}

		// Fallback check against base accountType
		if (user?.accountType === AccountType.MARKETING_BROKER) {
			return UserRole.AFFILIATE;
		}
		if (user?.accountType === AccountType.PROVIDER_INDIVIDUAL || user?.accountType === AccountType.PROVIDER_COMPANY) {
			return UserRole.PROVIDER;
		}

		return UserRole.CLIENT;
	});

	sidebarTitle = computed<string>(() => {
		const role = this.effectiveRole();
		if (role === UserRole.SUPER_ADMIN) {
			return 'لوحة الإدارة';
		}
		if (role === UserRole.AFFILIATE) {
			return 'لوحة المسوق';
		}
		if (role === UserRole.PROVIDER) {
			return 'لوحة مقدم الخدمة';
		}
		return 'لوحة طالب الخدمة';
	});

	navItems = computed<NavItem[]>(() => {
		const user = this.authStore.currentUser();
		
		if (!user) return [];

		const role = this.effectiveRole();

		if (role === UserRole.SUPER_ADMIN || user.accountType === AccountType.SUPER_ADMIN) {
			return this.getSuperAdminNavItems();
		}

		if (role === UserRole.AFFILIATE) {
			return this.getMarketerNavItems();
		}

		if (role === UserRole.PROVIDER) {
			return this.getProviderNavItems();
		}

		return this.getClientNavItems();
	});

	private getSuperAdminNavItems(): NavItem[] {
		const icons = {
			home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
			chat: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
			person: 'M12 7a4 4 0 110-8 4 4 0 010 8zM4 21v-1a8 8 0 0116 0v1',
			shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
			list: 'M4 6h16M4 10h16M4 14h16M4 18h16',
			tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
			escrow: 'M3 11h18v11H3zM7 11V7a5 5 0 0 1 10 0v4',
			doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6',
			check: 'M20 6L9 17l-5-5',
			star: 'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
			market: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2 5h14M9 21a1 1 0 1 0 2 0 1 1 0 0 0-2 0M17 21a1 1 0 1 0 2 0 1 1 0 0 0-2 0',
			warn: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
			edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z',
			wallet: 'M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2zM16 14a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
			chart: 'M18 20V10M12 20V4M6 20v-6',
			settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33 1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82 1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
			bell: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
			send: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
			globe: 'M12 22A10 10 0 1 0 12 2a10 10 0 0 0 0 20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
			ai: 'M12 12m-2 0a2 2 0 104 0 2 2 0 10-4 0M12 10V5M12 19v-5M10 12H5M19 12h-5M4 6m-1.5 0a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M20 6m-1.5 0a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M4 18m-1.5 0a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0M20 18m-1.5 0a1.5 1.5 0 103 0 1.5 1.5 0 10-3 0',
			logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4 M16 17l5-5-5-5 M21 12H9'
		};

		return [
			{ type: 'header', label: 'الرئيسية' },
			{ type: 'link', label: 'لوحة التحكم', route: '/supper-admin-overview', exact: true, icon: icons.home },
			{ type: 'link', label: 'الرسائل', route: '/supper-admin-overview/messages', icon: icons.chat, badge: this.chatStateService.totalUnreadCount() > 0 ? this.chatStateService.totalUnreadCount() : undefined },

			{ type: 'header', label: 'العمليات' },
			{
				type: 'accordion', id: 'sa-users', label: 'المستخدمون والاعتمادات', icon: icons.person,
				children: [
					{ type: 'link', label: 'المستخدمون', route: '/supper-admin-overview/users', icon: icons.person },
					{ type: 'link', label: 'الاعتمادات', route: '/supper-admin-overview/accreditations', icon: icons.shield }
				]
			},
			{
				type: 'accordion', id: 'sa-requests', label: 'الطلبات والعروض', icon: icons.list,
				children: [
					{ type: 'link', label: 'الطلبات', route: '/supper-admin-overview/requests', icon: icons.list },
					{ type: 'link', label: 'العروض', route: '/supper-admin-overview/offers', icon: icons.tag }
				]
			},
			{
				type: 'accordion', id: 'sa-projects', label: 'المشاريع والعقود', icon: icons.escrow,
				children: [
					{ type: 'link', label: 'المشاريع', route: '/supper-admin-overview/projects', icon: icons.escrow },
					{ type: 'link', label: 'العقود', route: '/supper-admin-overview/contracts', icon: icons.doc }
				]
			},
			{
				type: 'accordion', id: 'sa-specialties', label: 'التخصصات والمحتوى', icon: icons.check,
				children: [
					{ type: 'link', label: 'التخصصات', route: '/supper-admin-overview/specialties', icon: icons.check },
					{ type: 'link', label: 'اعتماد التخصصات', route: '/supper-admin-overview/specialties-accreditation', icon: icons.shield },
					{ type: 'link', label: 'نماذج الأعمال', route: '/supper-admin-overview/business-models', icon: icons.list },
					{ type: 'link', label: 'التصنيفات', route: '/supper-admin-overview/categories', icon: icons.star }
				]
			},
			{ type: 'link', label: 'الوسطاء', route: '/supper-admin-overview/brokers', icon: icons.market },
			{
				type: 'accordion', id: 'sa-disputes', label: 'النزاعات والشكاوى', icon: icons.warn, badge: 33,
				children: [
					{ type: 'link', label: 'النزاعات', route: '/supper-admin-overview/disputes', icon: icons.escrow },
					{ type: 'link', label: 'البلاغات', route: '/supper-admin-overview/reports', icon: icons.warn },
					{ type: 'link', label: 'الدعم الفني', route: '/supper-admin-overview/support', icon: icons.chat },
					{ type: 'link', label: 'طلبات التعديل', route: '/supper-admin-overview/modification-requests', icon: icons.edit }
				]
			},

			{ type: 'header', label: 'المالية والمحتوى' },
			{
				type: 'accordion', id: 'sa-finance', label: 'المالية والتقارير', icon: icons.wallet,
				children: [
					{ type: 'link', label: 'طلبات السحب', route: '/supper-admin-overview/withdrawals', icon: icons.wallet },
					{ type: 'link', label: 'الإيرادات', route: '/supper-admin-overview/revenues', icon: icons.chart },
					{ type: 'link', label: 'الباقات والرسوم', route: '/supper-admin-overview/fees', icon: icons.wallet },
					{ type: 'link', label: 'التقارير', route: '/supper-admin-overview/finance-reports', icon: icons.chart }
				]
			},

			{ type: 'header', label: 'الفريق' },
			{
				type: 'accordion', id: 'sa-team', label: 'إدارة الفريق', icon: icons.person,
				children: [
					{ type: 'link', label: 'فريق الإدارة', route: '/supper-admin-overview/team', icon: icons.person },
					{ type: 'link', label: 'الصلاحيات والأدوار', route: '/supper-admin-overview/roles', icon: icons.shield },
					{ type: 'link', label: 'المهام', route: '/supper-admin-overview/tasks', icon: icons.list },
					{ type: 'link', label: 'أداء الفريق', route: '/supper-admin-overview/team-performance', icon: icons.chart }
				]
			},

			{ type: 'header', label: 'النظام' },
			{
				type: 'accordion', id: 'sa-system', label: 'إدارة النظام', icon: icons.settings,
				children: [
					{ type: 'link', label: 'إعدادات النظام', route: '/supper-admin-overview/system-settings', icon: icons.settings },
					{ type: 'link', label: 'Super Admin', route: '/supper-admin-overview/super-admins', icon: icons.shield }
				]
			},

			{ type: 'header', label: 'أنظمة فرعية' },
			{
				type: 'accordion', id: 'sa-sub-finance', label: 'المالية الإدارية', icon: icons.wallet,
				children: [
					{ type: 'link', label: 'لوحة المالية', route: '/supper-admin-overview/sub-finance', icon: icons.chart },
					{ type: 'link', label: 'الفواتير الصادرة', route: '/supper-admin-overview/sub-finance/invoices-out', icon: icons.doc },
					{ type: 'link', label: 'الفواتير الواردة', route: '/supper-admin-overview/sub-finance/invoices-in', icon: icons.doc },
					{ type: 'link', label: 'الرسوم الحكومية', route: '/supper-admin-overview/sub-finance/gov-fees', icon: icons.shield },
					{ type: 'link', label: 'التقارير المالية', route: '/supper-admin-overview/sub-finance/reports', icon: icons.chart },
					{ type: 'link', label: 'العمولات', route: '/supper-admin-overview/sub-finance/commissions', icon: icons.tag },
					{ type: 'link', label: 'الفوترة المستقبلية', route: '/supper-admin-overview/sub-finance/future-billing', icon: icons.check },
					{ type: 'link', label: 'الكاش باك', route: '/supper-admin-overview/sub-finance/cashback', icon: icons.wallet }
				]
			},
			{
				type: 'accordion', id: 'sa-subs', label: 'الاشتراكات', icon: icons.star,
				children: [
					{ type: 'link', label: 'الباقات والخطط', route: '/supper-admin-overview/subscriptions/plans', icon: icons.star },
					{ type: 'link', label: 'ترقية الاشتراك', route: '/supper-admin-overview/subscriptions/upgrade', icon: icons.chart },
					{ type: 'link', label: 'الاشتراكات النشطة', route: '/supper-admin-overview/subscriptions/active', icon: icons.list },
					{ type: 'link', label: 'فواتير الاشتراك', route: '/supper-admin-overview/subscriptions/invoices', icon: icons.doc },
					{ type: 'link', label: 'Boost الظهور', route: '/supper-admin-overview/subscriptions/boost', icon: icons.tag },
					{ type: 'link', label: 'الإعلانات', route: '/supper-admin-overview/subscriptions/ads', icon: icons.market },
					{ type: 'link', label: 'الخدمات الترويجية', route: '/supper-admin-overview/subscriptions/promotions', icon: icons.chart },
					{ type: 'link', label: 'تفاصيل الباقة', route: '/supper-admin-overview/subscriptions/plan-details', icon: icons.star }
				]
			},
			{
				type: 'accordion', id: 'sa-it', label: 'البنية التقنية', icon: icons.settings,
				children: [
					{ type: 'link', label: 'الخوادم والصحة', route: '/supper-admin-overview/it/servers', icon: icons.check },
					{ type: 'link', label: 'إدارة APIs', route: '/supper-admin-overview/it/apis', icon: icons.list },
					{ type: 'link', label: 'Monitoring', route: '/supper-admin-overview/it/monitoring', icon: icons.chart },
					{ type: 'link', label: 'الأمان', route: '/supper-admin-overview/it/security', icon: icons.shield },
					{ type: 'link', label: 'النسخ الاحتياطي', route: '/supper-admin-overview/it/backups', icon: icons.doc },
					{ type: 'link', label: 'قاعدة البيانات', route: '/supper-admin-overview/it/database', icon: icons.list },
					{ type: 'link', label: 'إدارة Performance', route: '/supper-admin-overview/it/performance', icon: icons.chart },
					{ type: 'link', label: 'CDN + الأصول', route: '/supper-admin-overview/it/cdn', icon: icons.globe }
				]
			},
			{
				type: 'accordion', id: 'sa-ai', label: 'محركات AI', icon: icons.ai,
				children: [
					{ type: 'link', label: 'AI Dashboard', route: '/supper-admin-overview/ai/dashboard', icon: icons.ai },
					{ type: 'link', label: 'Match Engine', route: '/supper-admin-overview/ai/match-engine', icon: icons.ai },
					{ type: 'link', label: 'التوصيات + Audit', route: '/supper-admin-overview/ai/audit', icon: icons.ai }
				]
			},

			{ type: 'header', label: 'الأدوات الإدارية' },
			{ type: 'link', label: 'Audit Trail', route: '/supper-admin-overview/audit-trail', icon: icons.shield },
			{
				type: 'accordion', id: 'sa-risk', label: 'مراقبة وأمان', icon: icons.warn,
				children: [
					{ type: 'link', label: 'Risk Center', route: '/supper-admin-overview/risk-center', icon: icons.warn },
					{ type: 'link', label: 'KYC / KYB', route: '/supper-admin-overview/kyc', icon: icons.shield }
				]
			},
			{
				type: 'accordion', id: 'sa-comm', label: 'التواصل والمحتوى', icon: icons.chat,
				children: [
					{ type: 'link', label: 'الإشعارات', route: '/supper-admin-overview/communication/notifications', icon: icons.bell },
					{ type: 'link', label: 'Broadcast', route: '/supper-admin-overview/communication/broadcast', icon: icons.send },
					{ type: 'link', label: 'إدارة المحتوى', route: '/supper-admin-overview/communication/content', icon: icons.doc }
				]
			},
			{
				type: 'accordion', id: 'sa-analytics', label: 'التحليلات والجودة', icon: icons.chart,
				children: [
					{ type: 'link', label: 'جودة الخدمة', route: '/supper-admin-overview/analytics/quality', icon: icons.star },
					{ type: 'link', label: 'تقارير المقدمين', route: '/supper-admin-overview/analytics/providers', icon: icons.person },
					{ type: 'link', label: 'الكوبونات', route: '/supper-admin-overview/analytics/coupons', icon: icons.tag }
				]
			},

			{
				type: 'button',
				label: 'تسجيل الخروج',
				icon: icons.logout,
				action: 'logout'
			}
		];
	}

	private getMarketerNavItems(): NavItem[] {
		return [
			{ type: 'header', label: 'الرئيسية' },
			{
				type: 'link',
				label: 'لوحة التحكم',
				route: '/marketer-overview',
				exact: true,
				icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
			},
			{ type: 'header', label: 'الإحالات والروابط' },
			{
				type: 'link',
				label: 'الإحالات',
				route: '/marketer-overview/referrals',
				icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z'
			},
			{
				type: 'link',
				label: 'روابط الإحالة',
				route: '/marketer-overview/ref-links',
				icon: 'M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1'
			},
			{ type: 'header', label: 'العمولات' },
			{
				type: 'link',
				label: 'العمولات',
				route: '/marketer-overview/commissions',
				icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z'
			},
			{
				type: 'link',
				label: 'السحب',
				route: '/marketer-overview/withdraw',
				icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z'
			},
			{ type: 'header', label: 'حسابي' },
			{
				type: 'accordion',
				id: 'profile',
				label: 'حسابي',
				icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
				children: [
					{ type: 'link', label: 'ملفي التسويقي', route: '/marketer-overview/profile/data', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
					{ type: 'link', label: 'الملف العام', route: '/marketer-overview/profile/public', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
					{ type: 'link', label: 'طلبات التعديل', route: '/marketer-overview/profile/requests', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z' },
					{ type: 'link', label: 'استكمال البيانات', route: '/marketer-overview/profile-setup', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
					{ type: 'link', label: 'إضافة حساب', route: '/marketer-overview/profile/add-account', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' }
				]
			},
			{ type: 'header', label: 'الإشعارات والتواصل' },
			{
				type: 'link',
				label: 'الإشعارات',
				route: '/marketer-overview/notifications',
				icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'
			},
			{
				type: 'link',
				label: 'الرسائل',
				route: '/marketer-overview/messages',
				icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
				badge: this.chatStateService.totalUnreadCount() > 0 ? this.chatStateService.totalUnreadCount() : undefined
			},
			{ type: 'header', label: 'الدعم' },
			{
				type: 'link',
				label: 'المساعدة',
				route: '/marketer-overview/help',
				icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
			},
			{
				type: 'button',
				label: 'تسجيل الخروج',
				icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
				action: 'logout'
			}
		];
	}

	private getProviderNavItems(): NavItem[] {
		const incomplete = this.isProviderProfileIncomplete();
		const items: NavItem[] = [
				{ type: 'header', label: 'الرئيسية' },
				{
					type: 'link',
					label: 'لوحة التحكم',
					route: '/provider-overview',
					exact: true,
					icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
				},
				{
					type: 'link',
					label: 'الرسائل',
					route: '/provider-overview/messages',
					icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
					badge: this.chatStateService.totalUnreadCount() > 0 ? this.chatStateService.totalUnreadCount() : undefined
				},
				{
					type: 'accordion',
					id: 'explore',
					label: 'طلبات العملاء والعروض',
					icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
					children: [
						{ type: 'link', label: 'استكشاف الطلبات', route: '/provider-overview/explore-requests', icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' },
						{ type: 'link', label: 'عروضي المرسلة', route: '/provider-overview/offers', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
					]
				},
				{
					type: 'accordion',
					id: 'templates',
					label: 'نماذجي وخدماتي',
					icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
					children: [
						{ type: 'link', label: 'مركز النماذج والخدمات', route: '/provider-overview/business-models/center', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
						{ type: 'link', label: 'رفع نموذج للاعتماد', route: '/provider-overview/business-models/accreditation/new', icon: 'M5 13l4 4L19 7' },
						{ type: 'link', label: 'نماذجي في السوق', route: '/provider-overview/business-models/market', icon: 'M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z' },
						{ type: 'link', label: 'رفع مشروع للسوق', route: '/provider-overview/business-models/new-project', icon: 'M12 4v16m8-8H4' },
						{ type: 'link', label: 'طلبات الاعتماد', route: '/provider-overview/business-models/accreditation/list', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' }
					]
				},
				{
					type: 'accordion',
					id: 'projects',
					label: 'المشاريع',
					icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
					children: [
						{ type: 'link', label: 'المشاريع النشطة', route: '/provider-overview/projects/active', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
						{ type: 'link', label: 'المكتملة والأرشيف', route: '/provider-overview/projects/archived', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
					]
				},
				{
					type: 'accordion',
					id: 'finance',
					label: 'المالية',
					icon: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z',
					children: [
						{ type: 'link', label: 'الأرباح والمحفظة', route: '/provider-overview/finance/wallet', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
						{ type: 'link', label: 'سجل المعاملات', route: '/provider-overview/finance/transactions', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
					]
				},
				{
					type: 'link',
					label: 'النزاعات',
					route: '/provider-overview/disputes',
					icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
				},
				{
					type: 'link',
					label: 'تقاريري',
					route: '/provider-overview/reports',
					icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
				},
				{ type: 'header', label: 'حسابي' },
				{
					type: 'accordion',
					id: 'profile',
					label: 'الملف المهني',
					icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
					children: [
						{ type: 'link', label: 'الملف العام', route: '/provider-overview/profile/public', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
						{ type: 'link', label: 'تعديل الملف المهني', route: '/provider-overview/profile/data', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
						{ type: 'link', label: 'استكمال البيانات', route: '/provider-overview/profile/setup', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
						{ type: 'link', label: 'طلبات تعديل الملف', route: '/provider-overview/profile/requests', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
						{ type: 'link', label: 'إدارة التخصصات', route: '/provider-overview/profile/specialties', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
						{ type: 'link', label: 'مستوى التصنيف', route: '/provider-overview/profile/level', icon: 'M5 13l4 4L19 7' },
						{ type: 'link', label: 'سجل إجراءات الحساب', route: '/provider-overview/profile/logs', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
						{ type: 'link', label: 'إضافة حساب', route: '/provider-overview/profile/add-account', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' }
					]
				},
				{
					type: 'accordion',
					id: 'notif',
					label: 'الإشعارات',
					icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
					children: [
						{ type: 'link', label: 'مركز الإشعارات', route: '/provider-overview/notifications', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
						{ type: 'link', label: 'تفضيلات الإشعارات', route: '/provider-overview/notifications/favorite', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
					]
				},
				{
					type: 'accordion',
					id: 'settings',
					label: 'الإعدادات',
					icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
					children: [
						{ type: 'link', label: 'إعدادات الحساب', route: '/provider-overview/settings/account', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
					]
				},
				{ type: 'header', label: 'الدعم والمساعدة' },
				{
					type: 'link',
					label: 'مركز المساعدة',
					route: '/provider-overview/help',
					icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
				},
				{
					type: 'button',
					label: 'تسجيل الخروج',
					icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
					action: 'logout'
				}
			];

		if (incomplete) {
			return items.map(item => {
				if (item.type === 'header' || item.action === 'logout' || item.route === '/provider-overview' || item.route === '/provider-overview/profile/setup') {
					return item;
				}
				
				if (item.children) {
					// Also enable the setup link if it's inside children (like in profile accordion)
					const hasAllowedChild = item.children.some(c => c.route === '/provider-overview/profile/setup');
					if (hasAllowedChild) {
						return {
							...item,
							children: item.children.map(c => c.route === '/provider-overview/profile/setup' ? c : { ...c, disabled: true })
						};
					}
				}
				
				return { ...item, disabled: true, children: item.children?.map(c => ({...c, disabled: true})) };
			});
		}

		return items;
	}

	private getClientNavItems(): NavItem[] {
				return [
			{ type: 'header', label: 'الرئيسية' },
			{
				type: 'link',
				label: 'لوحة التحكم',
				route: '/client-overview',
				exact: true,
				icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'
			},
			{
				type: 'link',
				label: 'الرسائل',
				route: '/client-overview/messages',
				icon: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
				badge: this.chatStateService.totalUnreadCount() > 0 ? this.chatStateService.totalUnreadCount() : undefined
			},
			{
				type: 'accordion',
				id: 'requests',
				label: 'الطلبات',
				icon: 'M4 6h16M4 10h16M4 14h16M4 18h16',
				children: [
					{ type: 'link', label: 'إنشاء طلب', route: '/client-overview/create-request', icon: 'M12 4v16m8-8H4' },
					{ type: 'link', label: 'طلباتي', route: '/client-overview/my-requests', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' }
				]
			},
			{
				type: 'accordion',
				id: 'projects',
				label: 'المشاريع',
				icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
				children: [
					{ type: 'link', label: 'المشاريع النشطة', route: '/client-overview/projects/active', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
					{ type: 'link', label: 'مراجعة التسليم', route: '/client-overview/projects/review', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z' },
					{ type: 'link', label: 'المكتملة والأرشيف', route: '/client-overview/projects/archived', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
					{ type: 'link', label: 'طلبات التعديل', route: '/client-overview/projects/amendments', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
				]
			},
			{
				type: 'link',
				label: 'تقاريري',
				route: '/client-overview/reports',
				icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'
			},
			{
				type: 'accordion',
				id: 'finance',
				label: 'المالية',
				icon: 'M21 12V7H5a2 2 0 0 1 0-4h14v4M3 5v14a2 2 0 0 0 2 2h16v-5M18 12a2 2 0 0 0 0 4h4v-4Z',
				children: [
					{ type: 'link', label: 'محفظتي', route: '/client-overview/finance/wallet', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z' },
					{ type: 'link', label: 'الفواتير المستلمة', route: '/client-overview/finance/invoices', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' }
				]
			},
			{
				type: 'link',
				label: 'النزاعات',
				route: '/client-overview/disputes',
				icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'
			},
			{ type: 'header', label: 'حسابي' },
			{
				type: 'accordion',
				id: 'profile',
				label: 'الملف الشخصي',
				icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
				children: [
					{ type: 'link', label: 'بيانات الملف', route: '/client-overview/profile', icon: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z' },
					{ type: 'link', label: 'تعديل الملف الشخصي', route: '/client-overview/profile/edit', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' },
					{ type: 'link', label: 'استكمال البيانات', route: '/client-overview/profile-setup', icon: 'M5 13l4 4L19 7' },
					{ type: 'link', label: 'طلبات تعديل الملف', route: '/client-overview/profile/requests', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
					{ type: 'link', label: 'سجل إجراءات الحساب', route: '/client-overview/profile/logs', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
					{ type: 'link', label: 'إضافة حساب', route: '/client-overview/profile/add-account', icon: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z' },
					{ type: 'link', label: 'مستوى التصنيف', route: '/client-overview/profile/level', icon: 'M5 13l4 4L19 7' }
				] as NavItem[]
			},
			{
				type: 'accordion',
				id: 'notif',
				label: 'الإشعارات',
				icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
				children: [
					{ type: 'link', label: 'مركز الإشعارات', route: '/client-overview/notifications', icon: 'M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0' },
					{ type: 'link', label: 'تفضيلات الإشعارات', route: '/client-overview/notifications/settings', icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z' }
				]
			},
			{
				type: 'accordion',
				id: 'settings',
				label: 'الإعدادات',
				icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
				children: [
					{ type: 'link', label: 'إعدادات الحساب', route: '/client-overview/settings/account', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
				]
			},
			{ type: 'header', label: 'الدعم والمساعدة' },
			{
				type: 'link',
				label: 'مركز المساعدة',
				route: '/client-overview/help',
				icon: 'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
			},
			{
				type: 'button',
				label: 'تسجيل الخروج',
				icon: 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
				action: 'logout'
			}
		];
	}

	toggleAccordion(id: string) {
		this.activeAccordion.update(current => current === id ? null : id);
	}

	isAccordionOpen(item: NavItem): boolean {
		if (this.activeAccordion() === item.id) {
			return true;
		}
		// Also check if any child route matches current URL
		const url = this.currentUrl() || '';
		return !!item.children?.some(c => c.route && url.includes(c.route));
	}

	onCloseSidebar() {
		this.closeSidebar.emit();
	}

	handleAction(action?: string) {
		if (action === 'logout') {
			this.logout();
		}
	}

	onOuterLinkClick() {
		this.activeAccordion.set(null);
		this.onCloseSidebar();
	}

	logout() {
		this.authStore.logout('/auth/login');
	}
}
