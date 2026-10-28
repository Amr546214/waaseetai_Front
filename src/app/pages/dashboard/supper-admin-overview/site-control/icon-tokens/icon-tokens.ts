import { Component, computed, effect, inject, OnInit, signal, untracked, ViewEncapsulation } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AI_ICON_INNER } from '../../../../../core/constants/ai-icon';
import { IconFamilyInfo, IconFnRow, IconFnStatus, SiteIdentityAdminApi } from '../../../../../core/identity/site-identity-admin.api';
import { DesignTokensService } from '../core/design-tokens.service';
import { IconsService, LegacyIcon } from '../core/icons.service';
import { RealIconsService } from '../core/real-icons.service';
import { describeFailure } from '../identity/identity-view';
import { ThemeModeService } from '../core/theme-mode.service';
import { InlineSvgDirective } from '../identity/inline-svg.directive';
import { IconFamilyEditor } from './icon-family-editor';
import { IconFnEditor } from './icon-fn-editor';
import { IconFnStore } from './icon-fn.store';
import { ICON_PLACES } from './icon-places';

export type IconFilter = 'all' | IconFnStatus | 'draft';
const PAGE = 120;
export const OTHER_LIB = '__other';

/**
 * «مكتبة الأيقونات»: the SERVER-backed manager of the site's function icons (`icon.fn.<symbolId>`, one key per `<symbol id>`). Every icon shows its real status:
 *  - default: wired, nothing published (the site draws its built-in symbol);
 *  - custom: a published version replaces the symbol in every place that uses the id, for all visitors;
 *  - not wired (with the server's reason): nothing in the site follows a change, so it is never offered as editable.
 * The old browser-only replace / upload / save / import controls are gone from this page: they changed nothing on the site and, once saved, made the library come back empty.
 * A failed load is an explicit error with a retry, never an empty library; the last good list stays visible when only a refresh fails.
 */
@Component({
  selector: 'sc-icon-tokens',
  standalone: true,
  imports: [RouterLink, InlineSvgDirective, IconFnEditor, IconFamilyEditor],
  templateUrl: './icon-tokens.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['../site-control-base.css', './icon-tokens.css']
})
export class IconTokens implements OnInit {
  readonly iconsService = inject(IconsService);
  readonly store = inject(IconFnStore);
  readonly real = inject(RealIconsService);
  private readonly api = inject(SiteIdentityAdminApi);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly designTokens = inject(DesignTokensService);
  readonly theme = inject(ThemeModeService);

  readonly activeLibId = signal<string>('');
  readonly filter = signal<IconFilter>('all');
  readonly query = signal('');
  readonly shownCount = signal(PAGE);
  readonly editing = signal<string | null>(null);
  readonly editingFamily = signal<string | null>(null);
  readonly families = signal<IconFamilyInfo[]>([]);
  readonly familiesError = signal('');
  /** the notice of the legacy review (what was staged / why not) */
  readonly legacyNotice = signal<{ type: 'ok' | 'error'; text: string } | null>(null);
  readonly legacyBusy = signal<string | null>(null);
  readonly legacyOpen = signal(false);
  readonly legacyShown = computed<LegacyIcon[]>(() => this.iconsService.legacy().filter(l => !this.iconsService.legacyIgnored().includes(l.slot)));
  readonly legacyIgnoredList = computed<LegacyIcon[]>(() => this.iconsService.legacy().filter(l => this.iconsService.legacyIgnored().includes(l.slot)));

  /** the library's own drawing (inner markup) by slot: used for the default glyph and the labels when the id is a library slot */
  /** (labels / sample drawings only) */
  readonly glyphBySlot = computed<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const lib of this.iconsService.pristine()) for (const ic of lib.icons) if (!m.has(ic.slot)) m.set(ic.slot, ic.svg);
    return m;
  });
  /** the library each slot belongs to; the server only names the library of rows nothing draws, so the page joins the rest through the library file */
  readonly libBySlot = computed<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const lib of this.iconsService.pristine()) for (const ic of lib.icons) if (!m.has(ic.slot)) m.set(ic.slot, lib.id);
    return m;
  });
  libOf(r: IconFnRow): string { return r.library ?? this.libBySlot().get(r.id) ?? OTHER_LIB; }
  readonly libLabels = computed<Record<string, string>>(() => Object.fromEntries(this.iconsService.pristine().map(l => [l.id, l.label])));
  readonly libColor = computed<Record<string, string>>(() => Object.fromEntries(this.iconsService.pristine().map(l => [l.id, l.colorVar])));

  /** tabs = the libraries that have rows, then everything else the site draws that no library lists */
  readonly tabs = computed(() => {
    const ids = new Set(this.store.rows().map(r => this.libOf(r)));
    const order = ['general', 'ai', 'ws-site', OTHER_LIB].filter(i => ids.has(i));
    for (const i of ids) if (!order.includes(i)) order.push(i);
    return order.map(id => ({ id, label: id === OTHER_LIB ? 'أيقونات أخرى في الموقع' : this.libLabels()[id] ?? id, count: this.store.rows().filter(r => this.libOf(r) === id).length }));
  });
  readonly activeTab = computed(() => this.tabs().find(t => t.id === this.activeLibId())?.id ?? this.tabs()[0]?.id ?? '');

  private matches(r: IconFnRow): boolean {
    const f = this.filter();
    if (f === 'draft' ? !r.hasDraft : f !== 'all' && r.status !== f) return false;
    const q = this.query().trim().toLowerCase();
    return !q || r.id.toLowerCase().includes(q) || (r.label ?? '').toLowerCase().includes(q);
  }
  /** rows of the active tab that pass the filter (the search looks in EVERY tab when a text is typed) */
  readonly filtered = computed<IconFnRow[]>(() => {
    const searching = !!this.query().trim();
    const rank: Record<IconFnStatus, number> = { custom: 0, default: 1, 'not-wired': 2 };
    // the icons that can really change come first (customised, then default), the ones nothing follows last; stable inside a group
    return this.store.rows().filter(r => (searching || this.libOf(r) === this.activeTab()) && this.matches(r))
      .map((r, i) => ({ r, i })).sort((a, b) => rank[a.r.status] - rank[b.r.status] || a.i - b.i).map(x => x.r);
  });
  readonly visible = computed(() => this.filtered().slice(0, this.shownCount()));
  readonly editingRow = computed(() => (this.editing() ? this.store.row(this.editing()!) : null));
  readonly canManage = this.store.canManage;

  constructor() {
    // custom glyphs are fetched only for the cards that are on screen (the list can hold ~340 customised icons)
    effect(() => { const ids = this.visible().filter(r => r.status === 'custom').map(r => r.id); untracked(() => { this.store.shownIds.set(ids); void this.store.ensureGlyphs(ids); }); });
  }

  ngOnInit(): void {
    void this.iconsService.load();
    void this.real.load();
    void this.store.load();
    void this.loadFamilies();
  }

  /** the panel's own light / dark view (same switch as «الهوية»): only this panel, never the site */
  setMode(mode: 'dark' | 'light'): void { this.designTokens.setMode(mode); }
  retry(): void { void this.iconsService.load(true); void this.real.load(true); void this.store.load(true); void this.loadFamilies(); }
  selectLib(id: string): void { this.activeLibId.set(id); this.shownCount.set(PAGE); }
  setFilter(f: IconFilter): void { this.filter.set(f); this.shownCount.set(PAGE); }
  setQuery(ev: Event): void { this.query.set((ev.target as HTMLInputElement).value); this.shownCount.set(PAGE); }
  more(): void { this.shownCount.update(n => n + PAGE); }
  open(id: string): void { this.editingFamily.set(null); this.editing.set(id); }
  close(): void { this.editing.set(null); }
  openFamily(id: string): void { this.editing.set(null); this.editingFamily.set(id); }
  closeFamily(): void { this.editingFamily.set(null); }
  /** from the family editor's «تعديل منفرد» */
  openMember(id: string): void { this.editingFamily.set(null); this.editing.set(id); }
  async loadFamilies(): Promise<void> {
    try { const r = await firstValueFrom(this.api.families()); this.families.set(r?.data?.families ?? []); this.familiesError.set(''); }
    catch (e) { this.familiesError.set(describeFailure(e, 'قراءة عائلات الأيقونات').message); }
  }
  familyOf(r: IconFnRow): IconFamilyInfo | null { return r.familyId ? this.families().find(f => f.id === r.familyId) ?? null : null; }
  /** after any save the list and the families are re-read so counts and chips are the server's */
  onChanged(): void { void this.store.load(true); void this.loadFamilies(); }

  // ---- legacy local customisations: for review only, never published by themselves
  legacySvg(inner: string): string { return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`; }
  legacyHtml(inner: string): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(inner); }
  canStage(l: LegacyIcon): boolean { const r = this.store.row(l.slot); return this.canManage() && !!r?.key && r.status !== 'not-wired'; }
  stageReason(l: LegacyIcon): string {
    const r = this.store.row(l.slot);
    if (!this.canManage()) return 'صلاحيتك لا تسمح بالتعديل.';
    if (!r) return 'هذه الأيقونة ليست من أيقونات الموقع الحالية.';
    return r.status === 'not-wired' ? 'لا شيء في الموقع يتبع هذه الأيقونة، فلا تُحفظ كمسودة.' : '';
  }
  async stageLegacy(l: LegacyIcon): Promise<void> {
    const r = this.store.row(l.slot); if (!r?.key || this.legacyBusy()) return;
    this.legacyBusy.set(l.slot); this.legacyNotice.set(null);
    try {
      const file = new File([this.legacySvg(l.legacyInner)], `${l.slot}-legacy.svg`, { type: 'image/svg+xml' });
      await firstValueFrom(this.api.upload(r.key, file));
      this.iconsService.ignoreLegacy(l.slot);
      this.legacyNotice.set({ type: 'ok', text: `حُفظت نسختك القديمة من «${l.label}» كمسودة خاصة بك على الخادم. لم يتغيّر الموقع: افتح الأيقونة لتراجعها ثم تطبّقها أو تلغيها.` });
      await this.store.load(true);
    } catch (e) { this.legacyNotice.set({ type: 'error', text: describeFailure(e, 'حفظ النسخة القديمة كمسودة').message }); }
    this.legacyBusy.set(null);
  }
  ignoreLegacy(l: LegacyIcon, ignore = true): void { this.iconsService.ignoreLegacy(l.slot, ignore); }

  /** the official AI mark's slots (`i-ai`, `ws-trust-ai`, `rp-i-ai` ...) belong to the identity page (key icon.ai), never to this page */
  managed(slot: string): boolean { return /(^|-)ai$/.test(slot); }
  isManaged(r: IconFnRow): boolean { return r.managedBy === 'icon.ai' || this.managed(r.id); }
  editable(r: IconFnRow): boolean { return !!r.key && r.status !== 'not-wired'; }
  statusText(r: IconFnRow): string { return r.status === 'custom' ? 'مخصّصة' : r.status === 'default' ? 'افتراضية' : 'غير مربوطة'; }
  /** the short reason shown on a not-wired card; the server's full sentence is the tooltip */
  reasonShort(r: IconFnRow): string {
    switch (r.reason?.code) {
      case 'LIBRARY_ONLY': return 'في المكتبة فقط: لا يرسمها أي مكوّن في الموقع.';
      case 'NO_CONSUMER': return 'معرّفة في قالب لكن لا شيء يستعملها.';
      case 'MANAGED_BY_ICON_AI': return 'تُدار من صفحة الهوية.';
      default: return r.reason?.text || 'لا شيء في الموقع يتبع تغيير هذه الأيقونة.';
    }
  }
  /** how many known places follow this icon (the explicit list is in the editor) */
  followCount(r: IconFnRow): number { return ICON_PLACES[r.id]?.follows.length ?? 0; }
  exportJson(): void { this.iconsService.exportJson(); }
  defaultSvg(id: string): string | null { return this.glyphBySlot().get(id) ?? null; }

  /** a managed slot draws the official default glyph; any other library drawing is drawn from the library file */
  shown(r: IconFnRow): SafeHtml | null {
    const inner = this.isManaged(r) ? AI_ICON_INNER : (this.real.get(r.id)?.inner ?? this.defaultSvg(r.id));
    return inner ? this.sanitizer.bypassSecurityTrustHtml(inner) : null;
  }
  /** which drawing the card shows: the REAL symbol the site ships, the official AI mark, or (only for ids nothing draws) the library file's sample */
  glyphKind(r: IconFnRow): 'real' | 'ai' | 'sample' | 'none' { return this.isManaged(r) ? 'ai' : this.real.get(r.id) ? 'real' : this.defaultSvg(r.id) ? 'sample' : 'none'; }
  paint(r: IconFnRow, name: string): string | null { if (this.glyphKind(r) !== 'real') return null; return this.real.get(r.id)!.paint[name] ?? null; }
  viewBox(r: IconFnRow): string { return (this.glyphKind(r) === 'real' && this.real.get(r.id)!.vb) || '0 0 24 24'; }
}
