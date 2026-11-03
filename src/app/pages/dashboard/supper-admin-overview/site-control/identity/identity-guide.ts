import { Component, ElementRef, HostListener, ViewEncapsulation, inject, output, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminAccessService } from '../../../../../core/services/admin-access.service';
import { TokenEditor } from '../platform-tokens/token-editor';

type Editor = 'reference' | 'colors' | 'typography' | 'layout' | 'components' | 'icons';
const SECTIONS = new Set(['colors', 'typography', 'layout', 'components', 'icons', 'assets']);

/** The owner's original guide is isolated from the authenticated application.
 * Messages select an editor only: no frame message may upload, save or publish.
 * TokenEditor remains the sole permission-checked, versioned writer.
 */
@Component({
 selector: 'sc-identity-guide', standalone: true, imports: [TokenEditor, RouterLink],
 encapsulation: ViewEncapsulation.ShadowDom,
 templateUrl: './identity-guide.html', styleUrls: ['../site-control-base.css', './identity-guide.css'],
})
export class IdentityGuide {
 readonly assetsRequested = output<void>();
 readonly selected = signal<Editor>('reference');
 readonly opened = signal(false);
 readonly visited = signal(new Set<Editor>());
 readonly loaded = signal(false);
 readonly expanded = signal(false);
 @HostListener('document:keydown.escape') closeExpanded(): void { this.expanded.set(false); }
 readonly frame = viewChild<ElementRef<HTMLIFrameElement>>('frame');
 readonly editor = viewChild<ElementRef<HTMLElement>>('editor');
 readonly access = inject(AdminAccessService);
 readonly tabs: { id: Editor; label: string }[] = [
  { id: 'reference', label: 'ملف الهوية الأصلي' }, { id: 'colors', label: 'الألوان' },
  { id: 'typography', label: 'الخطوط' }, { id: 'layout', label: 'المقاسات والزوايا' }, {id:'components',label:'المكوّنات'}, { id: 'icons', label: 'الأيقونات' },
 ];
 select(section: Editor): void { this.visited.update(current => new Set([...current, section])); this.selected.set(section); }
 openReference(): void { this.opened.set(true); }
 retry(): void { this.opened.set(false); this.loaded.set(false); setTimeout(() => this.opened.set(true)); }
 @HostListener('window:message', ['$event'])
 onMessage(event: MessageEvent): void {
  // A sandboxed frame has an opaque origin; bind to its WindowProxy, never trust origin="null" alone.
  if (!this.frame()?.nativeElement.contentWindow || event.source !== this.frame()!.nativeElement.contentWindow) return;
  const data = event.data;
  if (data?.type === 'waseet-identity-ready') { this.loaded.set(true); return; }
  if (!data || data.type !== 'waseet-identity-edit' || typeof data.section !== 'string' || !SECTIONS.has(data.section)) return;
  if (data.section === 'assets') this.assetsRequested.emit();
  else { this.select(data.section as Editor); this.editor()?.nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }
 }
}
