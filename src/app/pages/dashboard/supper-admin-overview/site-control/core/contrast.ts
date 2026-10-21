/**
 * حساب نسبة تباين WCAG بين لونين — إضافة 2026-08-18 (كانت فجوة كاملة: لا فحص تباين
 * إطلاقًا رغم أن اللوحة تدير 70+ توكن لون على وضعين). صيغة الحساب من WCAG 2.1 §1.4.3.
 * يدعم hex (#rgb, #rrggbb) و rgb()/rgba() — يتجاهل قناة alpha بالحساب (نسبة التباين
 * تُحسب دائمًا كأن الطبقة معتمة فوق الخلفية المعطاة، وهذا يطابق أسلوب أدوات WCAG القياسية).
 */

function parseColor(value: string): [number, number, number] | null {
  const v = value.trim();
  const hexMatch = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hexMatch) {
    let hex = hexMatch[1];
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const num = parseInt(hex, 16);
    return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
  }
  const rgbMatch = v.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1], 10), parseInt(rgbMatch[2], 10), parseInt(rgbMatch[3], 10)];
  }
  return null;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const toLinear = (c: number) => {
    const cs = c / 255;
    return cs <= 0.03928 ? cs / 12.92 : Math.pow((cs + 0.055) / 1.055, 2.4);
  };
  const [rl, gl, bl] = [toLinear(r), toLinear(g), toLinear(b)];
  return 0.2126 * rl + 0.7152 * gl + 0.0722 * bl;
}

/** يعيد null لو أحد اللونين غير قابل للتفسير (تدرّج، متغيّر CSS غير محلول، إلخ) — لا تخمين. */
export function contrastRatio(colorA: string, colorB: string): number | null {
  const a = parseColor(colorA);
  const b = parseColor(colorB);
  if (!a || !b) return null;
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

export type WcagLevel = 'AAA' | 'AA' | 'AA-large' | 'fail';

/** تصنيف نسبة التباين حسب WCAG 2.1 (نص عادي: AA=4.5 AAA=7 — نص كبير: AA=3 AAA=4.5) */
export function wcagLevel(ratio: number | null, largeText = false): WcagLevel {
  if (ratio === null) return 'fail';
  if (largeText) {
    if (ratio >= 4.5) return 'AAA';
    if (ratio >= 3) return 'AA-large';
    return 'fail';
  }
  if (ratio >= 7) return 'AAA';
  if (ratio >= 4.5) return 'AA';
  return 'fail';
}
