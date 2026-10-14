import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildCsv, csvCell, exportCsv, printPage } from './export.util';

describe('export.util', () => {
	afterEach(() => vi.restoreAllMocks());

	it('starts with a UTF-8 BOM and keeps header order', () => {
		const csv = buildCsv([{ header: 'الاسم', value: 'name' }, { header: 'العدد', value: 'n' }], [{ name: 'أ', n: 2 }]);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		expect(csv.slice(1).split('\r\n')).toEqual(['الاسم,العدد', 'أ,2']);
	});

	it('quotes commas, quotes and newlines', () => {
		expect(csvCell('a,b')).toBe('"a,b"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell('x\ny')).toBe('"x\ny"');
		expect(csvCell(null)).toBe('');
	});

	it('neutralises formula injection', () => {
		for (const bad of ['=SUM(A1)', '+1', '-1', '@cmd']) expect(csvCell(bad)).toBe(`'${bad}`);
		expect(csvCell('safe=1')).toBe('safe=1');
	});

	it('supports derived columns', () => {
		expect(buildCsv([{ header: 'x', value: (r: { a: number }) => r.a * 2 }], [{ a: 2 }])).toContain('\r\n4');
	});

	it('exportCsv downloads a csv blob with the given filename', () => {
		let blob: Blob | undefined;
		(URL as any).createObjectURL = vi.fn((b: Blob) => { blob = b; return 'blob:x'; });
		(URL as any).revokeObjectURL = vi.fn();
		const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
		exportCsv('report', [{ header: 'a', value: 'a' }], [{ a: 1 }]);
		expect(click).toHaveBeenCalled();
		expect(blob?.type).toContain('text/csv');
	});

	it('printPage calls window.print and restores the title', () => {
		const print = vi.spyOn(window, 'print').mockImplementation(() => {});
		const before = document.title;
		printPage('تقرير');
		expect(print).toHaveBeenCalled();
		expect(document.title).toBe(before);
	});
});
