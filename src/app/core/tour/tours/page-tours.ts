import { TourDefinition } from '../tour.types';

/**
 * Small tours for single pages. Each one is offered (a «جولة في هذه الصفحة» chip) only while the visitor is ON that page, and never starts by itself.
 * `presence` = an element that must exist for the chip to show (the registration form's fields only exist after the account type is chosen).
 * Every sentence restates what the page itself says. Modern Standard Arabic; the audio files are rendered from exactly these texts.
 */
export interface PageTourEntry {
	tour: TourDefinition;
	/** matches the URL path (no query / hash / trailing slash) */
	path: string;
	presence?: string;
}

const ABOUT: TourDefinition = { id: 'page-about-v1', title: 'جولة في صفحة من نحن', steps: [
	{ id: 'about-intro', route: '/about', target: '.about-hero', title: 'من نحن',
		text: 'هذه صفحة من نحن. وسيط AI ليس مجرد سوق، بل شريك ذكي يضمن حقوق جميع الأطراف، ويجعل كل خطوة شفافة وموثقة.' },
	{ id: 'about-mission', route: '/about', target: '[data-tour="about-mission"]', title: 'رسالتنا',
		text: 'رسالتنا حل مشكلة الثقة في سوق الخدمات الرقمية. بين طالب الخدمة ومقدّمها يقف وسيط بالذكاء الاصطناعي والعقود الموثقة، فتحمي جميع الأطراف، ويعمل الذكاء الاصطناعي في كل خطوة، ويبقى السوق عربيًا متكاملًا ومجتمعه المهني موثوقًا.' },
	{ id: 'about-values', route: '/about', target: '.values-grid', title: 'قيمنا',
		text: 'هذه قيمنا. الثقة أولًا، والذكاء في الخدمة، والشفافية الكاملة، والجودة لا الكمية، ونمو الجميع، والهوية العربية.' },
	{ id: 'about-ai', route: '/about', target: '.ai-section', title: 'الذكاء الاصطناعي في وسيط',
		text: 'هنا يظهر دور الذكاء الاصطناعي. ليس مجرد أتمتة، بل يعمل على طبقات متعددة، منها مستوى المقدّم الذي يُحسب تلقائيًا من نقاطه ومشاريعه المكتملة وتقييمات العملاء، والترشيح حسب التخصص والتاريخ والسعر.' },
	{ id: 'about-team', route: '/about', target: '.team-grid', title: 'فريقنا',
		text: 'وهنا فريق وسيط AI، وهو فريق متنوع من الخبراء في التقنية والتصميم وريادة الأعمال.' },
] };

const BLOG: TourDefinition = { id: 'page-blog-v1', title: 'جولة في المدونة', steps: [
	{ id: 'blog-intro', route: '/blog', target: '.blog-hero', title: 'مدونة وسيط AI',
		text: 'هذه مدونة وسيط AI. مقالات متخصصة لمقدمي الخدمات وطالبيها والوسطاء، فيها أفكار ونصائح تساعدك على النمو في سوق الخدمات المهنية الرقمي.' },
	{ id: 'blog-search', route: '/blog', target: '.search-card', title: 'ابحث في المدونة',
		text: 'ابحث هنا عن أي موضوع، أو اختر وسمًا من الوسوم السريعة.' },
	{ id: 'blog-categories', route: '/blog', target: '.cat-strip', title: 'الأقسام',
		text: 'وهنا تصنّف المقالات بحسب القسم، ويظهر بجانب كل قسم عدد مقالاته.' },
	{ id: 'blog-posts', route: '/blog', target: '.posts-list', title: 'المقالات',
		text: 'وهذه قائمة المقالات. اضغط على أي مقال لتقرأه، وإن لم تجد ما تريد فاضغط على تحميل مزيد من المقالات.' },
] };

const CONTACT: TourDefinition = { id: 'page-contact-v1', title: 'جولة في صفحة اتصل بنا', steps: [
	{ id: 'contact-intro', route: '/contact', target: '.page-hero', title: 'اتصل بنا',
		text: 'هذه صفحة اتصل بنا. سواء كان لديك سؤال أو اقتراح أو طلب شراكة، فريقنا يرد خلال أربع وعشرين ساعة.' },
	{ id: 'contact-form', route: '/contact', target: '.form-card', title: 'أرسل رسالتك',
		text: 'اكتب اسمك وبريدك الإلكتروني، واختر نوع الطلب، ثم اكتب رسالتك واضغط على إرسال الرسالة.' },
	{ id: 'contact-type', route: '/contact', target: '#f-type', title: 'نوع الطلب',
		text: 'نوع الطلب يساعدنا على توجيه رسالتك. يمكنك اختيار استفسار عام، أو دعم فني، أو شراكة تجارية، أو إبلاغ عن مشكلة، أو اقتراح وتحسين.' },
	{ id: 'contact-info', route: '/contact', target: '.info-col', title: 'طرق أخرى للتواصل',
		text: 'وهنا طرق التواصل الأخرى: البريد الإلكتروني، وواتساب للدعم السريع، وساعات العمل من الأحد إلى الخميس، وحساباتنا على وسائل التواصل الاجتماعي.' },
] };

const MARKETPLACE: TourDefinition = { id: 'page-marketplace-v1', title: 'جولة في تسوق الخدمات', steps: [
	{ id: 'market-search', route: '/marketplace', target: '.search-bar', title: 'تسوق الخدمات',
		text: 'هذا سوق الخدمات. ابحث هنا عن الخدمة التي تحتاجها بكتابة اسمها أو وصفها.' },
	{ id: 'market-filters', route: '/marketplace', target: '.filters-btn', title: 'الفلاتر',
		text: 'ويفتح لك هذا الزر الفلاتر لتضييق النتائج، مثل الفئة، ثم يمكنك إعادة ضبطها عندما تريد البدء من جديد.' },
] };

const REGISTER_ROLES: TourDefinition = { id: 'page-register-roles-v1', title: 'جولة في اختيار نوع الحساب', steps: [
	{ id: 'reg-roles-intro', route: '/auth/register', target: '.roles-grid', title: 'اختر نوع حسابك',
		text: 'هنا تختار نوع حسابك: طالب خدمة، أو مقدّم خدمة، أو وسيط تسويقي. حسابات الأفراد وحساب الوسيط التسويقي متاحة الآن، وحسابات الشركات قريبًا، ومقدّم الخدمة يحتاج إلى توثيق هويته.' },
	{ id: 'reg-roles-next', route: '/auth/register', target: '.role-cta', title: 'ثم تابع',
		text: 'بعد اختيار النوع المناسب اضغط على متابعة لتنتقل إلى إدخال بيانات حسابك.' },
] };

const REGISTER_FORM: TourDefinition = { id: 'page-register-form-v1', title: 'جولة في نموذج التسجيل', steps: [
	{ id: 'reg-username', route: '/auth/register', target: '#username', title: 'اسم المستخدم',
		text: 'اختر اسم مستخدم لحسابك.' },
	{ id: 'reg-email', route: '/auth/register', target: '#email', title: 'البريد الإلكتروني',
		text: 'اكتب بريدك الإلكتروني. سيصلك عليه رمز التحقق، فاحرص على أن يكون صحيحًا.' },
	{ id: 'reg-mobile', route: '/auth/register', target: 'app-phone-input', title: 'رقم الجوال',
		text: 'أدخل رقم جوالك.' },
	{ id: 'reg-password', route: '/auth/register', target: '#password', title: 'كلمة المرور',
		text: 'اختر كلمة مرور قوية، ثم أعد كتابتها في الحقل التالي للتأكيد.' },
	{ id: 'reg-next', route: '/auth/register', target: '#password-confirm', title: 'وبعدها',
		text: 'بعد ذلك تكمل الخطوات حتى تؤكد بريدك الإلكتروني برمز يصلك، ثم يمكنك دخول حسابك.' },
] };

export const PAGE_TOURS: PageTourEntry[] = [
	{ path: '/about', tour: ABOUT },
	{ path: '/blog', tour: BLOG },
	{ path: '/contact', tour: CONTACT },
	{ path: '/marketplace', tour: MARKETPLACE },
	{ path: '/auth/register', presence: '.roles-grid', tour: REGISTER_ROLES },
	{ path: '/auth/register', presence: '#email', tour: REGISTER_FORM },
];

const clean = (path: string) => (path.split(/[?#]/)[0] || '/').replace(/\/$/, '') || '/';
/** every tour of this path (the registration page has one per step) */
export const pageToursFor = (path: string): PageTourEntry[] => PAGE_TOURS.filter(e => e.path === clean(path));
/** the tour to offer now: the first one of the path whose `presence` element is on screen (`present` answers that) */
export const pageTourFor = (path: string, present: (selector: string) => boolean = () => true): PageTourEntry | null =>
	pageToursFor(path).find(e => !e.presence || present(e.presence)) ?? null;
