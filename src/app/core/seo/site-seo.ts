import { SOCIAL_LINKS } from '../constants/social-links';
import { BLOG_POSTS } from '../../pages/website/blog/blog-data';

export const SITE_ORIGIN = 'https://waseetai.com';
export const SITE_NAME = 'وسيط AI';
export const SUPPORT_EMAIL = 'support@waseetai.com';
export const SUPPORT_PHONE = '+966 55 996 5056';
export const SHARE_IMAGE = `${SITE_ORIGIN}/assets/social/waseetai-og-v3.jpg`;
export const DEFAULT_DESCRIPTION = 'وسيط AI للخدمات المهنية الموثقة - اربط طلبات الخدمة والعقود والمدفوعات في تجربة واحدة مدعومة بذكاء اصطناعي';
export const INDEX_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';
export const NOINDEX_ROBOTS = 'noindex, nofollow';
/** Reserved application paths must win over the generic marketplace service slug. */
export const PRIVATE_MARKETPLACE_PATHS = ['/marketplace/cart', '/marketplace/comparison', '/marketplace/tracking'];

export interface PageSeo { title: string; description: string; path: string; indexable: boolean; }
const page = (path: string, title: string, description: string): PageSeo => ({ path, title, description, indexable: true });
/** Only published, public content belongs here. Personal carts, comparisons, tracking, auth and dashboards are excluded. */
export const PUBLIC_PAGES: PageSeo[] = [
  page('/', 'الخدمات المهنية الذكية', DEFAULT_DESCRIPTION),
  page('/marketplace', 'سوق الخدمات', 'تصفح الخدمات المهنية في وسيط AI، وقارن الخيارات واختر الخدمة المناسبة لاحتياجك.'),
  page('/marketplace/categories', 'تصنيفات الخدمات', 'استكشف تخصصات وتصنيفات الخدمات المهنية المتاحة في سوق وسيط AI.'),
  page('/about', 'من نحن', 'تعرف على وسيط AI وكيف يربط طالبي الخدمات بمقدميها وينظم التعاقد والتنفيذ والتسليم.'),
  page('/blog', 'المدونة', 'مقالات وإرشادات لطالبي الخدمات ومقدميها والوسطاء حول العمل المهني واستخدام وسيط AI.'),
  page('/how-it-works', 'كيف يعمل الموقع', 'تعرف على خطوات استخدام وسيط AI، من اختيار الخدمة والتعاقد إلى متابعة التنفيذ والتسليم.'),
  page('/how-it-works/client', 'كيف يعمل لطالب الخدمة', 'دليل طالب الخدمة لإنشاء الطلب واختيار مقدم الخدمة ومتابعة المشروع على وسيط AI.'),
  page('/how-it-works/provider', 'كيف يعمل لمقدم الخدمة', 'دليل مقدم الخدمة لإعداد ملفه وعرض خدماته وتقديم العروض وتنفيذ المشاريع على وسيط AI.'),
  page('/how-it-works/marketer', 'كيف يعمل للوسيط', 'تعرف على دور الوسيط وخطوات الإحالة والتسويق ومتابعة العمولات في وسيط AI.'),
  page('/pricing', 'الأسعار والعمولات', 'اطلع على تفاصيل الأسعار والعمولات وآلية احتسابها في وسيط AI.'),
  page('/partners', 'الشركاء', 'تعرف على فرص التعاون والشراكة مع وسيط AI في تقديم الخدمات المهنية.'),
  page('/press', 'المركز الإعلامي', 'الأخبار والمواد الإعلامية ومعلومات التواصل الإعلامي الخاصة بوسيط AI.'),
  page('/contact', 'تواصل معنا', 'تواصل مع فريق وسيط AI للدعم والاستفسارات العامة والشراكات عبر قنوات التواصل الرسمية.'),
  page('/faq', 'الأسئلة الشائعة', 'إجابات عن الأسئلة الشائعة حول الحسابات والخدمات والمدفوعات والتعاقد في وسيط AI.'),
  page('/top-rated', 'الخدمات الأعلى تقييمًا', 'تصفح الخدمات الأعلى تقييمًا في سوق وسيط AI واختر ما يناسب مشروعك.'),
  page('/most-ordered', 'الخدمات الأكثر طلبًا', 'استكشف الخدمات الأكثر طلبًا في سوق وسيط AI.'),
  page('/featured', 'الخدمات المميزة', 'تصفح مجموعة الخدمات المميزة في سوق وسيط AI.'),
  page('/exclusive', 'الخدمات الحصرية', 'استكشف الخدمات الحصرية المعروضة في سوق وسيط AI.'),
  page('/newest', 'أحدث الخدمات', 'تعرف على أحدث الخدمات المهنية المضافة إلى سوق وسيط AI.'),
  page('/privacy', 'سياسة الخصوصية', 'اطلع على سياسة الخصوصية وكيفية التعامل مع البيانات الشخصية في وسيط AI.'),
  page('/terms', 'شروط الاستخدام', 'اطلع على شروط استخدام وسيط AI وحقوق المستخدمين والتزاماتهم.'),
  page('/cookies', 'سياسة ملفات الارتباط', 'تعرف على استخدام ملفات الارتباط وإعدادات تفضيلاتك في وسيط AI.'),
  page('/legal', 'السياسات والاتفاقيات', 'تصفح السياسات والاتفاقيات المنظمة لاستخدام وسيط AI وخدماته.'),
  page('/legal/provider-agreement', 'اتفاقية مقدم الخدمة', 'شروط والتزامات مقدم الخدمة عند عرض الخدمات وتنفيذ المشاريع على وسيط AI.'),
  page('/legal/payment-escrow-disputes', 'سياسة المدفوعات والضمان والنزاعات', 'تعرف على سياسة المدفوعات والضمان المالي والتعامل مع النزاعات في وسيط AI.'),
  page('/legal/users-services-contracts', 'سياسة المستخدمين والخدمات والعقود', 'القواعد المنظمة للمستخدمين والخدمات والتعاقدات على وسيط AI.'),
  page('/legal/marketing-broker-commissions', 'سياسة التسويق وعمولات الوسطاء', 'تعرف على قواعد التسويق والإحالات وعمولات الوسطاء في وسيط AI.'),
  page('/legal/accreditation-ai-governance', 'سياسة الاعتماد وحوكمة الذكاء الاصطناعي', 'تعرف على سياسة الاعتماد المهني واستخدام الذكاء الاصطناعي وحدود دوره في وسيط AI.'),
  page('/legal/acceptable-use-ip', 'سياسة الاستخدام المقبول والملكية الفكرية', 'قواعد الاستخدام المقبول وحماية حقوق الملكية الفكرية في وسيط AI.'),
  page('/support/help-center', 'مركز المساعدة', 'أدلة وإرشادات استخدام وسيط AI والحصول على المساعدة في الحسابات والخدمات.'),
  page('/support/help-article/escrow', 'دليل الضمان المالي', 'دليل فهم الضمان المالي وإجراءات المدفوعات المرتبطة بالمشاريع على وسيط AI.'),
  page('/support/help-article/disputes', 'دليل النزاعات', 'تعرف على إجراءات طلب المساعدة والتعامل مع النزاعات على وسيط AI.'),
  page('/support/help-article/ai', 'دليل الذكاء الاصطناعي', 'تعرف على أدوات الذكاء الاصطناعي المساعدة في وسيط AI وكيفية الاستفادة منها.'),
  page('/support/help-article/commissions', 'دليل العمولات', 'إرشادات فهم العمولات وآلية احتسابها ومتابعتها في وسيط AI.'),
  page('/support/join-provider', 'الانضمام كمقدم خدمة', 'تعرف على خطوات ومتطلبات الانضمام إلى وسيط AI كمقدم خدمة مهنية.'),
  page('/support/join-marketer', 'الانضمام كوسيط', 'تعرف على خطوات الانضمام إلى وسيط AI كوسيط للتسويق والإحالات.'),
  ...BLOG_POSTS.map(post => page(`/blog/${post.slug}`, post.title, post.excerpt)),
];

export function isOfficialHost(host: string): boolean {
  return /^(?:www\.)?waseetai\.com$/i.test(host);
}
export function cleanPath(url: string): string {
  try { return new URL(url, SITE_ORIGIN).pathname.replace(/\/+$/, '') || '/'; }
  catch { return '/'; }
}
/** Unknown URLs are not advertised as canonical pages. Data-backed service URLs are canonicalized after navigation. */
export function pageSeo(url: string): PageSeo {
  const path = cleanPath(url);
  let decodedPath = path.toLowerCase();
  try { decodedPath = decodeURIComponent(path).toLowerCase(); } catch { return { path, title: 'الخدمات المهنية الذكية', description: DEFAULT_DESCRIPTION, indexable: false }; }
  if (PRIVATE_MARKETPLACE_PATHS.some(p => decodedPath === p || decodedPath.startsWith(p + '/'))) {
    return { path, title: 'الخدمات المهنية الذكية', description: DEFAULT_DESCRIPTION, indexable: false };
  }
  const known = PUBLIC_PAGES.find(p => p.path === path);
  if (known) return known;
  if (/^\/marketplace\/(?:offer\/)?[\p{L}\p{N}_%.-]+$/u.test(path)) {
    return page(path, path.startsWith('/marketplace/offer/') ? 'تفاصيل العرض' : 'تفاصيل الخدمة', 'تعرف على تفاصيل الخدمة ومقدمها وخيارات التعاقد المتاحة في سوق وسيط AI.');
  }
  return { path, title: 'الخدمات المهنية الذكية', description: DEFAULT_DESCRIPTION, indexable: false };
}

export function organizationSchema(name = SITE_NAME, email = SUPPORT_EMAIL, phone = SUPPORT_PHONE) {
  return { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', '@id': `${SITE_ORIGIN}/#organization`, name, alternateName: ['موقع وسيط AI', 'Waseet AI'], url: `${SITE_ORIGIN}/`,
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/assets/brand/waseet-mark.png` },
      email, telephone: phone, sameAs: Object.values(SOCIAL_LINKS),
      contactPoint: [{ '@type': 'ContactPoint', email, telephone: phone, contactType: 'customer support', availableLanguage: ['ar', 'en'] }] },
    { '@type': 'WebSite', '@id': `${SITE_ORIGIN}/#website`, url: `${SITE_ORIGIN}/`, name, alternateName: 'Waseet AI', inLanguage: 'ar-SA', publisher: { '@id': `${SITE_ORIGIN}/#organization` } },
  ] };
}
export const escapeHtml = (s: string): string => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
export const schemaJson = (value: unknown): string => JSON.stringify(value).replace(/</g, '\\u003c');
