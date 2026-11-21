import { TourDefinition } from '../tour.types';

/**
 * The dashboard tour of a service provider: where everything is. The sidebar steps point at the real menu groups (#acc-<id>) and links, so they follow the menu;
 * every sentence restates the section's own name and the pages inside it. Modern Standard Arabic; the audio files are rendered from exactly these texts.
 * A step whose target is not on screen (a collapsed mobile menu, a section the account does not have, e.g. company-only pages) shows as a centred card instead of failing.
 */
export const PROVIDER_DASHBOARD_ROUTE = '/provider-overview';
const R = PROVIDER_DASHBOARD_ROUTE;

export const PROVIDER_TOUR: TourDefinition = {
	id: 'provider-v1',
	title: 'جولة في لوحة مقدم الخدمة',
	steps: [
		{ id: 'provider-welcome', route: R, title: 'مرحبًا بك في لوحتك',
			text: 'مرحبًا بك في لوحة مقدم الخدمة. سأعرّفك على أقسامها خطوة بخطوة لتعرف مكان كل شيء. يمكنك تخطي الجولة في أي وقت.' },
		{ id: 'provider-home', route: R, target: '#main', title: 'لوحتك الرئيسية',
			text: 'هذه لوحتك الرئيسية. تجد فيها ملخص نشاطك، وما ينتظر إجراءً منك، وإجراءات سريعة تصل بها إلى أهم صفحاتك.' },
		{ id: 'provider-sidebar', route: R, target: '#sidebar', title: 'القائمة الجانبية',
			text: 'هذه القائمة الجانبية، ومنها تصل إلى كل أقسام حسابك. سنمر عليها واحدًا واحدًا.' },
		{ id: 'provider-messages', route: R, target: `#sidebar a[href="${R}/messages"]`, title: 'الرسائل',
			text: 'الرسائل. هنا محادثاتك مع العملاء، ويظهر بجانبها عدد الرسائل غير المقروءة.' },
		{ id: 'provider-explore', route: R, target: '#acc-explore', title: 'طلبات العملاء والعروض',
			text: 'طلبات العملاء والعروض. من هنا تستكشف الطلبات المنشورة وتقدّم عليها عروضك، وتتابع عروضي المرسلة.' },
		{ id: 'provider-templates', route: R, target: '#acc-templates', title: 'نماذجي وخدماتي',
			text: 'نماذجي وخدماتي. فيها مركز النماذج والخدمات، ورفع نموذج للاعتماد، ونماذجي في السوق، ورفع مشروع للسوق، وطلبات الاعتماد.' },
		{ id: 'provider-marketing', route: R, target: '#acc-marketing', title: 'التسويق',
			text: 'التسويق. فيه مركز التسويق، وكوبونات الخصم، والعروض الخاصة.' },
		{ id: 'provider-projects', route: R, target: '#acc-projects', title: 'المشاريع',
			text: 'المشاريع. تضم المشاريع النشطة، والمكتملة والأرشيف.' },
		{ id: 'provider-finance', route: R, target: '#acc-finance', title: 'المالية',
			text: 'المالية. فيها الأرباح والمحفظة، وسجل المعاملات.' },
		{ id: 'provider-disputes', route: R, target: `#sidebar a[href="${R}/disputes"]`, title: 'النزاعات',
			text: 'النزاعات. هنا تتابع أي نزاع على مشروعك. وتذكّر أن الذكاء الاصطناعي يقترح ثم يراجع الدعم البشري، ويبقى حق الاستئناف محفوظًا.' },
		{ id: 'provider-reports', route: R, target: `#sidebar a[href="${R}/reports"]`, title: 'تقاريري',
			text: 'تقاريري. صفحة التقارير الخاصة بحسابك.' },
		{ id: 'provider-profile', route: R, target: '#acc-profile', title: 'الملف المهني',
			text: 'الملف المهني. فيه الملف العام، وتعديل الملف المهني، واستكمال البيانات، وطلبات تعديل الملف، وإدارة التخصصات، ومستوى التصنيف، وسجل النشاط والأمان، وإضافة حساب.' },
		{ id: 'provider-notifications', route: R, target: '#acc-notif', title: 'الإشعارات',
			text: 'الإشعارات. فيها مركز الإشعارات، وتفضيلات الإشعارات.' },
		{ id: 'provider-settings', route: R, target: '#acc-settings', title: 'الإعدادات',
			text: 'الإعدادات. منها تضبط إعدادات حسابك.' },
		{ id: 'provider-help', route: R, target: `#sidebar a[href="${R}/help"]`, title: 'مركز المساعدة',
			text: 'مركز المساعدة. تجد فيه الإجابات عن أسئلتك.' },
		{ id: 'provider-assistant', route: R, target: `#sidebar a[href="${R}/bebo"]`, title: 'وسيط AI',
			text: 'وسيط AI. مساعدك الذكي داخل المنصة، اسأله عما تحتاجه.' },
		{ id: 'provider-explore-page', route: `${R}/explore-requests`, target: '.ord-title', title: 'استكشاف الطلبات',
			text: 'وهذه صفحة استكشاف الطلبات. تصفّح الطلبات المنشورة، وقدّم عرضك على ما يناسب تخصصك.' },
		{ id: 'provider-end', route: R, title: 'وبعد ذلك',
			text: 'وبهذا عرفت أماكن كل شيء. ابدأ باستكشاف الطلبات وتقديم عروضك. ويمكنك إعادة هذه الجولة في أي وقت من زر الجولة.' },
	],
};
