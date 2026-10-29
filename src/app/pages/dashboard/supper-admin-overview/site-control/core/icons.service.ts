import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { PersistenceService } from './persistence.service';
import { sanitizeLibrarySvg } from './svg-sanitize';

/**
 * sanitizeLibrarySvg parses the markup with a DOM parser. The shipped library lists ~1100 icons and a load sanitised EACH of them up to three times (the saved copy, the saved copy again to compare,
 * and the shipped icon as the comparison baseline), so a load took seconds and the timing specs that load twice sat at the edge of the test timeout. The function is pure: the same markup always gives
 * the same result, so each distinct string is sanitised once per page lifetime. Behaviour is unchanged; only the repeated parsing is gone.
 */
const SANITIZED = new Map<string, string | null>();
const cleanSvg = (raw: string): string | null => { if (SANITIZED.has(raw)) return SANITIZED.get(raw)!; const c = sanitizeLibrarySvg(raw); SANITIZED.set(raw, c); return c; };

export interface IconItem {
  slot: string;
  label: string;
  svg: string;
  /** مجموعة فرعية داخل نفس المكتبة (confirmed/proposed لمكتبة الذكاء، وgeneral/future/roles/categories لمكتبة ws-*) */
  group?: string;
  /** عنوان المجموعة الفرعية حرفيًا من ملف الهوية — يُعرض كترويسة صغيرة فوق شبكة أيقونات المجموعة */
  groupLabel?: string;
  /** وصف الشكل حرفيًا من ملف الهوية */
  shape?: string;
  /** ملاحظة الاستخدام حرفيًا من ملف الهوية */
  note?: string;
}

export interface IconLibrary {
  id: string;
  label: string;
  colorVar: string;
  icons: IconItem[];
}

export interface IconsFile {
  version: number;
  libraries: IconLibrary[];
}

/** a customisation found in the browser's OLD local copy (before the library was server-backed): shown FOR REVIEW only, never published by itself */
export interface LegacyIcon { libraryId: string; slot: string; label: string; defaultInner: string; legacyInner: string }
export type IconsPhase = 'idle' | 'loading' | 'ready' | 'error';

@Injectable({ providedIn: 'root' })
export class IconsService {
  readonly libraries = signal<IconLibrary[]>([]);
  readonly loadError = signal<string | null>(null);
  /** حالة التحميل: الفشل لا يُعرض أبدًا كمكتبة فارغة (يُعرض كخطأ مع إعادة محاولة) */
  readonly phase = signal<IconsPhase>('idle');
  /** تنبيه غير مانع: نسخة محلية قديمة/معطوبة لم تُستخدم (تبقى في المتصفح كما هي ولا تُمسح) */
  readonly savedCopyNotice = signal<string | null>(null);
  /** the library file as shipped (labels, groups, library colours): the icons page uses THIS, never the browser's old copy */
  readonly pristine = signal<IconLibrary[]>([]);
  /** old local customisations that differ from the shipped drawing and are valid after sanitising (diff vs default) */
  readonly legacy = signal<LegacyIcon[]>([]);
  /** the old local copy exists but cannot be read (kept in the browser untouched) */
  readonly legacyUnreadable = signal<string | null>(null);
  /** slots the owner chose to ignore (a separate key; the old copy itself is never deleted) */
  readonly legacyIgnored = signal<string[]>([]);

  private readonly persistence = inject(PersistenceService);
  private inflight: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  /** تحميل idempotent؛ `force` يعيد القراءة (زر «إعادة المحاولة») */
  load(force = false): Promise<void> {
    if (this.inflight) return this.inflight;
    if (!force && this.phase() === 'ready' && this.libraries().length) return Promise.resolve();
    this.inflight = this.doLoad().finally(() => { this.inflight = null; });
    return this.inflight;
  }

  private async doLoad(): Promise<void> {
    this.phase.set('loading');
    const data = await firstValueFrom(
      this.http.get<IconsFile>('/assets/site-control/icons.json').pipe(catchError(() => of(null)))
    );
    if (!data || !Array.isArray(data.libraries) || !data.libraries.some(l => Array.isArray(l?.icons) && l.icons.length)) {
      // فشل أو ملف فارغ: لا نمسّ المكتبات الحالية (إن وُجدت) ولا النسخة المحفوظة، ونُظهر الخطأ بدل مكتبة فارغة
      this.loadError.set('تعذّر تحميل ملف الأيقونات (icons.json). لم يتغيّر شيء مما حفظته؛ أعد المحاولة.');
      this.phase.set(this.libraries().length ? 'ready' : 'error');
      return;
    }
    this.loadError.set(null);
    // النسخة المحفوظة محليًا (قديمة: قبل ربط الأيقونات بالخادم) تُستخدم لكل مكتبة على حدة ولا تُستخدم أبدًا إن أنتجت مكتبة بلا أيقونات.
    // السبب الجذري للمكتبة الفارغة (2026-10-28): icons.json يخزّن محتوى SVG الداخلي فقط، والتعقيم كان يشترط وسم <svg> كاملاً فيرفض كل الأيقونات
    // المحفوظة (انظر sanitizeLibrarySvg). كذلك: النسخة التي لا تصلح لا تُحذف من التخزين ولا يُكتب فوقها هنا.
    const saved = this.persistence.load<IconLibrary[] | { libraries?: IconLibrary[] }>('icons');
    const savedLibs = Array.isArray(saved?.data) ? saved!.data : Array.isArray((saved?.data as { libraries?: IconLibrary[] } | undefined)?.libraries) ? (saved!.data as { libraries: IconLibrary[] }).libraries : null;
    this.pristine.set(data.libraries);
    this.legacyIgnored.set(this.persistence.load<string[]>('icons-legacy-ignored')?.data ?? []);
    this.legacy.set(this.findLegacy(data.libraries, savedLibs));
    this.legacyUnreadable.set(this.persistence.hasSaved('icons') && !savedLibs ? 'توجد نسخة محلية قديمة في هذا المتصفح لكن شكلها غير مقروء، فبقيت كما هي دون مسح ولم تُستخدم.' : null);
    let note: string | null = null;
    const result = data.libraries.map(lib => {
      const mine = savedLibs?.find(s => s?.id === lib.id);
      if (!mine || !Array.isArray(mine.icons)) return lib;
      const clean = this.sanitizeLibrary(mine);
      if (!clean.icons.length) { note = 'نسخة محفوظة محليًا من بعض المكتبات غير صالحة فلم تُستخدم، وبقيت كما هي في المتصفح دون مسح.'; return lib; }
      return clean;
    });
    this.savedCopyNotice.set(note);
    this.libraries.set(result);
    this.phase.set('ready');
  }

  private findLegacy(file: IconLibrary[], saved: IconLibrary[] | null): LegacyIcon[] {
    if (!saved) return [];
    const norm = (x: string) => x.replace(/\s+/g, ' ').replace(/> </g, '><').trim();
    const out: LegacyIcon[] = [];
    for (const lib of file) {
      const mine = saved.find(s => s?.id === lib.id);
      if (!mine || !Array.isArray(mine.icons)) continue;
      for (const ic of lib.icons) {
        const old = mine.icons.find(i => i?.slot === ic.slot);
        if (!old || typeof old.svg !== 'string') continue;
        const clean = cleanSvg(old.svg);
        if (clean !== null && norm(clean) !== norm(cleanSvg(ic.svg) ?? ic.svg)) out.push({ libraryId: lib.id, slot: ic.slot, label: ic.label, defaultInner: ic.svg, legacyInner: clean });
      }
    }
    return out;
  }

  /** hide one old customisation from the review list (the old local copy is NOT touched) */
  ignoreLegacy(slot: string, ignore = true): void {
    const next = ignore ? [...new Set([...this.legacyIgnored(), slot])] : this.legacyIgnored().filter(s => s !== slot);
    this.legacyIgnored.set(next);
    this.persistence.save('icons-legacy-ignored', next);
  }

  private sanitizeLibrary(lib: IconLibrary): IconLibrary {
    return {
      ...lib,
      icons: (lib.icons ?? [])
        .map(icon => {
          const clean = typeof icon?.svg === 'string' ? cleanSvg(icon.svg) : null;
          return clean === null ? null : { ...icon, svg: clean };
        })
        .filter((icon): icon is IconItem => icon !== null),
    };
  }

  /** يعقّم svg كل أيقونة بكل مكتبة — مصدر واحد يُستدعى من load() وimportJson() معًا. */
  private sanitizeLibraries(libraries: IconLibrary[]): IconLibrary[] {
    return libraries.map(lib => this.sanitizeLibrary(lib));
  }

  /** حفظ حقيقي محليًا — كان غائبًا كليًا (لا استمرارية إطلاقًا قبل هذا التاريخ) */
  save(): boolean {
    // لا نكتب أبدًا مكتبة فارغة فوق نسخة محفوظة
    if (!this.libraries().some(l => l.icons.length)) return false;
    return this.persistence.save('icons', this.libraries());
  }

  exportJson(): void {
    this.persistence.downloadJson('waseetai-icons.json', {
      version: 1, updatedAt: new Date().toISOString(), libraries: this.libraries(),
    });
  }

  async importJson(file: File): Promise<{ ok: boolean; error?: string }> {
    const result = await this.persistence.readJsonFile<IconsFile>(file);
    if (!result.ok) return { ok: false, error: result.error };
    if (!Array.isArray(result.data.libraries)) {
      return { ok: false, error: 'بنية الملف غير صالحة — يجب أن يحتوي مصفوفة libraries.' };
    }
    // إصلاح أمني جذري 2026-08-19 (ثغرة XSS مخزّن — راجع تقرير الفحص العميق 2026-08-19):
    // كانت قيم svg المستوردة تُقبل بلا أي تعقيم ثم تُعرض عبر bypassSecurityTrustHtml بـ4
    // قوالب وتُحفظ بـlocalStorage (فعّالة كل جلسة لاحقة). كل أيقونة تُمرَّر الآن إلزاميًا عبر
    // sanitizeUploadedSvg (نفس دالة تعقيم رفع الأيقونة اليدوي — مصدر تعقيم واحد موحّد).
    // أي أيقونة تفشل التعقيم تُستبعد بدل رفض الملف كاملاً، مع تنبيه صريح بالعدد المرفوض.
    const sanitized = this.sanitizeLibraries(result.data.libraries);
    const totalBefore = result.data.libraries.reduce((n, l) => n + l.icons.length, 0);
    const totalAfter = sanitized.reduce((n, l) => n + l.icons.length, 0);
    const rejected = totalBefore - totalAfter;
    // استيراد لا ينتج أي أيقونة لا يستبدل المكتبة الحالية ولا النسخة المحفوظة
    if (totalAfter === 0) return { ok: false, error: 'لم تُقبل أي أيقونة من الملف، فبقيت المكتبة كما هي.' };
    this.libraries.set(sanitized);
    this.persistence.save('icons', sanitized);
    if (rejected > 0) {
      return { ok: true, error: `تم الاستيراد، لكن رُفضت ${rejected} أيقونة فشلت فحص الأمان (SVG غير صالح أو تحتوي عناصر/سمات محظورة).` };
    }
    return { ok: true };
  }

  /**
   * يعيد تعيين شكل SVG لمكان (slot) معيّن، من نفس المكتبة فقط
   * (يمنع بنيويًا خلط أشكال عامة مع أشكال AI — قاعدة الحصرية بالهوية).
   *
   * ملاحظة أمان مصحَّحة 2026-08-19 (التعليق السابق هنا كان خاطئًا — راجع تقرير الفحص العميق
   * 2026-08-19، الملاحظة الحرجة رقم 6): `newSvg` يُعرَض لاحقًا عبر `[innerHTML]` بعد
   * `bypassSecurityTrustHtml` — القيمة **لا تأتي حصرًا من ملف البناء فعليًا**؛ `icon-tokens.ts`
   * يستدعي هذه الدالة أيضًا برفع مستخدم فعلي (`onUploadIcon` → `readAndSanitizeSvgFile` قبل
   * الاستدعاء هنا) — الأمان الفعلي مضمون لأن المستدعي يعقّم دائمًا قبل الوصول لهذه الدالة،
   * وليس لأن المصدر "بناء فقط". أي مستدعٍ جديد لهذه الدالة يجب أن يمرّر SVG مُعقَّمًا مسبقًا
   * عبر `sanitizeUploadedSvg`/`readAndSanitizeSvgFile` — هذه الدالة نفسها لا تعقّم شيئًا.
   */
  reassignSlot(libraryId: string, slot: string, newSvg: string): void {
    const libs = this.libraries().map(lib => {
      if (lib.id !== libraryId) return lib;
      return {
        ...lib,
        icons: lib.icons.map(ic => (ic.slot === slot ? { ...ic, svg: newSvg } : ic))
      };
    });
    this.libraries.set(libs);
  }

  /**
   * إضافة أيقونة جديدة كليًا لمكتبة (مو استبدال slot موجود) — كانت غائبة تمامًا قبل
   * 2026-08-18 (كل ما كان موجود هو reassignSlot الذي يستبدل شكل slot قائم فقط، ولا
   * يزيد عدد الأيقونات عن 168 المقفلة بالبناء). يتحقق أن الـslot فريد عبر كل المكتبات
   * (لأن accounts.ts يبحث بالـslot عبر كل المكتبات بلا تمييز مكتبة — تكرار slot = سلوك
   * عشوائي بحسب ترتيب المكتبات).
   */
  addIcon(libraryId: string, item: IconItem): { ok: true } | { ok: false; error: string } {
    const allSlots = this.libraries().flatMap(l => l.icons.map(i => i.slot));
    if (allSlots.includes(item.slot)) {
      return { ok: false, error: `الـslot "${item.slot}" مستخدم مسبقًا بمكتبة أخرى — لازم يكون فريدًا عبر كل المكتبات.` };
    }
    const libs = this.libraries().map(lib =>
      lib.id === libraryId ? { ...lib, icons: [...lib.icons, item] } : lib
    );
    this.libraries.set(libs);
    return { ok: true };
  }

  /** حذف أيقونة من مكتبة — كانت غائبة أيضًا (لا دالة حذف إطلاقًا قبل 2026-08-18) */
  removeIcon(libraryId: string, slot: string): void {
    const libs = this.libraries().map(lib =>
      lib.id === libraryId ? { ...lib, icons: lib.icons.filter(i => i.slot !== slot) } : lib
    );
    this.libraries.set(libs);
  }
}
