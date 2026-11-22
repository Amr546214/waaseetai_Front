import { TourDefinition } from '../tour.types';

/**
 * The guide of the client's «تعديل الملف الشخصي» page: what each tab and field does. It replaces the page's own silent guide: same steps, now narrated (pre-rendered audio per step)
 * and run by the shared tour engine. A step that lives in another tab first clicks that tab (`click`). A missing field shows as a centred card instead of failing.
 */
export const CLIENT_PROFILE_EDIT_ROUTE = '/client-overview/profile/edit';
const R = CLIENT_PROFILE_EDIT_ROUTE;
const tab = (id: string) => `[data-tour-tab="${id}"]`;

export const CLIENT_PROFILE_EDIT_TOUR: TourDefinition = {
	id: 'client-profile-edit-v1',
	title: 'جولة في تعديل الملف الشخصي',
	steps: [
		{ id: 'cpe-photo', route: R, click: tab('profile'), target: 'input[type="file"]', title: 'الصورة الشخصية',
			text: 'الصورة الشخصية. ارفع صورة بصيغة JPG أو PNG بحجم أقصى 5 ميجابايت. ويمكنك استبدالها أو حذفها من هنا.' },
		{ id: 'cpe-bio', route: R, click: tab('profile'), target: 'textarea[formcontrolname="bio"]', title: 'نبذة عنك',
			text: 'النبذة التعريفية. اكتب نبذة لا تتجاوز ألف حرف، أو اضغط زر وسيط AI ليقترح لك صياغة تراجعها قبل الحفظ. ثم اضغط حفظ التحديثات.' },
		{ id: 'cpe-interests', route: R, click: tab('profile'), target: 'input[placeholder="أضف اهتمام جديد"]', title: 'الاهتمامات والمهارات',
			text: 'الاهتمامات والمهارات. اكتب اهتمامًا واضغط إضافة، واحذف أي عنصر من علامة الإزالة. وتُحفظ التغييرات في ملفك.' },
		{ id: 'cpe-links', route: R, click: tab('profile'), target: 'input[formcontrolname="portfolioUrl"]', title: 'الروابط الشخصية',
			text: 'الروابط الشخصية. أضف روابط أعمالك وحساباتك المهنية، وابدأ الرابط بـ https أو http، واترك الحقول الاختيارية فارغة إن لم تحتجها.' },
		{ id: 'cpe-prefs', route: R, click: tab('profile'), target: 'select[formcontrolname="interfaceLanguage"]', title: 'تفضيلات العرض والإشعارات',
			text: 'تفضيلات العرض والإشعارات. اللغة والمنطقة الزمنية تفضيلات محفوظة في ملفك ولا تغيّر لغة الموقع. واختر البريد أو الإشعار اللحظي.' },
		{ id: 'cpe-basics', route: R, click: tab('basics'), target: '[data-testid="username-field"]', title: 'البيانات الأساسية',
			text: 'البيانات الأساسية. تغيير الاسم يُرسل للمراجعة ويُطبّق بعد الاعتماد، والبريد الإلكتروني ورقم الجوال للقراءة فقط. وتتابع حالة الطلب من طلبات تعديل الملف.' },
		{ id: 'cpe-identity', route: R, click: tab('identity'), target: '[data-testid="identity-form"]', title: 'الهوية والتوثيق',
			text: 'الهوية والتوثيق. الدولة والمدينة تُحفظان مباشرة، ورقم الهوية يُرسل للمراجعة. ولرفع مستندات الهوية افتح استكمال البيانات.' },
		{ id: 'cpe-contact', route: R, click: tab('contact'), target: 'app-phone-input[formcontrolname="alternativePhone"]', title: 'بيانات التواصل',
			text: 'بيانات التواصل. يُحفظ رقم واتساب ومدينة الإقامة. واختيار الدولة يحدد قائمة المدن.' },
		{ id: 'cpe-paypal', route: R, click: tab('banking'), target: '#cl-paypal', title: 'بريد PayPal',
			text: 'بريد PayPal. يُستخدم للمدفوعات والاسترداد، ويُحفظ مباشرة دون مراجعة، ويمكنك ترك الحقل فارغًا لإزالته.' },
	],
};
