/**
 * WHERE a function icon is really seen, written by hand from the source and GUARDED by `icon-places.spec.ts` (every `file` must exist and still contain its `needle`, so the list cannot rot).
 * Round 7 audit of the notifications bell, decided place by place:
 *  - `follows`: the SAME element. Drawn through `<use href="#i-bell">`, a `<symbol>` alias, or an adapter (`data-ws-icon="i-bell"` on an inline / TypeScript-built svg). It changes when the icon is customised
 *    and keeps the place's own size, classes, colour and states. Default pixels are unchanged because the adapter touches nothing until a file is published.
 *  - `separate`: a FUNCTIONALLY DIFFERENT use of a bell glyph (a contact badge, a "waiting for the client" counter...). It has its OWN visible key, editable on its own, and is a member of the same family so one
 *    confirmed atomic operation can give them all the same file.
 * Nothing here rewrites a template: it describes what the code does.
 */
export interface IconPlace { where: string; file: string; needle: string }
export interface SeparatePlace extends IconPlace { id: string; why: string }
export interface IconPlaces { follows: IconPlace[]; separate: SeparatePlace[] }

const P = 'app/pages/dashboard/';
export const ICON_PLACES: Record<string, IconPlaces> = {
	'i-bell': {
		follows: [
			{ where: 'جرس الإشعارات في الشريط العلوي (كل اللوحات: عميل ومقدّم خدمة ومسوّق ومدير)', file: 'app/sheards/notification-bell/notification-bell.html', needle: 'href="#i-bell"' },
			{ where: 'قائمة الإشعارات المنسدلة وصفحات الإشعارات: أيقونة الإشعار العام (عميل ومقدّم ومسوّق)', file: 'app/core/services/notification-engine.service.ts', needle: "ws: 'i-bell'" },
			{ where: 'صفحة إشعارات المسوّق: أيقونة الإشعار العام', file: P + 'marketer-overview/notifications/notifications.ts', needle: "ws: 'i-bell'" },
			{ where: 'عنصر «الإشعارات» في القائمة الجانبية (عميل / مقدّم خدمة / مسوّق / مدير)', file: 'app/sheards/dashboard/sidebar/sidebar.ts', needle: "ws: 'i-bell'" },
			{ where: 'الحالة الفارغة في «مركز الإشعارات» للعميل', file: P + 'clients-overview/notifications/notifications-center/notifications-center.html', needle: 'data-ws-icon="i-bell"' },
			{ where: 'الحالة الفارغة في إشعارات مقدّم الخدمة', file: P + 'provider-overview/notifications/notifications.html', needle: 'data-ws-icon="i-bell"' },
			{ where: 'الحالة الفارغة في إشعارات المسوّق', file: P + 'marketer-overview/notifications/notifications.html', needle: 'data-ws-icon="i-bell"' },
			{ where: 'عنوان صفحة «تفضيلات الإشعارات» (مقدّم الخدمة)', file: P + 'provider-overview/notifications/favorite/favorite.html', needle: 'href="#i-bell"' },
			{ where: 'بطاقة «قنوات الإيصال» في تفضيلات الإشعارات (مقدّم الخدمة)', file: P + 'provider-overview/notifications/favorite/favorite.ts', needle: "wsIcon: 'i-bell'" },
			{ where: 'قسم قنوات الإشعارات في إعداد ملف مقدّم الخدمة (أيقونتان)', file: P + 'provider-overview/profile/profile-setup/profile-setup.html', needle: 'href="#i-bell"' },
			{ where: 'عنوان «قنوات الإيصال» في إعدادات إشعارات العميل', file: P + 'clients-overview/notifications/notifications-settings/notifications-settings.html', needle: 'href="#i-bell"' },
			{ where: 'لوحة المدير: تنبيهات عاجلة (العنوان وبنود التنبيه)', file: P + 'supper-admin-overview/supper-admin-overview/supper-admin-overview.html', needle: "'#i-bell'" },
			{ where: 'لوحة المدير: إدارة النظام، تبويب وبطاقة «الإشعارات»', file: P + 'supper-admin-overview/sa-system-settings/sa-system-settings.ts', needle: "ws: 'i-bell'" },
			{ where: 'لوحة المدير: الحسابات الإدارية، قسم «القنوات المفعّلة» (نفس العنصر بمعرّف آخر spa-i-bell2)', file: 'app/core/identity/identity-icon-symbols.ts', needle: "'spa-i-bell2': 'i-bell'" },
		],
		separate: [
			{ id: 'ws-bell', where: 'صفحة «اتصل بنا»: شارة «نرد خلال 24 ساعة»', file: 'app/pages/website/contact/contact.html', needle: 'href="#ws-bell"', why: 'ليست إشعارًا بل وعد زمن الرد.' },
			{ id: 'hwp-bell', where: 'صفحة «كيف يعمل» لمقدّم الخدمة: خطوة «استقبل الطلبات ونفّذ المشاريع»', file: 'app/pages/website/how-it-works/provider/provider.html', needle: 'href="#hwp-bell"', why: 'رمز خطوة في شرح، لا يمثّل مركز الإشعارات.' },
			{ id: 'ic-bell', where: 'ملف العميل: عنوان «بيانات التواصل»', file: P + 'clients-overview/profile/profile.html', needle: 'href="#ic-bell"', why: 'عنوان قسم بيانات اتصال، لا إشعارات.' },
			{ id: 'td-pending-bell', where: 'سجل التسليمات (شركة): بطاقة «بانتظار رد العميل»', file: P + 'provider-overview/company/team-deliveries/team-deliveries.html', needle: 'data-ws-icon="td-pending-bell"', why: 'عدّاد انتظار رد، لا إشعار.' },
			{ id: 'pf-pro-data-bell', where: 'الملف العام لمقدّم الخدمة: عنوان «البيانات المهنية»', file: P + 'provider-overview/profile/public/public.html', needle: 'data-ws-icon="pf-pro-data-bell"', why: 'عنوان قسم بيانات مهنية، لا إشعار.' },
			{ id: 'ss-alert-bell', where: 'إدارة النظام: بطاقة «التواصل وبنر التنبيه»', file: P + 'supper-admin-overview/sa-system-settings/sa-system-settings.html', needle: 'wsIcon="ss-alert-bell"', why: 'بنر تنبيه وبيانات تواصل، لا إعدادات الإشعارات.' },
			{ id: 'su-stat-bell', where: 'إدارة المستخدمين: بطاقات «جدد هذا الأسبوع / شركات جديدة / وسطاء جدد»', file: P + 'supper-admin-overview/sa-users/sa-users.ts', needle: "ic: 'su-stat-bell'", why: 'بطاقات إحصاء مستخدمين كانت تستعير معرّف الجرس، فصارت لها أيقونة بمفتاح خاص بنفس الرسم.' },
		],
	},
};

/** the ids of the notifications family in the order the page lists them (the server's family list is the authority; this is only the explanation text) */
export const BELL_FAMILY_IDS = ['i-bell', ...ICON_PLACES['i-bell'].separate.map(s => s.id)];
