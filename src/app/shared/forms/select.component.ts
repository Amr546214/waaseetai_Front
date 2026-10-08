import { ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, HostListener, forwardRef, inject, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface WsSelectOption { value: string; label: string; disabled?: boolean }

let nextId = 0;

/**
 * Site-styled replacement for the native <select> (whose popup is drawn by the browser: white in dark mode).
 * Works with ngModel / formControlName and keeps the same string values, so validation and payloads are unchanged.
 * Open/close by click, Enter/Space/ArrowDown; ArrowUp/ArrowDown + Home/End move, Enter/Space picks, Escape/Tab/outside click close.
 * Colours come from the page theme (dark by default, `.light-theme` / `.theme-light` ancestors switch it to light).
 */
@Component({
	selector: 'ws-select',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => WsSelectComponent), multi: true }],
	styles: [`
		:host { display: block; position: relative; }
		.ws-sel-trigger { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 10px; text-align: start; cursor: pointer;
			background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1); border-radius: 10px; padding: 10px 14px; font-family: inherit; font-size: 14px; color: #fff;
			outline: none; transition: border-color .15s; }
		.ws-sel-trigger:focus-visible, .ws-sel-trigger[aria-expanded="true"] { border-color: rgba(43,212,199,.55); }
		.ws-sel-trigger[disabled] { opacity: .5; cursor: not-allowed; }
		.ws-sel-value.is-placeholder { color: #6B7699; }
		.ws-sel-caret { flex: none; width: 12px; height: 12px; color: #6B7699; transition: transform .15s; }
		.ws-sel-trigger[aria-expanded="true"] .ws-sel-caret { transform: rotate(180deg); }
		.ws-sel-panel { position: fixed; z-index: 2000; inset: auto; margin: 0; overflow-y: auto; padding: 6px; list-style: none; box-sizing: border-box; color: inherit;
			background: #0B1437; border: 1px solid rgba(43,212,199,.25); border-radius: 12px; box-shadow: 0 14px 32px rgba(0,0,0,.45); }
		.ws-sel-opt { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 12px; border-radius: 8px; font-size: 14px; color: #E6ECFF; cursor: pointer; }
		.ws-sel-opt.is-active { background: rgba(43,212,199,.12); }
		.ws-sel-opt.is-selected { color: #2BD4C7; font-weight: 800; background: rgba(43,212,199,.18); }
		.ws-sel-opt.is-disabled { opacity: .45; cursor: not-allowed; }
		.ws-sel-check { width: 14px; height: 14px; flex: none; }
		:host-context(.light-theme) .ws-sel-trigger, :host-context(.theme-light) .ws-sel-trigger { background: #F8FAFC; border-color: #CBD5E1; color: #0F172A; }
		:host-context(.light-theme) .ws-sel-trigger[aria-expanded="true"], :host-context(.theme-light) .ws-sel-trigger[aria-expanded="true"],
		:host-context(.light-theme) .ws-sel-trigger:focus-visible, :host-context(.theme-light) .ws-sel-trigger:focus-visible { border-color: #2BD4C7; }
		:host-context(.light-theme) .ws-sel-value.is-placeholder, :host-context(.theme-light) .ws-sel-value.is-placeholder { color: #64748B; }
		:host-context(.light-theme) .ws-sel-panel, :host-context(.theme-light) .ws-sel-panel { background: #fff; border-color: #CBD5E1; box-shadow: 0 14px 32px rgba(15,23,42,.14); }
		:host-context(.light-theme) .ws-sel-opt, :host-context(.theme-light) .ws-sel-opt { color: #0F172A; }
		:host-context(.light-theme) .ws-sel-opt.is-active, :host-context(.theme-light) .ws-sel-opt.is-active { background: #F1F5F9; }
		:host-context(.light-theme) .ws-sel-opt.is-selected, :host-context(.theme-light) .ws-sel-opt.is-selected { color: #0A6F64; background: rgba(43,212,199,.18); }
	`],
	template: `
		<button type="button" class="ws-sel-trigger" role="combobox" [disabled]="isDisabled()" [attr.aria-label]="ariaLabel() || null"
			aria-haspopup="listbox" [attr.aria-expanded]="open()" [attr.aria-controls]="listId" [attr.aria-activedescendant]="open() ? optId(active()) : null"
			data-testid="ws-select-trigger" (click)="toggle()" (keydown)="onKey($event)" (blur)="touch()">
			<span class="ws-sel-value" [class.is-placeholder]="!selectedLabel()">{{ selectedLabel() || placeholder() }}</span>
			<svg class="ws-sel-caret" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
		</button>
		@if (open()) {
			<!-- popover="manual": shown in the browser top layer, so no card/stacking context of the page can paint over or clip the list. -->
			<ul class="ws-sel-panel" popover="manual" role="listbox" [id]="listId" data-testid="ws-select-panel" [attr.aria-label]="ariaLabel() || placeholder()"
				[style.top.px]="pos().top" [style.bottom.px]="pos().bottom" [style.left.px]="pos().left" [style.width.px]="pos().width" [style.max-height.px]="pos().maxHeight">
				@for (o of normalized(); track o.value; let i = $index) {
					<li class="ws-sel-opt" role="option" [id]="optId(i)" [class.is-active]="i === active()" [class.is-selected]="o.value === value()" [class.is-disabled]="o.disabled"
						[attr.aria-selected]="o.value === value()" [attr.aria-disabled]="o.disabled ? true : null" data-testid="ws-select-option"
						(mouseenter)="active.set(i)" (click)="pick(i)">
						<span>{{ o.label }}</span>
						@if (o.value === value()) { <svg class="ws-sel-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> }
					</li>
				}
			</ul>
		}
	`,
})
export class WsSelectComponent implements ControlValueAccessor {
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
	private readonly cdr = inject(ChangeDetectorRef);

	readonly options = input<ReadonlyArray<string | WsSelectOption>>([]);
	readonly placeholder = input<string>('اختر');
	readonly ariaLabel = input<string | undefined>(undefined);

	readonly listId = `ws-sel-list-${++nextId}`;
	readonly value = signal<string>('');
	readonly open = signal(false);
	readonly active = signal(0);
	readonly isDisabled = signal(false);
	/** Fixed viewport position of the list (computed from the trigger when it opens). */
	protected readonly pos = signal<{ top: number | null; bottom: number | null; left: number; width: number; maxHeight: number }>({ top: 0, bottom: null, left: 0, width: 0, maxHeight: 260 });
	/** The page scrolled/resized under an open list: follow the trigger, and close only when the trigger left the viewport. */
	private readonly reposition = (e?: Event) => {
		if (!this.open() || (e?.target instanceof Node && this.host.nativeElement.contains(e.target))) return;
		const r = (this.host.nativeElement.querySelector('button') as HTMLElement).getBoundingClientRect();
		if (r.bottom < 0 || r.top > window.innerHeight) { this.close(); } else { this.place(); }
		this.cdr.markForCheck();
	};

	private onChange: (v: string) => void = () => {};
	private onTouched: () => void = () => {};

	protected normalized(): WsSelectOption[] {
		return this.options().map(o => typeof o === 'string' ? { value: o, label: o } : o);
	}
	protected selectedLabel(): string {
		return this.normalized().find(o => o.value === this.value())?.label ?? '';
	}
	protected optId = (i: number) => `${this.listId}-o${i}`;

	writeValue(v: string | null): void { this.value.set(v ?? ''); this.cdr.markForCheck(); }
	registerOnChange(fn: (v: string) => void): void { this.onChange = fn; }
	registerOnTouched(fn: () => void): void { this.onTouched = fn; }
	setDisabledState(d: boolean): void { this.isDisabled.set(d); if (d) this.open.set(false); this.cdr.markForCheck(); }
	protected touch() { if (!this.open()) this.onTouched(); }

	toggle() { this.open() ? this.close() : this.openList(); }

	private openList() {
		if (this.isDisabled()) return;
		const opts = this.normalized();
		const sel = opts.findIndex(o => o.value === this.value() && !o.disabled);
		this.active.set(sel >= 0 ? sel : Math.max(0, opts.findIndex(o => !o.disabled)));
		this.place();
		this.open.set(true);
		this.cdr.detectChanges();
		const panel = this.host.nativeElement.querySelector('.ws-sel-panel') as (HTMLElement & { showPopover?: () => void }) | null;
		try { panel?.showPopover?.(); } catch { /* already shown / unsupported: the fixed + z-index fallback still applies */ }
		window.addEventListener('scroll', this.reposition, true);
	}
	private close() {
		window.removeEventListener('scroll', this.reposition, true);
		this.open.set(false); this.onTouched();
	}

	/** Below the trigger when there is room, otherwise above it; width = trigger width; never taller than the space available. */
	private place() {
		const r = (this.host.nativeElement.querySelector('button') as HTMLElement).getBoundingClientRect();
		const gap = 6, margin = 12, want = Math.min(260, this.normalized().length * 40 + 12);
		const below = window.innerHeight - r.bottom - gap - margin, above = r.top - gap - margin;
		const up = below < want && above > below;
		this.pos.set(up
			? { top: null, bottom: window.innerHeight - r.top + gap, left: r.left, width: r.width, maxHeight: Math.max(120, Math.min(260, above)) }
			: { top: r.bottom + gap, bottom: null, left: r.left, width: r.width, maxHeight: Math.max(120, Math.min(260, below)) });
	}

	@HostListener('window:resize')
	protected onResize() { this.reposition(); }

	pick(i: number) {
		const o = this.normalized()[i];
		if (!o || o.disabled) return;
		this.value.set(o.value);
		this.onChange(o.value);
		this.close();
		(this.host.nativeElement.querySelector('button') as HTMLButtonElement | null)?.focus();
	}

	private move(step: 1 | -1, to?: 'first' | 'last') {
		const opts = this.normalized();
		if (!opts.some(o => !o.disabled)) return;
		let i = to === 'first' ? -1 : to === 'last' ? opts.length : this.active();
		const dir = to === 'last' ? -1 : to === 'first' ? 1 : step;
		do { i += dir; } while (i >= 0 && i < opts.length && opts[i].disabled);
		if (i >= 0 && i < opts.length) this.active.set(i);
	}

	protected onKey(e: KeyboardEvent) {
		const k = e.key;
		if (!this.open()) {
			if (k === 'Enter' || k === ' ' || k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); this.openList(); }
			return;
		}
		if (k === 'Escape') { e.preventDefault(); this.close(); }
		else if (k === 'Tab') { this.close(); }
		else if (k === 'ArrowDown') { e.preventDefault(); this.move(1); }
		else if (k === 'ArrowUp') { e.preventDefault(); this.move(-1); }
		else if (k === 'Home') { e.preventDefault(); this.move(1, 'first'); }
		else if (k === 'End') { e.preventDefault(); this.move(-1, 'last'); }
		else if (k === 'Enter' || k === ' ') { e.preventDefault(); this.pick(this.active()); }
	}

	@HostListener('document:click', ['$event'])
	protected onDocClick(e: Event) {
		if (this.open() && !this.host.nativeElement.contains(e.target as Node)) { this.close(); this.cdr.markForCheck(); }
	}
}
