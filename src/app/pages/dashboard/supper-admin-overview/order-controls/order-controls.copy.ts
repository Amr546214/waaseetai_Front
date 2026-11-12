import { ControlAction } from '../../../../core/services/admin-order-controls-api.service';

/**
 * Arabic copy of the admin controls. The server answers with STABLE reason codes (src/constants/admin-controls.ts on the backend); the screen shows the matching sentence here
 * and never a generic «غير متاح». A code that is not in the table falls back to the server's own Arabic message, never to an English text or a generic phrase.
 */
export interface ActionDef { action: ControlAction; label: string; tone: 'warn' | 'danger' | 'ghost'; reasonRequired: boolean; needsConfirm: boolean; hasQuote: boolean; title: string; hint: string; submit: string; done: string }

export const ACTION_DEFS: Record<ControlAction, ActionDef> = {
  REQUEST_SUSPEND: { action: 'REQUEST_SUSPEND', label: 'تعليق الطلب مؤقتاً', tone: 'warn', reasonRequired: true, needsConfirm: false, hasQuote: false, title: 'تعليق الطلب مؤقتًا', hint: 'لن يستقبل الطلب عروضًا جديدة ولن يظهر لمقدمي الخدمة، وتبقى بياناته وعروضه الحالية كما هي ولا يمكن اختيار عرض عليه حتى يُستأنف.', submit: 'تأكيد التعليق', done: 'عُلّق الطلب مؤقتًا' },
  REQUEST_RESUME: { action: 'REQUEST_RESUME', label: 'استئناف الطلب', tone: 'ghost', reasonRequired: false, needsConfirm: false, hasQuote: false, title: 'استئناف الطلب', hint: 'يعود الطلب لاستقبال العروض كما كان، ولا يتغيّر أي عرض أو مبلغ.', submit: 'تأكيد الاستئناف', done: 'استؤنف الطلب' },
  REQUEST_CANCEL: { action: 'REQUEST_CANCEL', label: 'إلغاء الطلب', tone: 'danger', reasonRequired: true, needsConfirm: true, hasQuote: true, title: 'إلغاء الطلب', hint: 'إلغاء إداري نهائي: تُغلق العروض المفتوحة، وإن كان للطلب عقد غير ممول يُلغى معه. إن وُجد مبلغ محتجز، اختر أولًا الإلغاء مع استرداد المتبقي أو الإغلاق بصرف إداري؛ لكل قرار معاينة وتأكيد مستقلان.', submit: 'تأكيد إلغاء الطلب', done: 'أُلغي الطلب' },
  OFFER_SUSPEND: { action: 'OFFER_SUSPEND', label: 'تعليق العرض', tone: 'warn', reasonRequired: true, needsConfirm: false, hasQuote: false, title: 'تعليق العرض', hint: 'يبقى العرض محفوظًا كما هو لكن لا يمكن للعميل قبوله أو اختياره حتى يُستأنف.', submit: 'تأكيد التعليق', done: 'عُلّق العرض' },
  OFFER_RESUME: { action: 'OFFER_RESUME', label: 'استئناف العرض', tone: 'ghost', reasonRequired: false, needsConfirm: false, hasQuote: false, title: 'استئناف العرض', hint: 'يصبح العرض قابلًا للاختيار من جديد.', submit: 'تأكيد الاستئناف', done: 'استؤنف العرض' },
  CONTRACT_FREEZE: { action: 'CONTRACT_FREEZE', label: 'تجميد العقد', tone: 'warn', reasonRequired: true, needsConfirm: false, hasQuote: false, title: 'تجميد العقد', hint: 'تتوقف أي حركة مالية جديدة على العقد (اعتماد المراحل وصرفها، التمويل، التسويات). ما صُرف سابقًا لا يتغيّر.', submit: 'تأكيد التجميد', done: 'جُمّد العقد' },
  CONTRACT_UNFREEZE: { action: 'CONTRACT_UNFREEZE', label: 'فكّ التجميد', tone: 'ghost', reasonRequired: false, needsConfirm: false, hasQuote: false, title: 'فكّ تجميد العقد', hint: 'يُرفع الإيقاف فقط. لا تُنفَّذ أي دفعة تلقائيًا بعد الفكّ.', submit: 'تأكيد فكّ التجميد', done: 'فُكّ تجميد العقد' },
  CONTRACT_CANCEL: { action: 'CONTRACT_CANCEL', label: 'إلغاء العقد', tone: 'danger', reasonRequired: true, needsConfirm: true, hasQuote: true, title: 'إلغاء العقد', hint: 'يُلغى العقد ويُغلق الطلب والمشروع. مع وجود محتجز، يختار مدير النظام صراحةً الاسترداد للإلغاء أو الصرف للإغلاق الإداري، ثم يراجع الأثر ويؤكده.', submit: 'تأكيد إلغاء العقد', done: 'أُلغي العقد' },
  ESCROW_REFUND: { action: 'ESCROW_REFUND', label: 'إعادة المبلغ للطالب', tone: 'danger', reasonRequired: true, needsConfirm: true, hasQuote: true, title: 'إعادة المبلغ المحتجز للطالب', hint: 'يُعاد كامل المبلغ المحتجز فعليًا إلى رصيد الطالب ويُلغى العقد. ما صُرف سابقًا لمقدم الخدمة لا يُسترد.', submit: 'تأكيد الإعادة', done: 'أُعيد المبلغ المحتجز إلى الطالب' },
  ESCROW_RELEASE: { action: 'ESCROW_RELEASE', label: 'إفراج يدوي عن الضمان', tone: 'danger', reasonRequired: true, needsConfirm: true, hasQuote: true, title: 'صرف المبلغ المحتجز لمقدم الخدمة', hint: 'يُصرف كامل المبلغ المحتجز فعليًا لمقدم الخدمة بعد عمولة المنصة المسجّلة على هذا الضمان، ويُغلق العقد.', submit: 'تأكيد الصرف', done: 'صُرف المبلغ المحتجز لمقدم الخدمة' },
};

export const ACTIONS_BY_KIND: Record<'request' | 'offer' | 'contract', ControlAction[]> = {
  request: ['REQUEST_SUSPEND', 'REQUEST_RESUME', 'REQUEST_CANCEL'],
  offer: ['OFFER_SUSPEND', 'OFFER_RESUME'],
  contract: ['CONTRACT_FREEZE', 'CONTRACT_UNFREEZE', 'CONTRACT_CANCEL', 'ESCROW_REFUND', 'ESCROW_RELEASE'],
};

/** Codes that only say "this action is the opposite of the current state": the opposite button is shown instead, so no line is needed for them. */
export const NOOP_CODES = new Set(['REQUEST_NOT_SUSPENDED', 'REQUEST_ALREADY_SUSPENDED', 'OFFER_NOT_SUSPENDED', 'OFFER_ALREADY_SUSPENDED', 'CONTRACT_NOT_FROZEN', 'CONTRACT_ALREADY_FROZEN']);

export const REASON_COPY: Record<string, string> = {
  ADMIN_SUPER_ADMIN_REQUIRED: 'القرار المالي (إعادة المبلغ، الصرف، إلغاء عقد يحتجز مبلغًا) لمدير النظام (Super Admin) وحده.',
  SUPER_ADMIN_REQUIRED: 'القرار المالي لمدير النظام (Super Admin) وحده.',
  ADMIN_PERMISSION_DENIED: 'ليست لديك صلاحية تنفيذ هذا الإجراء. اطلب الصلاحية من مدير النظام.',
  PERMISSION_DENIED: 'ليست لديك صلاحية تنفيذ هذا الإجراء. اطلب الصلاحية من مدير النظام.',
  NOT_FOUND: 'العنصر غير موجود.',
  IDEMPOTENCY_KEY_REQUIRED: 'تعذّر تأمين العملية ضد التكرار. حدّث الصفحة وأعد المحاولة.',
  IDEMPOTENCY_KEY_CONFLICT: 'استُخدم مفتاح العملية نفسه لطلب مختلف. أعد فتح النافذة وحاول مجددًا.',
  REASON_REQUIRED: 'اكتب سبب القرار (5 أحرف على الأقل).',
  REASON_TOO_LONG: 'سبب القرار طويل (الحد الأقصى 500 حرف).',
  CONFIRMATION_REQUIRED: 'يلزم تأكيد صريح قبل التنفيذ.',
  VERSION_REQUIRED: 'حدّث الصفحة ثم أعد المحاولة.',
  STALE_VERSION: 'تغيّر العنصر منذ عرضه عليك. حدّثنا البيانات، راجعها ثم أعد التأكيد.',
  REQUEST_DRAFT: 'الطلب مسودة ولم يُنشر بعد.',
  REQUEST_NOT_OPEN: 'يُعلَّق الطلب المفتوح لاستقبال العروض فقط.',
  REQUEST_HAS_CONTRACT: 'للطلب عقد مرتبط: يُدار من العقد (تجميد أو إلغاء) ولا يُعلَّق وحده.',
  REQUEST_ALREADY_CANCELLED: 'الطلب ملغى بالفعل.',
  REQUEST_COMPLETED: 'الطلب مكتمل ولا يُلغى.',
  REQUEST_SETTLED: 'أُغلق الطلب بتسوية مالية ولا يُلغى.',
  REQUEST_ALREADY_SUSPENDED: 'الطلب معلّق بالفعل.',
  REQUEST_NOT_SUSPENDED: 'الطلب غير معلّق.',
  OFFER_ALREADY_SUSPENDED: 'العرض معلّق بالفعل.',
  OFFER_NOT_SUSPENDED: 'العرض غير معلّق.',
  OFFER_STATE_NOT_SUSPENDABLE: 'لا يُعلَّق العرض في حالته الحالية: يُعلَّق العرض الحيّ فقط (مقدّم أو قيد التفاوض).',
  OFFER_LINKED_TO_CONTRACT: 'العرض مرتبط بعقد: يُدار من العقد ولا تُغيَّر حالته وحده.',
  OFFER_REQUEST_CLOSED: 'الطلب المرتبط بالعرض مغلق (ملغى أو مكتمل).',
  NO_CONTRACT: 'لا يوجد عقد لهذا الطلب بعد، فلا توجد إجراءات عقد أو ضمان.',
  CONTRACT_CLOSED: 'العقد مغلق (مكتمل أو ملغى): لا إجراءات عليه.',
  CONTRACT_ALREADY_FROZEN: 'العقد مجمّد بالفعل.',
  CONTRACT_NOT_FROZEN: 'العقد غير مجمّد.',
  CONTRACT_FROZEN: 'العقد مجمّد: فُكّ التجميد أولًا قبل أي حركة مالية.',
  ACTIVE_DISPUTE: 'يوجد نزاع مفتوح على المشروع: يُحسم النزاع أولًا ولا تُنفَّذ حركة مالية إدارية بجانبه.',
  CANCELLATION_AGREED_PENDING_SETTLEMENT: 'اتفق الطرفان على الإلغاء بالتراضي والتسوية بانتظار الإدارة: تُنفَّذ من شاشة «طلبات الإلغاء».',
  NO_ESCROW: 'لا يوجد ضمان ممول لهذا العقد بعد.',
  ESCROW_ALREADY_RELEASED: 'الضمان صُرف بالكامل لمقدم الخدمة ولا يوجد مبلغ محتجز.',
  ESCROW_ALREADY_REFUNDED: 'الضمان أُعيد إلى العميل مسبقًا ولا يوجد مبلغ محتجز.',
  NO_HELD_BALANCE: 'لا يوجد مبلغ محتجز في الضمان.',
  EXPECTED_AMOUNT_REQUIRED: 'حدّث النافذة ليظهر المبلغ المحتجز ثم أعد التأكيد.',
  HELD_BALANCE_CHANGED: 'تغيّر المبلغ المحتجز منذ عرضه عليك. راجع المبالغ المحدّثة ثم أعد التأكيد.',
  RELEASE_REQUIRES_ACTIVE_CONTRACT: 'لا يُصرف الضمان لمقدم الخدمة إلا لعقد نشط وقّعه الطرفان.',
  SETTLEMENT_CHOICE_REQUIRED: 'العقد يحتجز مبلغًا: اختر التسوية صراحةً (إعادة المحتجز للعميل).',
  CANCELLATION_SETTLEMENT_NOT_APPROVED: 'يوجد مبلغ محتجز: يحتاج الإغلاق قرارًا ماليًا صريحًا من مدير النظام، باسترداد المتبقي للإلغاء أو بصرفه للإغلاق الإداري. لا يتوزع المبلغ تلقائيًا.',
  PARTIAL_SETTLEMENT_NOT_DEFINED: 'تقسيم المبلغ المحتجز بين الطرفين عند إلغاء إداري منفرد غير معتمد بعد (قرار منتج مطلوب).',
  ESCROW_CHANGED: 'تغيّر الضمان أثناء التنفيذ ولم يُنفَّذ أي مبلغ. أعد المحاولة.',
  REQUEST_SUSPENDED_BY_ADMIN: 'الطلب معلّق من الإدارة.',
};

export const EFFECT_COPY: Record<string, string> = {
  REQUEST_CANCELLED: 'يُلغى الطلب ولا يظهر لمقدمي الخدمة',
  OFFERS_CLOSED: 'تُغلق العروض المفتوحة على الطلب',
  PARTIES_NOTIFIED: 'يُشعَر الطرفان المعنيان بعد التنفيذ',
  CONTRACT_CANCELLED: 'يُلغى العقد',
  CONTRACT_COMPLETED: 'يُغلق العقد والمشروع «بصرف إداري» (ليس اكتمالًا بالتسليم): لا تُعتمد المراحل غير المعتمدة ولا يُحتسب تسليمًا ولا يُفتح تقييم',
  PROJECT_CLOSED: 'يُغلق المشروع المرتبط',
  REQUEST_CLOSED: 'يُغلق الطلب المرتبط',
  HELD_REFUNDED_TO_CLIENT: 'يُعاد كامل المبلغ المحتجز إلى رصيد الطالب',
  HELD_RELEASED_TO_PROVIDER: 'يُصرف كامل المبلغ المحتجز لمقدم الخدمة (بعد عمولة المنصة)',
  OPEN_CANCELLATION_REQUESTS_CLOSED: 'تُغلق طلبات الإلغاء بالتراضي غير المجابة',
  OPEN_AMENDMENTS_CANCELLED: 'تُلغى طلبات التعديل المعلّقة',
  FREEZE_CLEARED: 'يُرفع تجميد العقد لأن العقد أُغلق',
  CLOSURE_RECORDED: 'يُسجَّل نوع الإغلاق ومصدره وسببه ونتيجته المالية منفصلةً عن أي نزاع',
  ALREADY_RELEASED_UNCHANGED: 'ما صُرف سابقًا لمقدم الخدمة لا يتغيّر ولا يُسترد',
};

export const effectCopy = (code: string): string => EFFECT_COPY[code] ?? '';

const ARABIC = /[؀-ۿ]/;
/** The Arabic sentence for a failed call: the table by the server's stable code, else the server's own Arabic message, else a fixed fallback (never English). */
export function controlErrorCopy(err: any, fallback = 'تعذّر تنفيذ الإجراء. لم يتغيّر شيء، حاول مجددًا.'): string {
  const code = typeof err?.error?.code === 'string' ? err.error.code : null;
  if (code && REASON_COPY[code]) return REASON_COPY[code];
  const msg = err?.error?.message;
  return typeof msg === 'string' && ARABIC.test(msg) && !/prisma|SELECT|INSERT/i.test(msg) ? msg : fallback;
}
export const reasonCopy = (code: string | null | undefined, serverMessage?: string | null): string =>
  (code && REASON_COPY[code]) || (serverMessage && ARABIC.test(serverMessage) ? serverMessage : 'غير متاح في الحالة الحالية.');
