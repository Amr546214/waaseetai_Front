import { Component, OnInit, computed, inject, ViewEncapsulation } from '@angular/core';
import { DesignTokensService } from '../core/design-tokens.service';
import { IconsService } from '../core/icons.service';
import { AccountLevelsService } from '../core/account-levels.service';
import { TypographyService } from '../core/typography.service';
import { PersistenceService } from '../core/persistence.service';
import { contrastRatio, wcagLevel } from '../core/contrast';

interface HealthIssue {
  severity: 'error' | 'warning';
  area: string;
  message: string;
}

/**
 * لوحة صحة النظام — إضافة 2026-08-18 (اختيار المالك من قائمة التوصيات). أول صفحة
 * يُفترض المستخدم يفتحها: ملخّص فوري لحالة كل نظام التوكنات بدل الاضطرار لفتح كل
 * تبويب لحاله ليكتشف مشاكل. كل الفحوصات هنا حسابية (لا تخمين قيم) — تُقارن بيانات
 * فعلية من الخدمات القائمة فقط.
 */
@Component({
  selector: 'sc-health',
  standalone: true,
  imports: [],
  templateUrl: './health.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['../site-control-base.css', './health.css']
})
export class Health implements OnInit {
  tokensService = inject(DesignTokensService);
  iconsService = inject(IconsService);
  accountLevelsService = inject(AccountLevelsService);
  typographyService = inject(TypographyService);
  persistence = inject(PersistenceService);

  async ngOnInit() {
    if (!this.tokensService.loaded()) await this.tokensService.loadAndApply();
    if (this.iconsService.libraries().length === 0) await this.iconsService.load();
    if (!this.accountLevelsService.data()) await this.accountLevelsService.load();
    if (this.typographyService.roles().length === 0) await this.typographyService.load();
  }

  readonly tokenCount = computed(() =>
    this.tokensService.groups().reduce((s, g) => s + g.tokens.length, 0)
  );

  readonly iconCount = computed(() =>
    this.iconsService.libraries().reduce((s, l) => s + l.icons.length, 0)
  );

  readonly accountsNeedingReview = computed(() =>
    (this.accountLevelsService.data()?.accounts ?? []).filter(a => a.needsReview)
  );

  /** توكنات لونية بنفس القيمة بأسماء مختلفة داخل نفس الوضع — تكرار قد يكون غير مقصود */
  readonly duplicateValueTokens = computed(() => {
    const groups = this.tokensService.groups();
    const byValue = new Map<string, string[]>();
    for (const g of groups) {
      for (const t of g.tokens) {
        if (t.type !== 'color') continue;
        byValue.set(t.value, [...(byValue.get(t.value) ?? []), t.var]);
      }
    }
    return [...byValue.entries()].filter(([, vars]) => vars.length > 1);
  });

  /** أزواج نص/خلفية بتباين أقل من AA (4.5:1) — فحص سريع، ليس شاملاً لكل تركيبة ممكنة */
  readonly contrastFailures = computed(() => {
    const groups = this.tokensService.groups();
    const bg = groups.flatMap(g => g.tokens).find(t => t.var === '--pg')?.value ?? '#FFFFFF';
    const textTokens = groups.flatMap(g => g.tokens).filter(t => t.type === 'color' && t.var.startsWith('--txt'));
    return textTokens
      .map(t => ({ var: t.var, ratio: contrastRatio(t.value, bg) }))
      .filter(r => r.ratio !== null && wcagLevel(r.ratio) === 'fail');
  });

  readonly duplicateFontSizeRoles = computed(() => {
    const roles = this.typographyService.roles();
    const bySize = new Map<string, string[]>();
    for (const r of roles) bySize.set(r.fontSize, [...(bySize.get(r.fontSize) ?? []), r.id]);
    return [...bySize.entries()].filter(([, ids]) => ids.length > 1);
  });

  readonly issues = computed<HealthIssue[]>(() => {
    const list: HealthIssue[] = [];
    for (const [value, vars] of this.duplicateValueTokens()) {
      list.push({ severity: 'warning', area: 'الألوان', message: `توكنات بنفس القيمة (${value}): ${vars.join('، ')}` });
    }
    for (const f of this.contrastFailures()) {
      list.push({ severity: 'error', area: 'الألوان', message: `تباين ضعيف لـ ${f.var} مقابل خلفية اللوحة (${(f.ratio ?? 0).toFixed(2)}:1 — أقل من حد AA وهو 4.5:1)` });
    }
    for (const [size, ids] of this.duplicateFontSizeRoles()) {
      list.push({ severity: 'warning', area: 'الخطوط', message: `أدوار نصية بنفس الحجم (${size}): ${ids.join('، ')}` });
    }
    for (const a of this.accountsNeedingReview()) {
      list.push({ severity: 'warning', area: 'الحسابات', message: `${a.label}: ${a.reviewNote ?? 'بحاجة مراجعة'}` });
    }
    if (this.iconsService.loadError()) list.push({ severity: 'error', area: 'الأيقونات', message: this.iconsService.loadError()! });
    if (this.tokensService.loadError()) list.push({ severity: 'error', area: 'الألوان', message: this.tokensService.loadError()! });
    return list;
  });

  readonly errorCount = computed(() => this.issues().filter(i => i.severity === 'error').length);
  readonly warningCount = computed(() => this.issues().filter(i => i.severity === 'warning').length);

  lastSavedFor(name: string): string | null {
    const saved = this.persistence.load(name);
    return saved?.savedAt ?? null;
  }

  hasSaved(name: string): boolean {
    return this.persistence.hasSaved(name);
  }
}
