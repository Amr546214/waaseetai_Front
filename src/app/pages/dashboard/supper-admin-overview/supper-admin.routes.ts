import { Routes } from '@angular/router';

export const SUPPER_ADMIN_ROUTES: Routes = [
    {
        path: '',
        loadComponent: () => import('./supper-admin-overview/supper-admin-overview').then(m => m.SupperAdminOverview),
        data: { title: 'لوحة التحكم' }
    },
    {
        path: 'messages',
        loadComponent: () => import('./sa-messages/sa-messages').then(m => m.SaMessages),
        data: { title: 'الرسائل' }
    },
    {
        path: 'users',
        loadComponent: () => import('./sa-users/sa-users').then(m => m.SaUsers),
        data: { title: 'المستخدمون' }
    },
    {
        path: 'users/:id',
        loadComponent: () => import('./sa-users/sa-user-detail/sa-user-detail').then(m => m.SaUserDetail),
        data: { title: 'ملف المستخدم' }
    },
    {
        path: 'accreditations',
        loadComponent: () => import('./sa-accreditations/sa-accreditations').then(m => m.SaAccreditations),
        data: { title: 'الاعتمادات' }
    },
    {
        path: 'accreditations/:id',
        loadComponent: () => import('./sa-accreditations/sa-accreditation-detail/sa-accreditation-detail').then(m => m.SaAccreditationDetail),
        data: { title: 'مراجعة الاعتماد' }
    },
    {
        path: 'requests',
        loadComponent: () => import('./sa-requests/sa-requests').then(m => m.SaRequests),
        data: { title: 'الطلبات' }
    },
    {
        path: 'requests/:id',
        loadComponent: () => import('./sa-requests/sa-request-detail/sa-request-detail').then(m => m.SaRequestDetail),
        data: { title: 'تفاصيل الطلب' }
    },
    {
        path: 'offers',
        loadComponent: () => import('./sa-offers/sa-offers').then(m => m.SaOffers),
        data: { title: 'العروض' }
    },
    {
        path: 'offers/:id',
        loadComponent: () => import('./sa-offers/sa-offer-detail/sa-offer-detail').then(m => m.SaOfferDetail),
        data: { title: 'تفاصيل العرض' }
    },
    {
        path: 'projects',
        loadComponent: () => import('./sa-projects/sa-projects').then(m => m.SaProjects),
        data: { title: 'المشاريع' }
    },
    {
        path: 'projects/:id',
        loadComponent: () => import('./sa-projects/sa-project-detail/sa-project-detail').then(m => m.SaProjectDetail),
        data: { title: 'تفاصيل المشروع' }
    },
    {
        path: 'contracts',
        loadComponent: () => import('./sa-contracts/sa-contracts').then(m => m.SaContracts),
        data: { title: 'العقود' }
    },
    {
        path: 'contracts/:id',
        loadComponent: () => import('./sa-contracts/sa-contract-detail/sa-contract-detail').then(m => m.SaContractDetail),
        data: { title: 'تفاصيل العقد' }
    },
    {
        path: 'specialties',
        loadComponent: () => import('./sa-specialties/sa-specialties').then(m => m.SaSpecialties),
        data: { title: 'التخصصات' }
    },
    {
        path: 'specialties/:id',
        loadComponent: () => import('./sa-specialties/sa-specialty-detail/sa-specialty-detail').then(m => m.SaSpecialtyDetail),
        data: { title: 'تفاصيل التخصص' }
    },
    {
        path: 'specialties-accreditation',
        loadComponent: () => import('./sa-specialties-accreditation/sa-specialties-accreditation').then(m => m.SaSpecialtiesAccreditation),
        data: { title: 'اعتماد التخصصات' }
    },
    {
        path: 'specialties-accreditation/:id',
        loadComponent: () => import('./sa-specialties-accreditation/sa-specialty-accreditation-detail/sa-specialty-accreditation-detail').then(m => m.SaSpecialtyAccreditationDetail),
        data: { title: 'مراجعة طلب التخصص' }
    },
    {
        path: 'business-models',
        loadComponent: () => import('./sa-business-models/sa-business-models').then(m => m.SaBusinessModels),
        data: { title: 'نماذج الأعمال' }
    },
    {
        path: 'business-models/:id',
        loadComponent: () => import('./sa-business-models/sa-business-model-detail/sa-business-model-detail').then(m => m.SaBusinessModelDetail),
        data: { title: 'تفاصيل النموذج' }
    },
    {
        path: 'categories',
        loadComponent: () => import('./sa-categories/sa-categories').then(m => m.SaCategories),
        data: { title: 'التصنيفات' }
    },
    {
        path: 'brokers',
        loadComponent: () => import('./sa-brokers/sa-brokers').then(m => m.SaBrokers),
        data: { title: 'الوسطاء' }
    },
    {
        path: 'brokers/:id',
        loadComponent: () => import('./sa-brokers/sa-broker-detail/sa-broker-detail').then(m => m.SaBrokerDetail),
        data: { title: 'تفاصيل الوسيط' }
    },
    {
        path: 'disputes',
        loadComponent: () => import('./sa-disputes/sa-disputes').then(m => m.SaDisputes),
        data: { title: 'النزاعات' }
    },
    {
        path: 'disputes/:id',
        loadComponent: () => import('./sa-disputes/sa-dispute-detail/sa-dispute-detail').then(m => m.SaDisputeDetail),
        data: { title: 'تفاصيل النزاع' }
    },
    {
        path: 'reports',
        loadComponent: () => import('./sa-reports/sa-reports').then(m => m.SaReports),
        data: { title: 'البلاغات' }
    },
    {
        path: 'reports/:id',
        loadComponent: () => import('./sa-reports/sa-report-detail/sa-report-detail').then(m => m.SaReportDetail),
        data: { title: 'تفاصيل البلاغ' }
    },
    {
        path: 'analytics-hub',
        loadComponent: () => import('./sa-analytics-hub/sa-analytics-hub').then(m => m.SaAnalyticsHub),
        data: { title: 'مركز التقارير الشامل' }
    },
    {
        path: 'support',
        loadComponent: () => import('./sa-support/sa-support').then(m => m.SaSupport),
        data: { title: 'الدعم الفني' }
    },
    {
        path: 'support/:id',
        loadComponent: () => import('./sa-support/sa-support-detail/sa-support-detail').then(m => m.SaSupportDetail),
        data: { title: 'تفاصيل التذكرة' }
    },
    {
        path: 'modification-requests',
        loadComponent: () => import('./sa-modification-requests/sa-modification-requests').then(m => m.SaModificationRequests),
        data: { title: 'طلبات التعديل' }
    },
    {
        path: 'withdrawals',
        loadComponent: () => import('./sa-withdrawals/sa-withdrawals').then(m => m.SaWithdrawals),
        data: { title: 'طلبات السحب' }
    },
    {
        path: 'withdrawals/:id',
        loadComponent: () => import('./sa-withdrawals/sa-withdrawal-detail/sa-withdrawal-detail').then(m => m.SaWithdrawalDetail),
        data: { title: 'تفاصيل طلب السحب' }
    },
    {
        path: 'revenues',
        loadComponent: () => import('./sa-revenues/sa-revenues').then(m => m.SaRevenues),
        data: { title: 'الإيرادات' }
    },
    {
        path: 'fees',
        loadComponent: () => import('./sa-fees/sa-fees').then(m => m.SaFees),
        data: { title: 'الباقات والرسوم' }
    },
    {
        path: 'finance-reports',
        loadComponent: () => import('./sa-finance-reports/sa-finance-reports').then(m => m.SaFinanceReports),
        data: { title: 'التقارير المالية' }
    },
    {
        path: 'team',
        loadComponent: () => import('./sa-team/sa-team').then(m => m.SaTeam),
        data: { title: 'فريق الإدارة' }
    },
    {
        path: 'team/:id',
        loadComponent: () => import('./sa-team/sa-team-member-detail/sa-team-member-detail').then(m => m.SaTeamMemberDetail),
        data: { title: 'ملف الموظف' }
    },
    {
        path: 'roles',
        loadComponent: () => import('./sa-roles/sa-roles').then(m => m.SaRoles),
        data: { title: 'الصلاحيات والأدوار' }
    },
    {
        path: 'tasks',
        loadComponent: () => import('./sa-tasks/sa-tasks').then(m => m.SaTasks),
        data: { title: 'المهام' }
    },
    {
        path: 'team-performance',
        loadComponent: () => import('./sa-team-performance/sa-team-performance').then(m => m.SaTeamPerformance),
        data: { title: 'أداء الفريق' }
    },
    {
        path: 'system-settings',
        loadComponent: () => import('./sa-system-settings/sa-system-settings').then(m => m.SaSystemSettings),
        data: { title: 'إعدادات النظام' }
    },
    {
        path: 'super-admins',
        loadComponent: () => import('./sa-super-admins/sa-super-admins').then(m => m.SaSuperAdmins),
        data: { title: 'Super Admin' }
    },
    {
        path: 'sub-finance',
        children: [
            {
        path: 'sub-finance',
        loadComponent: () => import('./sa-sub-finance/sa-sub-finance').then(m => m.SaSubFinance),
        data: { title: 'لوحة المالية الإدارية' }
    }, // Base route for sub-finance
    {
        path: 'invoices-out',
        loadComponent: () => import('./sub-finance/sa-invoices-out/sa-invoices-out').then(m => m.SaInvoicesOut),
        data: { title: 'الفواتير الصادرة' }
    },
    {
        path: 'invoices-in',
        loadComponent: () => import('./sub-finance/sa-invoices-in/sa-invoices-in').then(m => m.SaInvoicesIn),
        data: { title: 'الفواتير الواردة' }
    },
    {
        path: 'gov-fees',
        loadComponent: () => import('./sub-finance/sa-gov-fees/sa-gov-fees').then(m => m.SaGovFees),
        data: { title: 'الرسوم الحكومية' }
    },
    {
        path: 'reports',
        loadComponent: () => import('./sub-finance/sa-sub-finance-reports/sa-sub-finance-reports').then(m => m.SaSubFinanceReports),
        data: { title: 'التقارير' }
    },
    {
        path: 'commissions',
        loadComponent: () => import('./sub-finance/sa-commissions/sa-commissions').then(m => m.SaCommissions),
        data: { title: 'العمولات' }
    },
    {
        path: 'future-billing',
        loadComponent: () => import('./sub-finance/sa-future-billing/sa-future-billing').then(m => m.SaFutureBilling),
        data: { title: 'الفوترة المستقبلية' }
    },
    {
        path: 'cashback',
        loadComponent: () => import('./sub-finance/sa-cashback/sa-cashback').then(m => m.SaCashback),
        data: { title: 'الكاش باك' }
    },
        ]
    },
    {
        path: 'subscriptions',
        children: [
    {
        path: 'plans',
        loadComponent: () => import('./subscriptions/sa-plans/sa-plans').then(m => m.SaPlans),
        data: { title: 'الباقات والخطط' }
    },
    {
        path: 'upgrade',
        loadComponent: () => import('./subscriptions/sa-upgrade/sa-upgrade').then(m => m.SaUpgrade),
        data: { title: 'ترقية الاشتراك' }
    },
    {
        path: 'active',
        loadComponent: () => import('./subscriptions/sa-active-subs/sa-active-subs').then(m => m.SaActiveSubs),
        data: { title: 'الاشتراكات النشطة' }
    },
    {
        path: 'invoices',
        loadComponent: () => import('./subscriptions/sa-sub-invoices/sa-sub-invoices').then(m => m.SaSubInvoices),
        data: { title: 'فواتير الاشتراك' }
    },
    {
        path: 'boost',
        loadComponent: () => import('./subscriptions/sa-boost/sa-boost').then(m => m.SaBoost),
        data: { title: 'Boost الظهور' }
    },
    {
        path: 'ads',
        loadComponent: () => import('./subscriptions/sa-ads/sa-ads').then(m => m.SaAds),
        data: { title: 'الإعلانات' }
    },
    {
        path: 'promotions',
        loadComponent: () => import('./subscriptions/sa-promotions/sa-promotions').then(m => m.SaPromotions),
        data: { title: 'الخدمات الترويجية' }
    },
    {
        path: 'plan-details',
        loadComponent: () => import('./subscriptions/sa-plan-details/sa-plan-details').then(m => m.SaPlanDetails),
        data: { title: 'تفاصيل الباقة' }
    },
        ]
    },
    {
        path: 'it',
        children: [
    {
        path: 'servers',
        loadComponent: () => import('./it/sa-servers/sa-servers').then(m => m.SaServers),
        data: { title: 'الخوادم والصحة' }
    },
    {
        path: 'apis',
        loadComponent: () => import('./it/sa-apis/sa-apis').then(m => m.SaApis),
        data: { title: 'إدارة APIs' }
    },
    {
        path: 'monitoring',
        loadComponent: () => import('./it/sa-monitoring/sa-monitoring').then(m => m.SaMonitoring),
        data: { title: 'Monitoring' }
    },
    {
        path: 'security',
        loadComponent: () => import('./it/sa-security/sa-security').then(m => m.SaSecurity),
        data: { title: 'الأمان' }
    },
    {
        path: 'backups',
        loadComponent: () => import('./it/sa-backups/sa-backups').then(m => m.SaBackups),
        data: { title: 'النسخ الاحتياطي' }
    },
    {
        path: 'database',
        loadComponent: () => import('./it/sa-database/sa-database').then(m => m.SaDatabase),
        data: { title: 'قاعدة البيانات' }
    },
    {
        path: 'performance',
        loadComponent: () => import('./it/sa-performance/sa-performance').then(m => m.SaPerformance),
        data: { title: 'إدارة Performance' }
    },
    {
        path: 'cdn',
        loadComponent: () => import('./it/sa-cdn/sa-cdn').then(m => m.SaCdn),
        data: { title: 'CDN + الأصول' }
    },
        ]
    },
    {
        path: 'ai',
        children: [
    {
        path: 'dashboard',
        loadComponent: () => import('./ai/sa-ai-dashboard/sa-ai-dashboard').then(m => m.SaAiDashboard),
        data: { title: 'AI Insights Dashboard' }
    },
    {
        path: 'match-engine',
        loadComponent: () => import('./ai/sa-match-engine/sa-match-engine').then(m => m.SaMatchEngine),
        data: { title: 'AI Match Engine' }
    },
    {
        path: 'audit',
        loadComponent: () => import('./ai/sa-ai-audit/sa-ai-audit').then(m => m.SaAiAudit),
        data: { title: 'AI Recommendations + Audit' }
    },
        ]
    },
    {
        path: 'audit-trail',
        loadComponent: () => import('./sa-audit-trail/sa-audit-trail').then(m => m.SaAuditTrail),
        data: { title: 'Audit Trail' }
    },
    {
        path: 'risk-center',
        loadComponent: () => import('./sa-risk-center/sa-risk-center').then(m => m.SaRiskCenter),
        data: { title: 'Risk Center' }
    },
    {
        path: 'kyc',
        loadComponent: () => import('./sa-kyc/sa-kyc').then(m => m.SaKyc),
        data: { title: 'KYC / KYB' }
    },
    {
        path: 'communication',
        children: [
    {
        path: 'notifications',
        loadComponent: () => import('./communication/sa-notifications/sa-notifications').then(m => m.SaNotifications),
        data: { title: 'الإشعارات' }
    },
    {
        path: 'broadcast',
        loadComponent: () => import('./communication/sa-broadcast/sa-broadcast').then(m => m.SaBroadcast),
        data: { title: 'Broadcast' }
    },
    {
        path: 'content',
        loadComponent: () => import('./communication/sa-content/sa-content').then(m => m.SaContent),
        data: { title: 'إدارة المحتوى' }
    },
        ]
    },
    {
        path: 'analytics',
        children: [
    {
        path: 'quality',
        loadComponent: () => import('./analytics/sa-quality/sa-quality').then(m => m.SaQuality),
        data: { title: 'جودة الخدمة' }
    },
    {
        path: 'providers',
        loadComponent: () => import('./analytics/sa-analytics-providers/sa-analytics-providers').then(m => m.SaAnalyticsProviders),
        data: { title: 'تقارير المقدمين' }
    },
    {
        path: 'coupons',
        loadComponent: () => import('./analytics/sa-coupons/sa-coupons').then(m => m.SaCoupons),
        data: { title: 'الكوبونات' }
    },
        ]
    },
	{
		path: '**',
		loadComponent: () => import('../../../sheards/not-found/not-found').then(m => m.NotFoundComponent),
		data: { title: "الصفحة غير موجودة", hideAssistant: true, embedded: true }
	}
];
