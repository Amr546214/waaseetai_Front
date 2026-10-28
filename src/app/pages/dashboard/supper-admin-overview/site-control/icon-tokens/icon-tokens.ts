import { Component, computed, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { AI_ICON_INNER } from '../../../../../core/constants/ai-icon';
import { IconFnRow, IconFnStatus } from '../../../../../core/identity/site-identity-admin.api';
import { DesignTokensService } from '../core/design-tokens.service';
import { IconsService } from '../core/icons.service';
import { ThemeModeService } from '../core/theme-mode.service';
import { InlineSvgDirective } from '../identity/inline-svg.directive';
import { IconFnEditor } from './icon-fn-editor';
import { IconFnStore } from './icon-fn.store';

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
  imports: [RouterLink, InlineSvgDirective, IconFnEditor],
  templateUrl: './icon-tokens.html',
  encapsulation: ViewEncapsulation.ShadowDom,
  styleUrls: ['../site-control-base.css', './icon-tokens.css']
})
export class IconTokens implements OnInit {
  readonly iconsService = inject(IconsService);
  readonly store = inject(IconFnStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly designTokens = inject(DesignTokensService);
  readonly theme = inject(ThemeModeService);

  readonly activeLibId = signal<string>('');
  readonly filter = signal<IconFilter>('all');
  readonly query = signal('');
  readonly shownCount = signal(PAGE);
  readonly editing = signal<string | null>(null);

  /** the library's own drawing (inner markup) by slot: used for the default glyph and the labels when the id is a library slot */
  readonly glyphBySlot = computed<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const lib of this.iconsService.libraries()) for (const ic of lib.icons) if (!m.has(ic.slot)) m.set(ic.slot, ic.svg);
    return m;
  });
  /** the library each slot belongs to; the server only names the library of rows nothing draws, so the page joins the rest through the library file */
  readonly libBySlot = computed<Map<string, string>>(() => {
    const m = new Map<string, string>();
    for (const lib of this.iconsService.libraries()) for (const ic of lib.icons) if (!m.has(ic.slot)) m.set(ic.slot, lib.id);
    return m;
  });
  libOf(r: IconFnRow): string { return r.library ?? this.libBySlot().get(r.id) ?? OTHER_LIB; }
  readonly libLabels = computed<Record<string, string>>(() => Object.fromEntries(this.iconsService.libraries().map(l => [l.id, l.label])));
  readonly libColor = computed<Record<string, string>>(() => Object.fromEntries(this.iconsService.libraries().map(l => [l.id, l.colorVar])));

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

  ngOnInit(): void {
    void this.iconsService.load();
    void this.store.load();
  }

  /** the panel's own light / dark view (same switch as «الهوية»): only this panel, never the site */
  setMode(mode: 'dark' | 'light'): void { this.designTokens.setMode(mode); }
  retry(): void { void this.iconsService.load(true); void this.store.load(true); }
  selectLib(id: string): void { this.activeLibId.set(id); this.shownCount.set(PAGE); }
  setFilter(f: IconFilter): void { this.filter.set(f); this.shownCount.set(PAGE); }
  setQuery(ev: Event): void { this.query.set((ev.target as HTMLInputElement).value); this.shownCount.set(PAGE); }
  more(): void { this.shownCount.update(n => n + PAGE); }
  open(id: string): void { this.editing.set(id); }
  close(): void { this.editing.set(null); }

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
  defaultSvg(id: string): string | null { return this.glyphBySlot().get(id) ?? null; }

  /** a managed slot draws the official default glyph; any other library drawing is drawn from the library file */
  shown(r: IconFnRow): SafeHtml | null {
    const inner = this.isManaged(r) ? AI_ICON_INNER : this.defaultSvg(r.id);
    return inner ? this.sanitizer.bypassSecurityTrustHtml(inner) : null;
  }
}
