import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, catchError, of } from 'rxjs';
import { PersistenceService } from './persistence.service';
import { sanitizeUploadedSvg } from './svg-sanitize';

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

@Injectable({ providedIn: 'root' })
export class IconsService {
  readonly libraries = signal<IconLibrary[]>([]);
  readonly loadError = signal<string | null>(null);

  private readonly persistence = inject(PersistenceService);

  constructor(private http: HttpClient) {}

  async load(): Promise<void> {
    const data = await firstValueFrom(
      this.http.get<IconsFile>('/assets/site-control/icons.json').pipe(catchError(() => of(null)))
    );
    if (!data) {
      this.loadError.set('تعذّر تحميل ملف الأيقونات (icons.json).');
      return;
    }
    // إصلاح 2026-08-18: استخدم نسخة محفوظة محليًا إن وُجدت بدل تجاهلها دائمًا لصالح الملف الأصلي.
    const saved = this.persistence.load<IconLibrary[]>('icons');
    // إصلاح أمني جذري 2026-08-19: أي نسخة محفوظة بـlocalStorage قد تكون أُنشئت قبل تفعيل
    // التعقيم بـimportJson (أو عُدِّلت يدويًا بأدوات المطوّر) — تُعقَّم دائمًا عند التحميل أيضًا،
    // وليس فقط عند الاستيراد، كخط دفاع ثانٍ يمنع أي XSS مخزّن من التفعّل عند فتح الجلسة.
    // إصلاح 2026-08-20 (حارس هجرة): النسخة المحفوظة محليًا قد تكون أُنشئت قبل دمج مكتبتي
    // أيقونات الذكاء (كانت 4 مكتبات: general / ai / ai-proposed / ws-site). لو بنية المكتبات
    // المحفوظة ما عادت تطابق بنية الملف المصدري، تُتجاهل ويُستخدم الملف — وإلا يظل المستخدم
    // يشوف البنية القديمة للأبد بعد أي تحديث بنيوي، بلا سبب ظاهر له.
    const savedLibs = saved?.data;
    const sameShape =
      Array.isArray(savedLibs) &&
      savedLibs.length === data.libraries.length &&
      data.libraries.every(lib => savedLibs.some(s => s?.id === lib.id));
    this.libraries.set(sameShape ? this.sanitizeLibraries(savedLibs!) : data.libraries);
  }

  /** يعقّم svg كل أيقونة بكل مكتبة — مصدر واحد يُستدعى من load() وimportJson() معًا. */
  private sanitizeLibraries(libraries: IconLibrary[]): IconLibrary[] {
    return libraries.map(lib => ({
      ...lib,
      icons: lib.icons
        .map(icon => {
          const clean = sanitizeUploadedSvg(icon.svg);
          return clean === null ? null : { ...icon, svg: clean };
        })
        .filter((icon): icon is IconItem => icon !== null),
    }));
  }

  /** حفظ حقيقي محليًا — كان غائبًا كليًا (لا استمرارية إطلاقًا قبل هذا التاريخ) */
  save(): boolean {
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
