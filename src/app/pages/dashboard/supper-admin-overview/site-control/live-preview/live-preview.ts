import { Component, OnInit, inject, signal, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { DesignTokensService } from '../core/design-tokens.service';
import { IconsService } from '../core/icons.service';
import { TypographyService } from '../core/typography.service';
import { ThemeModeService } from '../core/theme-mode.service';
import { TemplateOverridesService } from '../core/template-overrides.service';

/**
 * معاينة حية شاملة — إضافة 2026-08-18 (اختيار المالك). لوحة تجريبية (mock dashboard)
 * كاملة تستخدم كل التوكنات سوية بنفس الوقت — على عكس معاينات كل تبويب المنفصلة، هذي
 * الصفحة تكشف تعارضات لا تظهر إلا لما تشوف كل العناصر مع بعض بسياق واقعي.
 *
 * إصلاح 2026-08-19 (ملاحظة مباشرة من المالك بعد الفحص البصري الأول):
 * 1) روابط الشريط الجانبي (الطلبات/المحفظة/الإعدادات) كانت وسوم <a> ثابتة بلا أي تنقل —
 *    أصبحت الآن تبدّل قسم المحتوى فعليًا عبر activeSection.
 * 2) شارة "الذكاء الاصطناعي" كانت تستخدم إيموجي ✨ حرفي بدل الأيقونة والألوان المعتمدة
 *    فعليًا من icons.json (مكتبة "ai"، slot "ws-ai-spark"، colorVar "--ai-txt") — الإيموجي
 *    يرسم بلونه الافتراضي من خط النظام ويتجاهل CSS color، فكان يخالف قاعدة الهوية
 *    "أي أيقونة تخص الذكاء تكون بنفس لونها المعتمد". أصبحت الآن تُقرأ حيًّا من IconsService
 *    مثل بقية اللوحة تمامًا (نفس نمط style-guide.ts) بدل أي قيمة مُدخلة يدويًا.
 *
 * إصلاح 2026-08-21 (ملاحظة مباشرة من المالك): بطاقات KPI هنا وشارة الذكاء الاصطناعي كانتا
 * مبنيتين بمعزل كامل عن تبويب "القوالب" — أي تعديل لأيقونة/لون/وزن بمحرر القوالب لم يكن
 * ينعكس هنا إطلاقًا رغم أن المحتوى النصي مطابق حرفيًا (128/طلب مكتمل، 4.8/التقييم،
 * 92%/دقة التوصية = نفس نص قالب kpi، وشارة الذكاء = نفس قالب aidisc). الآن تُقرأ القيم
 * حيًّا من TemplateOverridesService (نفس الخدمة التي يحرّرها المالك بتبويب القوالب) —
 * أي تعديل هناك ينعكس هنا فورًا. بطاقات المحفظة (الرصيد/التسوية/المسحوبات) لم تُربط لأن
 * محتواها مالي لا يقابل أيًا من الأيقونات الأربع المعتمدة بقالب kpi (لا تخمين لأيقونة غير موثّقة).
 */
@Component({
  selector: 'sc-live-preview',
  standalone: true,
  imports: [],
  templateUrl: './live-preview.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['../site-control-base.css', './live-preview.css']
})
export class LivePreview implements OnInit {
  tokensService = inject(DesignTokensService);
  iconsService = inject(IconsService);
  typographyService = inject(TypographyService);
  themeMode = inject(ThemeModeService);
  overridesService = inject(TemplateOverridesService);
  private sanitizer = inject(DomSanitizer);

  readonly activeSection = signal<'dashboard' | 'requests' | 'wallet' | 'settings'>('dashboard');

  async ngOnInit() {
    if (!this.tokensService.loaded()) await this.tokensService.loadAndApply();
    if (this.iconsService.libraries().length === 0) await this.iconsService.load();
    if (this.typographyService.roles().length === 0) await this.typographyService.load();
    if (!this.overridesService.loaded()) await this.overridesService.loadAndApply();
  }

  setMode(mode: 'dark' | 'light') {
    this.tokensService.setMode(mode);
  }

  setSection(section: 'dashboard' | 'requests' | 'wallet' | 'settings') {
    this.activeSection.set(section);
  }

  /** مصفوفة 0..n-1 — لاستخدام @for بعدد ديناميكي، بنفس منطق templates.ts range() */
  range(n: number): number[] {
    return Array.from({ length: Math.max(0, n) }, (_, i) => i);
  }

  /** إصلاح: ربط سايدبار لوحة (dash) بـovNum('dash','navCount') بدل 4 روابط ثابتة — نفس منطق templates.html (range+track n) */
  readonly navItems: { id: 'dashboard' | 'requests' | 'wallet' | 'settings'; label: string }[] = [
    { id: 'dashboard', label: 'لوحة التحكم' },
    { id: 'requests', label: 'الطلبات' },
    { id: 'wallet', label: 'المحفظة' },
    { id: 'settings', label: 'الإعدادات' },
  ];

  /** إصلاح: ربط بطاقات KPI بقسم "نظرة عامة على الحساب" بـovNum('kpi','cardCount') — المحتوى النصي (رقم/تسمية) لكل بطاقة يبقى كما كان حرفيًا، فقط الحلقة أصبحت ديناميكية */
  readonly kpiSamples: { number: string; label: string; ai?: boolean }[] = [
    { number: '128', label: 'طلب مكتمل' },
    { number: '4.8', label: 'التقييم' },
    { number: '12', label: 'قيد التنفيذ' },
    { number: '92%', label: 'دقة التوصية (AI)', ai: true },
  ];

  /** نفس قيم fallback الافتراضية الموثّقة بـTEMPLATE_SLOT_SCHEMAS.kpi (templates.ts) لخانات icon0..icon5/color0..color5 — بلا قيمة مخترَعة */
  readonly kpiIconDefaults = ['general:i-list', 'general:i-star', 'general:i-clock', 'ai:ws-ai-spark', 'general:i-list', 'general:i-star'];
  readonly kpiColorDefaults = ['#2BD4C7', '#5DA0FF', '#D98A0B', '#A56BE0', '#2BD4C7', '#5DA0FF'];

  /** إصلاح: ربط عدد صفوف جدول "آخر الطلبات" (لوحة التحكم) بـovNum('table','rowCount') — جدولا الطلبات/المحفظة يبقيان كما هما (محتوى تطبيقي مختلف) */
  readonly dashboardRows: { name: string; statusCls: string; statusLabel: string; value: string }[] = [
    { name: 'تصميم واجهة تطبيق', statusCls: 'badge-active', statusLabel: 'نشط', value: '3,200 ر.س' },
    { name: 'استشارة عقارية', statusCls: 'badge-done', statusLabel: 'مكتمل', value: '850 ر.س' },
    { name: 'نزاع على التسليم', statusCls: 'badge-dispute', statusLabel: 'نزاع', value: '1,400 ر.س' },
  ];


  /** قيمة خانة حيّة من overrides القوالب — نفس القيم المُحرَّرة بتبويب "القوالب" بالضبط. */
  ov(templateId: string, slotKey: string, fallback: string | number = ''): string | number {
    return this.overridesService.valueOf(templateId, slotKey, fallback);
  }
  ovNum(templateId: string, slotKey: string, fallback = 0): number {
    const v = this.ov(templateId, slotKey, fallback);
    return typeof v === 'number' ? v : parseFloat(String(v)) || 0;
  }

  /** إصلاح 2026-08-21: نفس منطق templates.ts isAiColor — مربع أيقونة KPI هنا كان يبقى
   * فيروزيًا حتى لو اختار المالك اللون البنفسجي المعتمد للذكاء لهذه الخانة. */
  private readonly AI_PURPLE = '#a56be0';
  isAiColor(hex: string | number): boolean {
    return String(hex).trim().toLowerCase() === this.AI_PURPLE;
  }

  private resolveIconSvg(ref: string): SafeHtml | null {
    const [libId, slot] = String(ref).split(':');
    const svg = this.iconsService.libraries().find(l => l.id === libId)?.icons.find(i => i.slot === slot)?.svg;
    return svg ? this.sanitizer.bypassSecurityTrustHtml(svg) : null;
  }
  /** أيقونة حيّة من خانة override نوعها icon (مثال: kpi.icon0) — تُقرأ من نفس مصدر تبويب القوالب. */
  slotIconSvg(templateId: string, slotKey: string, fallback: string): SafeHtml | null {
    return this.resolveIconSvg(String(this.ov(templateId, slotKey, fallback)));
  }

}
