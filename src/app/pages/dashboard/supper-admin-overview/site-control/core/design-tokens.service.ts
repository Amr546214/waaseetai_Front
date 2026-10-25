import { SiteControlScope } from './site-control-scope.service';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { ThemeModeService } from './theme-mode.service';
import { PersistenceService } from './persistence.service';

export interface DesignToken {
  var: string;
  label: string;
  value: string;
  type: 'color' | 'gradient' | 'size' | 'weight' | 'font' | 'shadow' | 'opacity' | 'text';
}

export interface TokenGroup {
  id: string;
  label: string;
  tokens: DesignToken[];
}

export interface TokensFile {
  version: number;
  updatedAt: string;
  groups: TokenGroup[];
}

/** أحرف تسمح بكسر سياق تعريف CSS custom property (breakout إلى قواعد/تعليقات جديدة) — راجع تدقيق الأمان. */
const UNSAFE_CSS_VALUE_PATTERN = /[{}]|;\s*\S|\/\*|\*\//;

@Injectable({ providedIn: 'root' })
export class DesignTokensService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  private readonly themeMode = inject(ThemeModeService);
  private readonly http = inject(HttpClient);
  private readonly scope = inject(SiteControlScope);
  private readonly persistence = inject(PersistenceService);

  private readonly darkGroups = signal<TokenGroup[]>([]);
  private readonly lightGroups = signal<TokenGroup[]>([]);
  readonly loaded = signal(false);
  readonly loadError = signal<string | null>(null);

  /** المجموعة النشطة حاليًا بلوحة التحرير — حسب الوضع المختار بمبدّل t-toggle (حالة مشتركة عبر ThemeModeService) */
  readonly groups = computed(() => (this.themeMode.mode() === 'dark' ? this.darkGroups() : this.lightGroups()));

  /**
   * يجيب توكنات الوضعين معًا (dark + light — من ملفين منفصلين يقومان مقام الـAPI مستقبلًا)
   * ويطبّق فورًا كـCSS Custom Properties الوضع النشط الحالي على جذر الصفحة.
   * محاط بمعالجة أخطاء: فشل الجلب لا يُسقط بقية تهيئة التطبيق (كان ممكن يعلّق كامل الإقلاع
   * لو استُخدم هذا داخل provideAppInitializer بمشروع حقيقي فيه SSR أو شبكة غير مستقرة).
   */
  async loadAndApply(): Promise<void> {
    try {
      const [dark, light] = await Promise.all([
        firstValueFrom(
          this.http.get<TokensFile>('/assets/site-control/tokens.json').pipe(catchError(() => of(null)))
        ),
        firstValueFrom(
          this.http.get<TokensFile>('/assets/site-control/tokens-light.json').pipe(catchError(() => of(null)))
        ),
      ]);
      if (!dark || !light) {
        this.loadError.set('تعذّر تحميل ملفات التوكنات (tokens.json / tokens-light.json).');
        return;
      }
      // إصلاح 2026-08-18: لو فيه نسخة محفوظة محليًا (تعديلات سابقة للمستخدم لم تُصدَّر بعد)،
      // نستخدمها بدل نسخة الملف الأصلي — بدون هذا كان أي تعديل يضيع فورًا عند أي تحديث للصفحة.
      const savedDark = this.persistence.load<TokenGroup[]>('tokens-dark');
      const savedLight = this.persistence.load<TokenGroup[]>('tokens-light');
      this.darkGroups.set(savedDark?.data ?? dark.groups);
      this.lightGroups.set(savedLight?.data ?? light.groups);
      this.applyAll();
      this.loaded.set(true);
    } catch (err) {
      // لا نرمي الخطأ للأعلى: فشل تحميل توكنات التصميم لا يجب أن يمنع بقية التطبيق من الإقلاع.
      this.loadError.set('خطأ غير متوقع أثناء تحميل التوكنات.');
      console.error('DesignTokensService.loadAndApply failed:', err);
    }
  }

  /** تبديل وضع التحرير المعروض باللوحة (لا يمس الموقع الحي — لوحة تحرير فقط) */
  setMode(mode: 'dark' | 'light'): void {
    this.themeMode.setMode(mode);
    this.applyAll();
  }

  /** يطبّق كل توكنات الوضع النشط حاليًا على :root (معاينة اللوحة نفسها) — محمي لبيئات SSR بلا DOM */
  applyAll(): void {
    if (!this.isBrowser) return;
    for (const group of this.groups()) {
      for (const token of group.tokens) {
        this.scope.style().setProperty(token.var, token.value);
      }
    }
    // إصلاح 2026-08-19 (ملاحظة مباشرة من المالك): عناصر الفورم الأصلية (select/scrollbar...)
    // كانت تُرسَم دائمًا بمظهر المتصفح الفاتح الافتراضي بصرف النظر عن وضع اللوحة — أوضح مثال:
    // قائمة <select> المنسدلة (خلفية بيضاء) وسط لوحة داكنة بالكامل. `color-scheme` هو الخاصية
    // القياسية التي يفهمها المتصفح لرسم عناصر النموذج الأصلية بمظهر داكن/فاتح متسق مع الوضع
    // الحالي — بلا حاجة لأي لون مخترَع، فقط تعليمة للمتصفح تتبع نفس `themeMode.mode()`.
    this.scope.style().setProperty('color-scheme', this.themeMode.mode());
  }

  /** يتحقق أن قيمة التوكن لا تحتوي رموزًا قد تكسر سياق تعريف CSS (حماية من CSS injection عبر التصدير) */
  private assertSafeCssValue(value: string): string {
    if (UNSAFE_CSS_VALUE_PATTERN.test(value)) {
      throw new Error(`قيمة توكن غير صالحة (تحتوي رموز CSS محظورة قد تكسر سياق التعريف): ${value}`);
    }
    return value;
  }

  /** آخر خطأ تحقق واجهه محرر التوكنات — تعرضه الواجهة بجانب الحقل بدل تجمّد صامت (إصلاح 2026-08-18) */
  readonly lastTokenError = signal<{ varName: string; message: string } | null>(null);

  /**
   * يحدّث قيمة توكن واحد بالذاكرة (بالوضع النشط فقط) ويطبّقه حيًا فورًا (معاينة مباشرة).
   * لا يرمي استثناءً — يعيد true/false حتى تقدر الواجهة تُبقي القيمة السابقة وتعرض رسالة
   * بدل أن يتجمد الحقل بصمت (كان `assertSafeCssValue` يرمي بلا أي التقاط من المستدعي).
   */
  updateTokenLive(varName: string, value: string): boolean {
    let safeValue: string;
    try {
      safeValue = this.assertSafeCssValue(value);
    } catch (err) {
      this.lastTokenError.set({ varName, message: err instanceof Error ? err.message : 'قيمة غير صالحة' });
      return false;
    }
    this.lastTokenError.set(null);
    if (this.isBrowser) {
      this.scope.style().setProperty(varName, safeValue);
    }
    const isDark = this.themeMode.mode() === 'dark';
    const target = isDark ? this.darkGroups : this.lightGroups;
    // تحديث غير-مُغيِّر (immutable) — بلا تعديل مباشر على كائنات داخل الـsignal، تماشيًا مع توصية Angular signals
    target.set(
      target().map(group => ({
        ...group,
        tokens: group.tokens.map(t => (t.var === varName ? { ...t, value: safeValue } : t)),
      }))
    );
    return true;
  }

  /**
   * حفظ (مؤقتًا: طباعة الحالة الحالية فقط — لاحقًا يستبدل بنداء API حقيقي
   * يخزّن القيم بقاعدة البيانات مع سجل تاريخي).
   * تنبيه أمني للمطوّر الذي سيربط API حقيقي: يجب إعادة التحقق (validation) من كل قيمة على السيرفر
   * أيضًا، لا يكفي تحقق العميل هنا وحده — راجع تدقيق الأمان المرفق بمجلد المراجع.
   */
  async saveAll(): Promise<{ ok: boolean; tokensCount: number }> {
    const count = this.darkGroups().reduce((sum, g) => sum + g.tokens.length, 0)
      + this.lightGroups().reduce((sum, g) => sum + g.tokens.length, 0);
    // حفظ حقيقي بـlocalStorage (إصلاح 2026-08-18 — كان محاكاة console.log فقط بلا أي تخزين).
    // TODO: عند ربط API حقيقي، استبدل هذا بنداء POST + تحقق سيرفر-سايد كامل، مع إبقاء
    // localStorage كنسخة احتياطية محلية (offline-first).
    const okDark = this.persistence.save('tokens-dark', this.darkGroups());
    const okLight = this.persistence.save('tokens-light', this.lightGroups());
    return { ok: okDark && okLight, tokensCount: count };
  }

  /** يمسح النسخة المحفوظة محليًا ويعيد التحميل من ملفات الأصل (استعادة القيم المصدرية بالكامل) */
  async resetToSource(): Promise<void> {
    this.persistence.clear('tokens-dark');
    this.persistence.clear('tokens-light');
    await this.loadAndApply();
  }

  /** تصدير كل التوكنات (الوضعين) كملف JSON مطابق لبنية tokens.json/tokens-light.json */
  exportJson(): void {
    this.persistence.downloadJson('waseetai-tokens-dark.json', {
      version: 1, updatedAt: new Date().toISOString(), groups: this.darkGroups(),
    });
    this.persistence.downloadJson('waseetai-tokens-light.json', {
      version: 1, updatedAt: new Date().toISOString(), groups: this.lightGroups(),
    });
  }

  /** استيراد ملف توكنات (وضع واحد) وتطبيقه فورًا + حفظه محليًا */
  async importJson(file: File, mode: 'dark' | 'light'): Promise<{ ok: boolean; error?: string }> {
    const result = await this.persistence.readJsonFile<TokensFile>(file);
    if (!result.ok) return { ok: false, error: result.error };
    if (!Array.isArray(result.data.groups)) {
      return { ok: false, error: 'بنية الملف غير صالحة — يجب أن يحتوي مصفوفة groups.' };
    }
    if (mode === 'dark') {
      this.darkGroups.set(result.data.groups);
      this.persistence.save('tokens-dark', result.data.groups);
    } else {
      this.lightGroups.set(result.data.groups);
      this.persistence.save('tokens-light', result.data.groups);
    }
    this.applyAll();
    return { ok: true };
  }

  /**
   * تصدير CSS مستقل — الحل التقني للنقل الحقيقي بدون أي وصول لكود مصدر الموقع الحي:
   * يولّد ملف CSS خام واحد يغطي **الوضعين معًا** (فاتح كقيم افتراضية + داكن كتجاوز)، مستقل تمامًا عن
   * Angular — يشتغل بأي موقع/تقنية (يُدرج بـ<link> عادي). كل قيمة تمر أولاً بـ`assertSafeCssValue`
   * لمنع أي احتمال كسر سياق CSS بالملف المصدَّر (حماية أمان — راجع تدقيق الأمان بمجلد المراجع).
   */
  generateCssText(): string {
    const lines: string[] = [];
    lines.push('/* ==========================================================');
    lines.push('   وسيط AI — توكنات التصميم (الوضعان الداكن والفاتح معًا)');
    lines.push('   مولَّد تلقائيًا من لوحة تحكم الهوية — لا تُعدَّل يدويًا هنا،');
    lines.push('   عدّل من اللوحة وأعد التصدير.');
    lines.push(`   تاريخ التصدير: ${new Date().toISOString()}`);
    lines.push(`   الإصدار: ${this.lightGroups().length ? 'v' + Date.now() : 'v0'}`);
    lines.push('   ========================================================== */');
    lines.push('');
    lines.push(":root {");
    lines.push("  --font-family-stack: var(--font-family), system-ui, sans-serif;");
    lines.push('  /* الوضع الفاتح — القيم الافتراضية (بلا صنف على <html>) */');
    for (const group of this.lightGroups()) {
      lines.push(`  /* — ${group.label} — */`);
      for (const token of group.tokens) {
        lines.push(`  ${token.var}: ${this.assertSafeCssValue(token.value)};`);
      }
    }
    lines.push('}');
    lines.push('');

    // إصلاح 2026-08-18: توكنات موجودة بالفاتح فقط (بلا مقابل موثّق بالداكن) كانت تُكتب بـ:root
    // فقط ولا تُعاد داخل html.dark، فتبقى بقيمتها الفاتحة حتى تحت الوضع الداكن (تسريب صامت غير موثّق).
    // الحل بلا اختراع قيمة داكنة جديدة (ممنوع الاجتهاد على الألوان): نُصرّح بها صراحة داخل html.dark
    // بنفس قيمة الفاتح + تعليق تحذيري، بدل الاعتماد على تسرّب cascade ضمني غير موثّق.
    const darkVarNames = new Set(this.darkGroups().flatMap(g => g.tokens.map(t => t.var)));
    const lightOnlyTokens = this.lightGroups()
      .flatMap(g => g.tokens)
      .filter(t => !darkVarNames.has(t.var));

    lines.push('html.dark {');
    lines.push('  /* الوضع الداكن — تجاوز عند وجود class="dark" على <html> */');
    for (const group of this.darkGroups()) {
      lines.push(`  /* — ${group.label} — */`);
      for (const token of group.tokens) {
        lines.push(`  ${token.var}: ${this.assertSafeCssValue(token.value)};`);
      }
    }
    if (lightOnlyTokens.length) {
      lines.push('  /* تحذير: القيم التالية موثّقة بالوضع الفاتح فقط — لا يوجد مقابل داكن معتمد بالمرجع بعد.');
      lines.push('     أُعيدت هنا صراحة بنفس قيمة الفاتح لتفادي تسريب صامت غير موثّق. يلزم تحديد قيمة داكنة');
      lines.push('     رسمية من الهوية ثم استبدالها هنا. */');
      for (const token of lightOnlyTokens) {
        lines.push(`  ${token.var}: ${this.assertSafeCssValue(token.value)}; /* بحاجة قيمة داكنة موثّقة */`);
      }
    }
    lines.push('}');
    lines.push('');
    return lines.join('\n');
  }

  /** ينسخ CSS المولَّد للحافظة مباشرة (زر "نسخ" باللوحة) — محمي لبيئات SSR بلا navigator.clipboard */
  async copyCssToClipboard(): Promise<void> {
    if (!this.isBrowser || !navigator.clipboard) return;
    await navigator.clipboard.writeText(this.generateCssText());
  }

  /** يحمّل CSS المولَّد كملف .css جاهز للتسليم للمبرمج أو الإدراج المباشر بالموقع — محمي لبيئات SSR */
  downloadCss(filename = 'waseetai-tokens.css'): void {
    if (!this.isBrowser) return;
    const blob = new Blob([this.generateCssText()], { type: 'text/css;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
