/**
 * WHERE a function icon is really seen, written by hand from the source (Round 6 follow-up, the owner's «إشعارات» case = library slot `i-bell`).
 * `follows` = places drawn with `<use href="#id">`: they change when the icon is customised. `notFollowed` = places that look like the same icon but are NOT drawn through that symbol
 * (an inline <svg> copy, a TypeScript string, another icon id, a different geometry): they keep their own drawing. The page shows both lists so a change is never described as "everywhere".
 * `icon-places.spec.ts` checks every `file` exists and still contains the quoted `needle`, so this list cannot silently rot. Default looks are NOT touched: nothing here rewrites a template.
 */
export interface IconPlace { where: string; file: string; needle: string }
export interface IconPlaces { follows: IconPlace[]; notFollowed: (IconPlace & { why: string })[] }

const SIDE = 'app/sheards/dashboard/sidebar/sidebar.ts';
export const ICON_PLACES: Record<string, IconPlaces> = {
	'i-bell': {
		follows: [
			{ where: 'جرس الإشعارات في الشريط العلوي (كل اللوحات: عميل ومقدّم خدمة ومسوّق ومدير)', file: 'app/sheards/notification-bell/notification-bell.html', needle: 'href="#i-bell"' },
			{ where: 'عنوان صفحة «تفضيلات الإشعارات» (مقدّم الخدمة)', file: 'app/pages/dashboard/provider-overview/notifications/favorite/favorite.html', needle: 'href="#i-bell"' },
			{ where: 'قسم قنوات الإشعارات في إعداد ملف مقدّم الخدمة (أيقونتان)', file: 'app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html', needle: 'href="#i-bell"' },
			{ where: 'عنوان «قنوات الإشعارات» في إعدادات إشعارات العميل', file: 'app/pages/dashboard/clients-overview/notifications/notifications-settings/notifications-settings.html', needle: 'href="#i-bell"' },
			{ where: 'لوحة المدير: تنبيهات عاجلة (العنوان وبنود التنبيه)', file: 'app/pages/dashboard/supper-admin-overview/supper-admin-overview/supper-admin-overview.html', needle: "'#i-bell'" },
			{ where: 'لوحة المدير: بطاقات إحصاء المستخدمين (تستعمل المعرّف كأيقونة عامة)', file: 'app/pages/dashboard/supper-admin-overview/sa-users/sa-users.ts', needle: "ic: 'i-bell'" },
		],
		notFollowed: [
			{ where: 'عنصر «الإشعارات» في القائمة الجانبية (عميل / مقدّم خدمة / مسوّق / مدير)', file: SIDE, needle: "icon: 'M15 17h5l-1.405-1.405", why: 'مسار نصّي بهندسة مختلفة (جرس آخر) يبنيه ملف TypeScript، لا <symbol>.' },
			{ where: 'الحالة الفارغة في «مركز الإشعارات» للعميل', file: 'app/pages/dashboard/clients-overview/notifications/notifications-center/notifications-center.html', needle: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', why: 'نسخة <svg> مضمّنة في القالب.' },
			{ where: 'الحالة الفارغة في «مركز الإشعارات» لمقدّم الخدمة', file: 'app/pages/dashboard/provider-overview/notifications/notifications.html', needle: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', why: 'نسخة <svg> مضمّنة في القالب.' },
			{ where: 'الحالة الفارغة في إشعارات المسوّق', file: 'app/pages/dashboard/marketer-overview/notifications/notifications.html', needle: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', why: 'نسخة <svg> مضمّنة في القالب.' },
			{ where: 'أيقونة بطاقة في «تسليمات الفريق» (مقدّم خدمة شركة)', file: 'app/pages/dashboard/provider-overview/company/team-deliveries/team-deliveries.html', needle: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', why: 'نسخة <svg> مضمّنة في القالب.' },
			{ where: 'عنوان «البيانات المهنية» في الملف العام لمقدّم الخدمة', file: 'app/pages/dashboard/provider-overview/profile/public/public.html', needle: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', why: 'نسخة <svg> مضمّنة في القالب.' },
			{ where: 'بطاقة إشعار تُبنى نصًّا في «تفضيلات الإشعارات» (favorite.ts)', file: 'app/pages/dashboard/provider-overview/notifications/favorite/favorite.ts', needle: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', why: 'سلسلة svg يبنيها TypeScript.' },
			{ where: 'أيقونات صفحة إعدادات النظام للمدير', file: 'app/pages/dashboard/supper-admin-overview/sa-system-settings/sa-system-settings.ts', needle: 'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9', why: 'مسارات نصّية يبنيها TypeScript.' },
			{ where: 'صفحة «اتصل بنا» (جرس بمعرّف آخر ws-bell)', file: 'app/pages/website/contact/contact.html', needle: 'href="#ws-bell"', why: 'معرّف مختلف (ws-bell) وله مفتاح خاص به.' },
			{ where: 'صفحة «كيف يعمل» لمقدّم الخدمة (معرّف آخر hwp-bell)', file: 'app/pages/website/how-it-works/provider/provider.html', needle: 'href="#hwp-bell"', why: 'معرّف مختلف (hwp-bell) وله مفتاح خاص به.' },
			{ where: 'ملف العميل: قسم الإشعارات (معرّف آخر ic-bell)', file: 'app/pages/dashboard/clients-overview/profile/profile.html', needle: 'href="#ic-bell"', why: 'معرّف مختلف (ic-bell) وله مفتاح خاص به.' },
		],
	},
};
