import { Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { AccountLevelsService } from '../core/account-levels.service';
import { readAndSanitizeSvgFile } from '../core/svg-sanitize';
import { IconsService } from '../core/icons.service';
import { ThemeModeService } from '../core/theme-mode.service';

type Section = 'levels' | 'points' | 'profits' | 'loyalty';

@Component({
  selector: 'sc-accounts',
  standalone: true,
  imports: [],
  templateUrl: './accounts.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['../site-control-base.css', './accounts.css']
})
export class Accounts implements OnInit {
  service = inject(AccountLevelsService);
  iconsService = inject(IconsService);
  sanitizer = inject(DomSanitizer);
  themeMode = inject(ThemeModeService);

  activeAccountId = signal<string>('provider-individual');
  activeSection = signal<Section>('levels');
  uploadError = signal<string>('');
  savedMsg = signal<string>('');

  readonly sections: { id: Section; label: string }[] = [
    { id: 'levels', label: 'المستويات الأساسية' },
    { id: 'points', label: 'اكتساب وفقدان النقاط' },
    { id: 'profits', label: 'العمولات والأرباح' },
    { id: 'loyalty', label: 'الولاء والتميز' }
  ];

  async ngOnInit() {
    if (!this.service.data()) {
      await this.service.load();
    }
    if (this.iconsService.libraries().length === 0) {
      await this.iconsService.load();
    }
  }

  currentAccount() {
    return this.service.accountsList().find(a => a.id === this.activeAccountId()) ?? null;
  }

  selectAccount(id: string) {
    this.activeAccountId.set(id);
    this.uploadError.set('');
  }

  selectSection(s: Section) {
    this.activeSection.set(s);
  }

  reqKeys(reqs: Record<string, number>): string[] {
    return Object.keys(reqs);
  }

  reqLabel(key: string): string {
    const map: Record<string, string> = {
      pointsMoreThan: 'نقاط أكثر من',
      projectsMoreThan: 'مشاريع أكثر من',
      ratingAbove: 'تقييم أعلى من',
      clientsMoreThan: 'عملاء أكثر من',
      revenueAbove: 'إيرادات أعلى من'
    };
    return map[key] ?? key;
  }

  onReqChange(accountId: string, levelN: number, key: string, event: Event) {
    const v = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.service.updateLevelRequirement(accountId, levelN, key, v);
  }

  onNameChange(accountId: string, levelN: number, event: Event) {
    this.service.updateLevelName(accountId, levelN, (event.target as HTMLInputElement).value);
  }

  currentHex(level: { hexDark: string; hexLight: string }): string {
    return this.themeMode.mode() === 'dark' ? level.hexDark : level.hexLight;
  }

  onHexChange(accountId: string, levelN: number, event: Event) {
    const value = (event.target as HTMLInputElement).value;
    const mode = this.themeMode.mode() === 'dark' ? 'hexDark' : 'hexLight';
    this.service.updateLevelHex(accountId, levelN, mode, value);
  }

  onNumField(accountId: string, levelN: number, field: any, event: Event) {
    const v = parseFloat((event.target as HTMLInputElement).value) || 0;
    this.service.updateLevelField(accountId, levelN, field, v);
  }

  onPointsRuleChange(accountId: string, listKey: 'pointsEarn' | 'pointsLose', index: number, field: any, event: Event) {
    const raw = (event.target as HTMLInputElement).value;
    const value = field === 'points' ? (parseFloat(raw) || 0) : raw;
    this.service.updatePointsRule(accountId, listKey, index, field, value);
  }

  asPercent(v: number | undefined): string {
    if (v === undefined || v === null) return '-';
    return (v * 100).toFixed(2).replace(/\.00$/, '') + '%';
  }

  /** إصلاح 2026-08-19 (ملاحظة مباشرة من المالك): أيقونة كل مستوى (levelN >= 0) كانت تعرض
   * نفس أيقونة "نوع الحساب" (مثلاً حقيبة ws-provider) لكل المستويات — بلا أي فرق شكلي بينها
   * غير اللون. هذا يخالف قالب "بطاقة تدرّج المستوى (tier-banner)" الموثّق بملف الهوية
   * (08_هوية_وسيط_AI_الوثيقة_المصدر_v2_الصحيح.html، بند 7): "أيقونة نجمة بلون المستوى".
   * الافتراضي الآن = 'ws-star' (نجمة مؤكدة بـicons.json، نفس شكل ic-star بوثيقة الهوية) —
   * يبقى قابلاً للاستبدال بأيقونة مرفوعة يدويًا لكل مستوى (levelIconFor) كما كان. أيقونة
   * "نوع الحساب" نفسها (levelN === -1، تظهر مرة واحدة أعلى المجموعة) تبقى بلا تغيير — هي
   * تمثيل الدور (مقدم/طالب/وسيط) لا المستوى، فليست معنية بهذا الإصلاح. */
  private static readonly DEFAULT_LEVEL_ICON_SLOT = 'ws-star';

  iconSvg(accountId: string, levelN: number): SafeHtml | null {
    const svg = this.service.levelIconFor(accountId, levelN);
    if (svg) return this.sanitizer.bypassSecurityTrustHtml(svg);
    const defaultSlot = levelN === -1
      ? this.currentAccount()?.icon
      : Accounts.DEFAULT_LEVEL_ICON_SLOT;
    if (!defaultSlot) return null;
    for (const lib of this.iconsService.libraries()) {
      const found = lib.icons.find(i => i.slot === defaultSlot);
      if (found) return this.sanitizer.bypassSecurityTrustHtml(found.svg);
    }
    return null;
  }

  async onUploadGroupIcon(accountId: string, event: Event) {
    await this.handleUpload(event, svg => this.service.setGroupIcon(accountId, svg));
  }

  async onUploadLevelIcon(accountId: string, levelN: number, event: Event) {
    await this.handleUpload(event, svg => this.service.setLevelIcon(accountId, levelN, svg));
  }

  private async handleUpload(event: Event, onOk: (svg: string) => void) {
    this.uploadError.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const result = await readAndSanitizeSvgFile(file);
    input.value = '';
    if (!result.ok) {
      this.uploadError.set(result.error);
      return;
    }
    onOk(result.svg);
  }

  resetLevelIcon(accountId: string, levelN: number) {
    this.service.clearLevelIcon(accountId, levelN);
  }

  resetGroupIcon(accountId: string) {
    this.service.clearGroupIcon(accountId);
  }

  save() {
    const ok = this.service.save();
    this.savedMsg.set(ok ? 'تم الحفظ محليًا' : 'تعذّر الحفظ');
    setTimeout(() => this.savedMsg.set(''), 4000);
  }

  exportJson() {
    this.service.exportJson();
  }

  async onImportFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const res = await this.service.importJson(file);
    this.savedMsg.set(res.ok ? 'تم الاستيراد' : (res.error ?? 'فشل الاستيراد'));
    setTimeout(() => this.savedMsg.set(''), 4000);
  }

  async resetToSource() {
    if (!confirm('هذا سيمسح كل تعديلاتك المحفوظة محليًا لبيانات الحسابات ويرجّع القيم الأصلية — متأكد؟')) return;
    await this.service.resetToSource();
  }
}
