import { TourDefinition } from '../tour.types';

/**
 * The dashboard tour of a service seeker (client): where everything is. The sidebar steps point at the real menu groups (#acc-<id>) and links, so they follow the menu;
 * every sentence restates the section's own name and the pages inside it. Modern Standard Arabic; the audio files are rendered from exactly these texts.
 * A step whose target is not on screen (a collapsed mobile menu, a section the account does not have) shows as a centred card instead of failing.
 */
export const CLIENT_DASHBOARD_ROUTE = '/client-overview';
const R = CLIENT_DASHBOARD_ROUTE;

export const CLIENT_TOUR: TourDefinition = {
	id: 'client-v1',
	title: 'جولة في لوحة طالب الخدمة',
	steps: [
		{ id: 'client-welcome', route: R, title: 'مرحبًا بك في لوحتك',
			text: 'مرحبًا بك في لوحة طالب الخدمة. سأعرّفك على أقسامها خطوة بخطوة لتعرف مكان كل شيء. يمكنك تخطي الجولة في أي وقت.' },
		{ id: 'client-home', route: R, target: '#main', title: 'لوحتك الرئيسية',
			text: 'هذه لوحتك الرئيسية. تجد فيها آخر طلباتك وآخر العروض، وما ينتظر إجراءً منك، مثل عروض تنتظر مراجعتك، وتسليمات بانتظار اعتمادك، وإيداع ضمان مطلوب. وتجد إجراءات سريعة مثل عرض طلباتي، ومحفظتي، ومقارنة العروض.' },
		{ id: 'client-sidebar', route: R, target: '#sidebar', title: 'القائمة الجانبية',
			text: 'هذه القائمة الجانبية، ومنها تصل إلى كل أقسام حسابك. سنمر عليها واحدًا واحدًا.' },
		{ id: 'client-messages', route: R, target: `#sidebar a[href="${R}/messages"]`, title: 'الرسائل',
			text: 'الرسائل. هنا محادثاتك مع مقدمي الخدمات، ويظهر بجانبها عدد الرسائل غير المقروءة.' },
		{ id: 'client-requests', route: R, target: '#acc-requests', title: 'الطلبات',
			text: 'الطلبات. من هنا تنشئ طلبًا جديدًا، وتتابع طلباتك والعروض المقدمة عليها.' },
		{ id: 'client-projects', route: R, target: '#acc-projects', title: 'المشاريع',
			text: 'المشاريع. تضم المشاريع النشطة، ومراجعة التسليم، والمشاريع المكتملة والأرشيف، وطلبات التعديل.' },
		{ id: 'client-reports', route: R, target: `#sidebar a[href="${R}/reports"]`, title: 'تقاريري',
			text: 'تقاريري. صفحة التقارير الخاصة بحسابك.' },
		{ id: 'client-finance', route: R, target: '#acc-finance', title: 'المالية',
			text: 'المالية. فيها محفظتك، وسجل المعاملات، والفواتير المستلمة.' },
		{ id: 'client-disputes', route: R, target: `#sidebar a[href="${R}/disputes"]`, title: 'النزاعات',
			text: 'النزاعات. هنا تتابع أي نزاع على مشروعك. وتذكّر أن الذكاء الاصطناعي يقترح ثم يراجع الدعم البشري، ويبقى حق الاستئناف محفوظًا.' },
		{ id: 'client-profile', route: R, target: '#acc-profile', title: 'الملف الشخصي',
			text: 'الملف الشخصي. فيه بيانات ملفك وتعديلها واستكمال البيانات، وسجل النشاط والأمان، ومستوى التصنيف.' },
		{ id: 'client-notifications', route: R, target: `#sidebar a[href="${R}/notifications"]`, title: 'الإشعارات',
			text: 'الإشعارات. تصلك فيها التنبيهات الخاصة بحسابك.' },
		{ id: 'client-settings', route: R, target: '#acc-settings', title: 'الإعدادات',
			text: 'الإعدادات. منها تضبط إعدادات حسابك.' },
		{ id: 'client-help', route: R, target: '#acc-help', title: 'المساعدة والدعم',
			text: 'المساعدة والدعم. فيها مركز المساعدة، والمساعد الذكي، والدعم المباشر، وتذاكر الدعم.' },
		{ id: 'client-assistant', route: R, target: `#sidebar a[href="${R}/bebo"]`, title: 'وسيط AI',
			text: 'وسيط AI. مساعدك الذكي داخل المنصة، اسأله عما تحتاجه.' },
		{ id: 'client-create', route: `${R}/create-request`, target: 'main h1', title: 'إنشاء طلب جديد',
			text: 'وهذه صفحة إنشاء طلب مشروع جديد. اكتب تفاصيل مشروعك بوضوح، ثم انشر الطلب لتصلك العروض.' },
		{ id: 'client-end', route: R, title: 'وبعد ذلك',
			text: 'وبهذا عرفت أماكن كل شيء. ابدأ بإنشاء أول طلب من قائمة الطلبات. ويمكنك إعادة هذه الجولة في أي وقت من زر الجولة.' },
	],
};
