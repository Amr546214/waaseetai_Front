import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/**
 * طبقة استمرارية حقيقية — أضيفت 2026-08-18 لسدّ أكبر فجوة معمارية بالمشروع:
 * قبلها، "الحفظ" بكل التبويبات كان محاكاة (`console.log` ثم رسالة نجاح وهمية)، وكل
 * تعديل يضيع عند أول تحديث للصفحة. هذي الخدمة تحفظ فعليًا بـlocalStorage (خطوة أولى
 * قبل ربط API حقيقي)، وتوفّر تصدير/استيراد JSON لكل ملف بيانات حتى ينتقل المستخدم
 * بالتعديلات بين الأجهزة/الجلسات بدون فقدانها.
 *
 * كل مفتاح تخزين مسبوق بـ`waseetai-dtp:` لتفادي أي تعارض مع مفاتيح أخرى بنفس المتصفح.
 */
const STORAGE_PREFIX = 'waseetai-dtp:';

@Injectable({ providedIn: 'root' })
export class PersistenceService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private key(name: string): string {
    return STORAGE_PREFIX + name;
  }

  /** يحفظ كائن كامل بـlocalStorage مع طابع زمني — يعيد true عند النجاح */
  save<T>(name: string, data: T): boolean {
    if (!this.isBrowser) return false;
    try {
      const payload = { savedAt: new Date().toISOString(), data };
      window.localStorage.setItem(this.key(name), JSON.stringify(payload));
      return true;
    } catch (err) {
      console.error(`PersistenceService.save('${name}') failed:`, err);
      return false;
    }
  }

  /** يقرأ كائنًا محفوظًا سابقًا، أو null إن لم يوجد/تعذّرت القراءة */
  load<T>(name: string): { data: T; savedAt: string } | null {
    if (!this.isBrowser) return null;
    try {
      const raw = window.localStorage.getItem(this.key(name));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('data' in parsed)) return null;
      return parsed as { data: T; savedAt: string };
    } catch (err) {
      console.error(`PersistenceService.load('${name}') failed:`, err);
      return null;
    }
  }

  /** يمسح نسخة محفوظة محليًا (زر "استعادة القيمة المصدرية من الملف") */
  clear(name: string): void {
    if (!this.isBrowser) return;
    window.localStorage.removeItem(this.key(name));
  }

  hasSaved(name: string): boolean {
    return this.isBrowser && window.localStorage.getItem(this.key(name)) !== null;
  }

  /** يُنزّل أي كائن كملف JSON جاهز — يُستخدم لكل زر "تصدير" بكل تبويب */
  downloadJson(filename: string, data: unknown): void {
    if (!this.isBrowser) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.json') ? filename : `${filename}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /** يقرأ ملف JSON مرفوع من المستخدم — يُستخدم لكل زر "استيراد" */
  async readJsonFile<T>(file: File): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
    if (!file.name.toLowerCase().endsWith('.json')) {
      return { ok: false, error: 'الملف يجب أن يكون بصيغة JSON.' };
    }
    try {
      const text = await file.text();
      const data = JSON.parse(text) as T;
      return { ok: true, data };
    } catch {
      return { ok: false, error: 'تعذّر قراءة الملف — تأكد أنه JSON صالح.' };
    }
  }
}
