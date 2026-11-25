import { TourDefinition } from '../tour.types';

/**
 * The dashboard tour of a marketing broker (marketer): where everything is. The sidebar steps point at the real menu links and the profile group (#acc-profile), so they
 * follow the menu; every sentence restates the section's own name. Modern Standard Arabic; the audio files are rendered from exactly these texts.
 * A step whose target is not on screen (a collapsed mobile menu) shows as a centred card instead of failing.
 */
export const MARKETER_DASHBOARD_ROUTE = '/marketer-overview';
const R = MARKETER_DASHBOARD_ROUTE;

export const MARKETER_TOUR: TourDefinition = {
	id: 'marketer-v1',
	title: 'جولة في لوحة الوسيط التسويقي',
	steps: [
		{ id: 'marketer-welcome', route: R, title: 'مرحبًا بك في لوحتك',
			text: 'مرحبًا بك في لوحة الوسيط التسويقي. سأعرّفك على أقسامها خطوة بخطوة لتعرف مكان كل شيء. يمكنك تخطي الجولة في أي وقت.' },
		{ id: 'marketer-home', route: R, target: '#main', title: 'لوحتك الرئيسية',
			text: 'هذه لوحتك الرئيسية. تجد فيها ملخص نشاطك التسويقي وأهم أرقامك.' },
		{ id: 'marketer-sidebar', route: R, target: '#sidebar', title: 'القائمة الجانبية',
			text: 'هذه القائمة الجانبية، ومنها تصل إلى كل أقسام حسابك. سنمر عليها واحدًا واحدًا.' },
		{ id: 'marketer-referrals', route: R, target: `#sidebar a[href="${R}/referrals"]`, title: 'الإحالات',
			text: 'الإحالات. هنا تتابع الأشخاص الذين سجّلوا عن طريقك وحالة كل إحالة.' },
		{ id: 'marketer-ref-links', route: R, target: `#sidebar a[href="${R}/ref-links"]`, title: 'روابط الإحالة',
			text: 'روابط الإحالة. من هنا تحصل على روابطك الخاصة وتشاركها مع من تريد.' },
		{ id: 'marketer-assets', route: R, target: `#sidebar a[href="${R}/assets"]`, title: 'المواد التسويقية',
			text: 'المواد التسويقية. تجد فيها مواد جاهزة تستعين بها في الترويج.' },
		{ id: 'marketer-commissions', route: R, target: `#sidebar a[href="${R}/commissions"]`, title: 'العمولات',
			text: 'العمولات. هنا تتابع عمولاتك وحالتها.' },
		{ id: 'marketer-withdraw', route: R, target: `#sidebar a[href="${R}/withdraw"]`, title: 'السحب',
			text: 'السحب. من هنا تطلب سحب رصيدك وتتابع طلبات السحب.' },
		{ id: 'marketer-profile', route: R, target: '#acc-profile', title: 'حسابي',
			text: 'حسابي. فيه ملفك التسويقي، والملف العام، وطلبات التعديل، وسجل النشاط والأمان، وإضافة حساب.' },
		{ id: 'marketer-notifications', route: R, target: `#sidebar a[href="${R}/notifications"]`, title: 'الإشعارات',
			text: 'الإشعارات. تصلك فيها التنبيهات الخاصة بحسابك.' },
		{ id: 'marketer-messages', route: R, target: `#sidebar a[href="${R}/messages"]`, title: 'الرسائل',
			text: 'الرسائل. هنا محادثاتك، ويظهر بجانبها عدد الرسائل غير المقروءة.' },
		{ id: 'marketer-help', route: R, target: `#sidebar a[href="${R}/help"]`, title: 'المساعدة',
			text: 'المساعدة. تجد فيها الإجابات عن أسئلتك.' },
		{ id: 'marketer-assistant', route: R, target: '#sidebar [data-testid="sidebar-assistant"]', title: 'وسيط AI',
			text: 'وسيط AI. مساعدك الذكي داخل المنصة، اسأله عما تحتاجه.' },
	],
};
