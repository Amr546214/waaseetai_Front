import { IdentityStrip } from '../identity/identity-strip';
import { Component, OnInit, computed, inject, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DesignTokensService } from '../core/design-tokens.service';
import { IconsService } from '../core/icons.service';
import { TypographyService } from '../core/typography.service';
import { ThemeModeService } from '../core/theme-mode.service';

/**
 * دليل الأنماط الموحّد — إضافة 2026-08-18 (اختيار المالك). صفحة واحدة تجمع كل نظام
 * التصميم (ألوان + خطوط + أيقونات + مقاسات) من نفس بيانات الخدمات الحيّة — بلا أي
 * إدخال يدوي إضافي، قابلة للمشاركة مع أي مبرمج ينضم للفريق لاحقًا.
 */
@Component({
  selector: 'sc-style-guide',
  standalone: true,
  imports: [IdentityStrip],
  templateUrl: './style-guide.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['../site-control-base.css', './style-guide.css']
})
export class StyleGuide implements OnInit {
  tokensService = inject(DesignTokensService);
  iconsService = inject(IconsService);
  typographyService = inject(TypographyService);
  themeMode = inject(ThemeModeService);
  private sanitizer = inject(DomSanitizer);

  async ngOnInit() {
    if (!this.tokensService.loaded()) await this.tokensService.loadAndApply();
    if (this.iconsService.libraries().length === 0) await this.iconsService.load();
    if (this.typographyService.roles().length === 0) await this.typographyService.load();
  }

  /** بطاقة "قياسية" — عيّنة من قسم 5 (المكوّنات → مكتبة المكوّنات العامة) بملف الهوية. */
  readonly briefIcon = computed(() => {
    const lib = this.iconsService.libraries().find(l => l.id === 'general');
    return lib?.icons.find(ic => ic.slot === 'i-brief') ?? null;
  });

  /** بطاقة "AI" — عيّنة من قسم 5 (المكوّنات → مكتبة مكوّنات الذكاء الاصطناعي) بملف الهوية. */
  readonly aiSparkIcon = computed(() => {
    const lib = this.iconsService.libraries().find(l => l.id === 'ai');
    return lib?.icons.find(ic => ic.slot === 'ws-ai-spark') ?? null;
  });

  readonly colorGroups = computed(() =>
    this.tokensService.groups().filter(g => g.tokens.some(t => t.type === 'color' || t.type === 'gradient'))
  );

  readonly sizeTokens = computed(() =>
    this.tokensService.groups().flatMap(g => g.tokens).filter(t => t.type === 'size')
  );

  /** حالات الأزرار — جدول قسم 5 بملف الهوية (Primary/Secondary مطبّقان فعلياً، Outline/Text مقترحان جديدان) */
  readonly buttonStates = [
    { type: 'Primary', status: 'مطبّق فعلياً', statusColor: '#2BD4C7', default: 'تدرج فيروزي/أزرق', hover: 'تعتيم خفيف 92%', active: 'تعتيم 85%', disabled: 'شفافية 40%، بلا تفاعل', loading: 'مقترح جديد' },
    { type: 'Secondary', status: 'مطبّق فعلياً', statusColor: '#2BD4C7', default: 'محايد + حدود', hover: 'خلفية أفتح درجة', active: 'خلفية أغمق درجة', disabled: 'شفافية 40%', loading: 'مقترح جديد' },
    { type: 'Outline', status: 'مقترح جديد يحتاج اعتماد', statusColor: '#D98A0B', default: 'شفاف + حدود فيروزي', hover: 'خلفية فيروزي 8%', active: 'خلفية فيروزي 15%', disabled: 'حدود رمادية باهتة', loading: 'مقترح جديد' },
    { type: 'Text', status: 'مقترح جديد يحتاج اعتماد', statusColor: '#D98A0B', default: 'بلا خلفية/حدود', hover: 'underline', active: 'تعتيم النص', disabled: 'شفافية 40%', loading: 'غير مقترح لهذا النوع' },
  ];

  /** حالات الحقول — قسم 5 بملف الهوية (Disabled كانت ناقصة بالعرض السابق) */
  readonly fieldStates = [
    { state: 'Default', desc: 'خلفية شفافة خفيفة + حدود عادية' },
    { state: 'Focus', desc: 'حدود فيروزي 40% + بلا outline افتراضي' },
    { state: 'Error', desc: 'حدود --red + نص تحذير أسفل الحقل' },
    { state: 'Disabled', desc: 'شفافية 50%، بلا تفاعل' },
  ];

  /** حالات البطاقات — قسم 5 بملف الهوية */
  readonly cardStates = [
    { state: 'Default', desc: 'surface + حدود + بلا ظل (داكن) / ظل خفيف (فاتح)' },
    { state: 'Hover', desc: 'حدود فيروزي 30% + ظل أعمق (فاتح فقط)' },
  ];

  /** شارات حالة الطلب/العرض (op-*) — قسم 5 بملف الهوية */
  readonly statusBadgesDemo = [
    { name: 'نشط/مقبول', bg: 'rgba(15,169,154,.12)', text: '#0A6F64', darkNote: 'داكن: خلفية تيل خافتة + نص --green' },
    { name: 'مسودة', bg: 'rgba(127,127,127,.06)', text: '#475569', darkNote: 'داكن: رمادي محايد + نص --txt-2' },
    { name: 'مكتمل', bg: 'rgba(43,127,255,.10)', text: '#1A5FCC', darkNote: 'داكن: خلفية أزرق خافتة + نص --blue' },
    { name: 'ملغى', bg: 'rgba(127,127,127,.06)', text: '#475569', darkNote: 'داكن: رمادي محايد + نص --txt-2 (كان كهرماني، عُدِّل لمخالفته approvedRules[0])' },
    { name: 'نزاع', bg: 'rgba(255,140,105,.10)', text: '#B34000', darkNote: 'داكن: خلفية مرجانية خافتة + نص --red' },
  ];

  setMode(mode: 'dark' | 'light') {
    this.tokensService.setMode(mode);
  }

  safeSvg(svg: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(svg);
  }
}
