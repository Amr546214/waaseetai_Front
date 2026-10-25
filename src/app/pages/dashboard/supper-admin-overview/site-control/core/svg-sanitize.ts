/**
 * تعقيم SVG مرفوع من المستخدم قبل قبوله (icon upload) — مصدر موحّد يُستخدم من كل
 * مكان يقبل رفع أيقونة من الجهاز (تبويب الأيقونات، تبويب الحسابات).
 *
 * ملاحظة أمنية (2026-08-18): النسخة السابقة كانت تعتمد على regex لإزالة
 * script، foreignObject، معالجات on*، روابط خارجية. الـregex قابل للتجاوز بسهولة
 * (مثال: `onclick=alert(1)` بلا علامات اقتباس يمر من `\son\w+\s*=\s*"[^"]*"`).
 * الحل: تحليل حقيقي عبر DOMParser + قائمة سماح مغلقة (allowlist) للعناصر
 * والسمات — أي عنصر أو سمة خارج القائمة تُحذف بالكامل، وليس بمطابقة نصية.
 */

// عناصر SVG الآمنة المسموح بها فقط — لا <script>, <foreignObject>, <style>,
// <animate>, <set>, <use> (لتفادي مراجع خارجية عبر href).
const ALLOWED_TAGS = new Set([
  'svg', 'g', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon',
  'ellipse', 'defs', 'title', 'desc', 'clippath', 'lineargradient',
  'radialgradient', 'stop',
]);

// سمات آمنة فقط — لا on*, لا href/xlink:href, لا style (يمنع @import عبر style).
const ALLOWED_ATTRS = new Set([
  'd', 'cx', 'cy', 'r', 'rx', 'ry', 'x', 'y', 'x1', 'y1', 'x2', 'y2',
  'width', 'height', 'points', 'transform', 'viewbox', 'fill', 'stroke',
  'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-dasharray',
  'opacity', 'fill-opacity', 'stroke-opacity', 'offset', 'stop-color',
  'stop-opacity', 'gradientunits', 'id', 'class',
]);

function sanitizeNode(node: Element): void {
  // امسح أي عنصر فرعي غير مسموح به (بما فيه script/foreignObject/style/animate/use)
  Array.from(node.children).forEach((child) => {
    if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
      child.remove();
      return;
    }
    Array.from(child.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      if (!ALLOWED_ATTRS.has(name)) {
        child.removeAttribute(attr.name);
      }
    });
    sanitizeNode(child);
  });
}

export function sanitizeUploadedSvg(raw: string): string | null {
  if (!raw || raw.length > 60000) return null;
  if (!/<svg[\s\S]*<\/svg>/i.test(raw)) return null;

  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(raw, 'image/svg+xml');
  } catch {
    return null;
  }
  if (doc.querySelector('parsererror')) return null;

  const root = doc.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') return null;

  // احذف أي عقدة غير عنصر (تعليقات، CDATA) قد تحمل حمولة، ثم طبّق allowlist بعمق
  sanitizeNode(root);

  // احترازي إضافي: أي سمة on* أو href متبقية على الجذر نفسه
  Array.from(root.attributes).forEach((attr) => {
    const name = attr.name.toLowerCase();
    if (name.startsWith('on') || name === 'href' || name === 'xlink:href') {
      root.removeAttribute(attr.name);
    }
  });

  const serialized = Array.from(root.childNodes)
    .filter((n) => n.nodeType === Node.ELEMENT_NODE)
    .map((n) => new XMLSerializer().serializeToString(n))
    .join('')
    .trim();

  return serialized || null;
}

/**
 * دالة موحّدة لقراءة وتعقيم ملف SVG مرفوع — كانت هذي المنطق منسوخة بتنفيذين منفصلين
 * (icon-tokens.ts و accounts.ts) برسائل خطأ مختلفة لنفس الحالة (إصلاح 2026-08-18).
 * أي مكان جديد يحتاج رفع أيقونة (المكوّن المشترك المستقبلي app-icon-picker) يستخدم هذي فقط.
 */
export type SvgUploadResult = { ok: true; svg: string } | { ok: false; error: string };

export async function readAndSanitizeSvgFile(file: File): Promise<SvgUploadResult> {
  const isSvgExt = file.name.toLowerCase().endsWith('.svg');
  const isSvgMime = file.type === 'image/svg+xml' || file.type === '';
  if (!isSvgExt && !file.type.includes('svg')) {
    return { ok: false, error: 'الملف يجب أن يكون بصيغة SVG فقط.' };
  }
  if (!isSvgExt && !isSvgMime) {
    return { ok: false, error: 'الملف يجب أن يكون بصيغة SVG فقط.' };
  }
  const text = await file.text();
  const clean = sanitizeUploadedSvg(text);
  if (!clean) {
    return { ok: false, error: 'تعذّر قبول الملف — تأكد أنه SVG صالح ولا يتجاوز 60 ألف حرف.' };
  }
  return { ok: true, svg: clean };
}
