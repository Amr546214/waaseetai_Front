import { Component, computed, inject, signal, ViewEncapsulation } from '@angular/core';
import { DesignTokensService } from '../core/design-tokens.service';
import { ThemeMode, ThemeModeService } from '../core/theme-mode.service';
import { contrastRatio, wcagLevel, WcagLevel } from '../core/contrast';
import { PlatformTokensStore } from '../platform-tokens/platform-tokens.store';
import { TokenEditor } from '../platform-tokens/token-editor';

interface PaletteSwatch {
  label: string;
  value: string;
}

/** توكنات فيها قيمتان موثّقتان بمكانين مختلفين بملف الهوية بلا ترجيح واضح — تُعرَض كخيارين سريعين
 *  بدل ترجيح تعسفي لواحدة (بطلب صريح من المستخدم، انظر القرار 21 بسجل القرارات). */
const DOCUMENTED_ALTERNATES: Record<string, PaletteSwatch[]> = {
  '--navy-dashboard': [
    { label: 'المصدر 1 (نص التوثيق، سطر 931)', value: 'rgba(246,248,252,.96)' },
    { label: 'المصدر 2 (تنفيذ اللوحة الفعلي، سطر 1241)', value: 'rgba(246,248,252,.92)' },
  ],
};

@Component({
  selector: 'sc-color-tokens',
  standalone: true,
  imports: [TokenEditor],
  templateUrl: './color-tokens.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['../site-control-base.css', './color-tokens.css']
})
export class ColorTokens {
  tokensService = inject(DesignTokensService);
  themeModeService = inject(ThemeModeService);
  private readonly platform = inject(PlatformTokensStore);
  /** a variable the SERVER manages (design-token keys): its row is locked here, the central editor above is the only editor of it */
  isPlatform(varName: string): boolean { return this.platform.names().has(varName); }
  saving = false;
  savedMsg = '';
  readonly weightOptions = [400, 500, 600, 700, 800, 900];
  activeGroupId = signal<string>('');

  readonly activeGroup = computed(() => {
    const groups = this.tokensService.groups();
    const id = this.activeGroupId();
    return groups.find(g => g.id === id) ?? groups[0] ?? null;
  });

  selectGroup(id: string) {
    this.activeGroupId.set(id);
  }

  /** لوحة ألوان جاهزة (Preset Palette) مبنية حيًا من الألوان الأساسية بالمشروع (تيل/أزرق/AI/أخضر/كهرماني/أحمر)
   *  + محايدان (أبيض/أسود) — تُعرَض كمربعات قابلة للنقر فوق كل حقل لون، بجانب إدخال hex اليدوي الموجود أصلاً. */
  readonly commonPalette = computed<PaletteSwatch[]>(() => {
    const groups = this.tokensService.groups();
    const find = (v: string) => groups.flatMap(g => g.tokens).find(t => t.var === v)?.value;
    const entries: [string, string | undefined][] = [
      ['تيل', find('--teal')], ['أزرق', find('--blue')], ['ذكاء اصطناعي', find('--ai')],
      ['أخضر', find('--green')], ['كهرماني', find('--kahr')], ['أحمر', find('--red')],
    ];
    const swatches: PaletteSwatch[] = entries
      .filter((e): e is [string, string] => !!e[1] && this.isSolidColor(e[1]))
      .map(([label, value]) => ({ label, value }));
    swatches.push({ label: 'أبيض', value: '#FFFFFF' }, { label: 'أسود', value: '#000000' });
    return swatches;
  });

  alternatesFor(varName: string): PaletteSwatch[] {
    return DOCUMENTED_ALTERNATES[varName] ?? [];
  }

  setMode(mode: ThemeMode) {
    this.tokensService.setMode(mode);
  }

  onValueChange(varName: string, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const ok = this.tokensService.updateTokenLive(varName, value);
    if (!ok) {
      // القيمة رُفضت (رموز CSS خطرة) — نُعيد ضبط الحقل بصريًا للقيمة الصحيحة الأخيرة المخزّنة
      // بدل تركه معلّقًا بقيمة غير مطبَّقة بصمت (كان هذا البق قبل 2026-08-18).
      (event.target as HTMLInputElement).value =
        this.activeGroup()?.tokens.find(t => t.var === varName)?.value ?? '';
    }
  }

  /** خطأ التحقق الأخير من الخدمة — تُعرض رسالته بجانب الحقل المسبِّب فقط */
  errorFor(varName: string): string | null {
    const err = this.tokensService.lastTokenError();
    return err && err.varName === varName ? err.message : null;
  }

  /** قناة الشفافية الحالية لتوكن لون (1 = معتم كليًا) — مستقلة عن منتقي input[type=color] */
  alphaOf(value: string): number {
    const m = value.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([\d.]+)\s*\)/);
    return m ? parseFloat(m[1]) : 1;
  }

  hasAlphaChannel(value: string): boolean {
    return value.trim().startsWith('rgba') && this.alphaOf(value) < 1;
  }

  /** يُستدعى من input[type=color] — يحافظ على قناة alpha الحالية بدل تدميرها (إصلاح البق الأمني/البصري) */
  onColorPick(varName: string, event: Event) {
    const hex = (event.target as HTMLInputElement).value;
    const currentValue = this.activeGroup()?.tokens.find(t => t.var === varName)?.value ?? '';
    const alpha = this.alphaOf(currentValue);
    if (alpha < 1) {
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      this.tokensService.updateTokenLive(varName, `rgba(${r},${g},${b},${alpha})`);
    } else {
      this.tokensService.updateTokenLive(varName, hex);
    }
  }

  /** شريط الشفافية المنفصل — يعدّل alpha فقط بدون المساس بـ RGB */
  onAlphaChange(varName: string, event: Event) {
    const alpha = parseFloat((event.target as HTMLInputElement).value);
    const currentValue = this.activeGroup()?.tokens.find(t => t.var === varName)?.value ?? '';
    const hex = this.toHex(currentValue);
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    this.tokensService.updateTokenLive(varName, `rgba(${r},${g},${b},${alpha})`);
  }

  /** نسبة تباين هذا التوكن مقابل خلفية اللوحة الرئيسية (--pg) — كشف سريع لمشاكل وضوح النص */
  contrastAgainstBg(value: string): { ratio: number | null; level: WcagLevel } {
    const bg = this.tokensService.groups().flatMap(g => g.tokens).find(t => t.var === '--pg')?.value ?? '#FFFFFF';
    const ratio = contrastRatio(value, bg);
    return { ratio, level: wcagLevel(ratio) };
  }

  /** يُستدعى عند النقر على مربع من لوحة الألوان الجاهزة أو أحد "البدائل الموثّقة" */
  pickPaletteColor(varName: string, value: string) {
    this.tokensService.updateTokenLive(varName, value);
  }

  onSizeChange(varName: string, event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const n = parseFloat(raw);
    this.tokensService.updateTokenLive(varName, `${Number.isFinite(n) ? n : 0}px`);
  }

  onWeightChange(varName: string, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.tokensService.updateTokenLive(varName, value);
  }

  isSolidColor(value: string): boolean {
    return value.startsWith('#') || (value.startsWith('rgba') && !value.includes('gradient'));
  }

  toHex(value: string): string {
    if (value.startsWith('#')) return value;
    const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) {
      const [_, r, g, b] = m;
      const toHexPart = (n: string) => parseInt(n, 10).toString(16).padStart(2, '0');
      return `#${toHexPart(r)}${toHexPart(g)}${toHexPart(b)}`;
    }
    return '#000000';
  }

  sizeAsNumber(value: string): number {
    return parseFloat(value.replace('px', '')) || 0;
  }

  async save() {
    this.saving = true;
    const res = await this.tokensService.saveAll();
    this.saving = false;
    this.savedMsg = res.ok
      ? `تم حفظ ${res.tokensCount} توكن محليًا (الوضعين معًا) — يبقى محفوظًا بهذا المتصفح حتى تصدّره أو تربط API حقيقي`
      : 'تعذّر الحفظ محليًا (قد يكون التخزين ممتلئًا أو معطّلًا بالمتصفح)';
    setTimeout(() => (this.savedMsg = ''), 5000);
  }

  async resetToSource() {
    if (!confirm('هذا سيمسح كل تعديلاتك المحفوظة محليًا ويرجّع القيم الأصلية من الملف — متأكد؟')) return;
    await this.tokensService.resetToSource();
  }

  exportJson() {
    this.tokensService.exportJson();
  }

  async onImportFile(mode: 'dark' | 'light', event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const res = await this.tokensService.importJson(file, mode);
    this.savedMsg = res.ok ? 'تم الاستيراد وتطبيقه فورًا' : (res.error ?? 'فشل الاستيراد');
    setTimeout(() => (this.savedMsg = ''), 5000);
  }
}
