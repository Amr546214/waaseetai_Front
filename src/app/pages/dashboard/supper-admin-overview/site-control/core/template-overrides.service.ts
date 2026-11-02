import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { PersistenceService } from './persistence.service';

/** قيمة خانة واحدة — رقم (حجم/عدد) أو نص (أيقونة بصيغة "معرّف_المكتبة:slot" أو اسم متغيّر لون) */
export type OverrideValue = string | number;

/** خريطة قيم قالب واحد: مفتاح الخانة ← قيمتها الحالية */
export type TemplateOverrideMap = Record<string, OverrideValue>;

export interface TemplateOverridesFile {
  version: number;
  updatedAt: string;
  overrides: Record<string, TemplateOverrideMap>;
}

/**
 * أُضيفت 2026-08-20 (طلب المالك المباشر): تبويب "القوالب" كان معاينة عرض فقط — أي أيقونة/حجم/عدد
 * داخل كل قالب من العشرين كان مثبّتًا بالكود، بلا أي تحكم فعلي من اللوحة. هذي الخدمة تدير القيم
 * الحيّة لكل "خانة" قابلة للتحكم (icon/size/count/variant) — نفس نمط DesignTokensService بالضبط:
 * تحميل من ملف JSON مصدري + نسخة محفوظة محليًا (localStorage) تطغى عليه إن وُجدت + تصدير/استيراد.
 *
 * تنبيه نطاق صريح (قرار المالك 2026-08-20): هذا يغطي خصائص **التصميم فقط** (أيقونة/حجم/عدد
 * عناصر/لون-فئة) — لا يغطي **نص المحتوى** (تسميات، أرقام، عبارات) بأي شكل؛ نظام النص له قواعد
 * منفصلة مستقبلية. كما أن هذا يتحكم بمعاينة اللوحة نفسها فقط — ربطه فعليًا بصفحات الموقع الحقيقية
 * الـ438 (عبر سكربت تحميل ديناميكي + data-tpl-slot) مرحلة ثانية منفصلة لم تبدأ بعد.
 */
@Injectable({ providedIn: 'root' })
export class TemplateOverridesService {
  private readonly http = inject(HttpClient);
  private readonly persistence = inject(PersistenceService);

  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);

  private readonly state = signal<Record<string, TemplateOverrideMap>>({});

  async loadAndApply(): Promise<void> {
    try {
      const file = await firstValueFrom(
        this.http.get<TemplateOverridesFile>('/assets/site-control/template-overrides.json').pipe(catchError(() => of(null)))
      );
      if (!file) {
        this.loadError.set('تعذّر تحميل ملف overrides القوالب (template-overrides.json).');
        return;
      }
      const saved = this.persistence.load<Record<string, TemplateOverrideMap>>('template-overrides');
      this.state.set(saved?.data ?? file.overrides);
      this.loaded.set(true);
    } catch (err) {
      this.loadError.set('خطأ غير متوقع أثناء تحميل overrides القوالب.');
      console.error('TemplateOverridesService.loadAndApply failed:', err);
    }
  }

  /** قيمة خانة معيّنة بقالب معيّن، أو fallbackValue إن لم تكن محمَّلة/موجودة بعد */
  valueOf(templateId: string, slotKey: string, fallbackValue: OverrideValue): OverrideValue {
    const v = this.state()[templateId]?.[slotKey];
    return v === undefined ? fallbackValue : v;
  }

  /** يحدّث خانة واحدة فورًا بالذاكرة — تحديث غير-مُغيِّر (immutable) مثل updateTokenLive تمامًا */
  update(templateId: string, slotKey: string, value: OverrideValue): void {
    this.state.update(s => ({
      ...s,
      [templateId]: { ...s[templateId], [slotKey]: value },
    }));
  }

  async saveAll(): Promise<{ ok: boolean }> {
    const ok = this.persistence.save('template-overrides', this.state());
    return { ok };
  }

  async resetToSource(): Promise<void> {
    this.persistence.clear('template-overrides');
    await this.loadAndApply();
  }

  /** إعادة قالب واحد فقط لقيمه المصدرية — بلا مسّ باقي القوالب المعدَّلة */
  async resetTemplate(templateId: string, sourceDefaults: TemplateOverrideMap): Promise<void> {
    this.state.update(s => ({ ...s, [templateId]: { ...sourceDefaults } }));
    await this.saveAll();
  }

  exportJson(): void {
    this.persistence.downloadJson('waseetai-template-overrides.json', {
      version: 1, updatedAt: new Date().toISOString(), overrides: this.state(),
    });
  }

  async importJson(file: File): Promise<{ ok: boolean; error?: string }> {
    const result = await this.persistence.readJsonFile<TemplateOverridesFile>(file);
    if (!result.ok) return { ok: false, error: result.error };
    if (!result.data.overrides || typeof result.data.overrides !== 'object') {
      return { ok: false, error: 'بنية الملف غير صالحة — يجب أن يحتوي كائن overrides.' };
    }
    this.state.set(result.data.overrides);
    this.persistence.save('template-overrides', result.data.overrides);
    return { ok: true };
  }
}
