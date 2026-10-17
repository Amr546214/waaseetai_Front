/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');
const css = readFileSync(join(SRC, 'styles.css'), 'utf8');

describe('unified select styling (native + ws-select)', () => {
	it('every native single select gets one chevron at the inline end (logical via :dir) with room for the text', () => {
		const rule = css.match(/select:not\(\[multiple\]\):not\(\[size\]\):not\(\.ws-select-plain\)\{[^}]*\}/)![0];
		expect(rule).toContain('appearance:none');
		expect(rule).toContain('background-image:url("data:image/svg+xml');
		expect(rule).toContain('padding-inline-end:34px !important');
		expect(css).toMatch(/:not\(\.ws-select-plain\):dir\(rtl\)\{background-position:left 12px center !important\}/);
	});
	it('the arrow flips colour in light mode and multi-selects are excluded', () => {
		expect(css).toMatch(/html\.light-theme select:not\(\[multiple\]\)[\s\S]*?stroke='%23475569'/);
		expect(css).toContain(':not([multiple]):not([size])');
	});
	it('option lists have explicit dark and light backgrounds plus disabled/selected states', () => {
		expect(css).toMatch(/\nselect option,select optgroup\{background-color:#0B1437;color:#E6ECFF\}/);
		expect(css).toContain('select option:disabled{color:#6B7699}');
		expect(css).toMatch(/body\.theme-light select option\{background-color:#fff;color:#0F172A\}|body\.theme-light select optgroup\{background-color:#fff;color:#0F172A\}/);
		expect(css).toContain('select option:checked');
	});
	it('no legacy script forces white native options in every theme (it overrode the themed option list)', () => {
		const js = readFileSync(join(SRC, '..', 'public', 'assets', 'ws-light-polish.js'), 'utf8');
		expect(js).not.toMatch(/select option[^']*\{[^}]*!important/);
	});
	it('assistant-chat no longer forces black option text on the dark popup', () => {
		const ts = readFileSync(join(SRC, 'app/sheards/assistant-chat/assistant-chat.ts'), 'utf8');
		expect(ts).not.toContain('.ac__settings option { color: #000; }');
	});
	it('ws-select has an empty state, themed scrollbar and RTL-safe flex caret', () => {
		const ts = readFileSync(join(SRC, 'app/shared/forms/select.component.ts'), 'utf8');
		expect(ts).toContain('ws-select-empty');
		expect(ts).toContain('color-scheme: light');
		expect(ts).toContain('justify-content: space-between');
	});
});
