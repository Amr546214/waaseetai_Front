import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildProbe, buildProbeParts, colourText, groupByValue, lengthText, measurePlaces, placeLabel, splitSelectors } from './effective-style';
import { PRESENTATION_STYLE_ID } from './presentation-controls';

describe('effective-style: what a control really has on the site, per place', () => {
	let style: HTMLStyleElement;
	beforeEach(() => { style = document.createElement('style'); style.id = 'site-css'; document.head.appendChild(style); });
	afterEach(() => { style.remove(); document.getElementById(PRESENTATION_STYLE_ID)?.remove(); });

	it('splits selectors on top-level commas only', () => {
		expect(splitSelectors('.a,.b ,[data-x="1,2"]')).toEqual(['.a', '.b', '[data-x="1,2"]']);
		expect(splitSelectors('input:not([type="hidden"]),textarea')).toEqual(['input:not([type="hidden"])', 'textarea']);
	});
	it('builds a probe element for tags, classes, attributes, :disabled and descendant chains; refuses what it cannot express', () => {
		expect(buildProbe(document, '.card')!.className).toBe('card');
		expect(buildProbe(document, 'button:disabled')!.hasAttribute('disabled')).toBe(true);
		expect(buildProbe(document, '[role="dialog"]')!.getAttribute('role')).toBe('dialog');
		expect(buildProbe(document, 'input:not([type="hidden"]):not([type="radio"])')!.tagName).toBe('INPUT');
		expect(buildProbe(document, 'table th')!.querySelector('th')).not.toBeNull();
		expect(buildProbe(document, 'ul > li')).toBeNull();
		expect(buildProbe(document, 'a:hover')).toBeNull();
	});
	it('a table cell is measured ON the cell, never on the table that holds it (probe target = last element of the chain)', () => {
		style.textContent = 'table{padding:8px} table th,table td{padding:26px} th{font-size:13px}';
		const parts = buildProbeParts(document, 'table td')!;
		expect(parts.root.tagName).toBe('TABLE'); expect(parts.target.tagName).toBe('TD'); expect(parts.target.parentElement!.tagName).toBe('TR');
		const r = measurePlaces(document, 'table th,table td', 'padding');
		expect(r.map(p => p.value)).toEqual(['26px (1.625rem)', '26px (1.625rem)']);
		expect(measurePlaces(document, 'table td', 'padding')[0].value).not.toContain('8px');
	});
	it('reads the REAL computed value of each place and shows units / colours plainly', () => {
		style.textContent = '.card{border-radius:12px;padding:20px} .project-card{border-radius:16px;padding:20px} h1{font-size:32px;font-weight:800} .btn{background-color:rgb(43,212,199)}';
		const r = measurePlaces(document, '.card,.project-card', 'border-radius');
		expect(r.map(p => p.value)).toEqual(['12px (0.75rem)', '16px (1rem)']);
		expect(groupByValue(r).length).toBe(2); // different places are NOT merged into one misleading value
		expect(r.every(p => p.basis === 'global')).toBe(true); // no such element on this page: said on the row
		expect(measurePlaces(document, '.card,.project-card', 'padding').map(p => p.value)).toEqual(['20px (1.25rem)', '20px (1.25rem)']);
		expect(groupByValue(measurePlaces(document, '.card,.project-card', 'padding'))).toEqual([{ value: '20px (1.25rem)', reason: undefined, basis: 'global', places: ['بطاقة', 'بطاقة مشروع'] }]);
		expect(measurePlaces(document, 'h1', 'font-size')[0].value).toBe('32px (2rem)');
		expect(measurePlaces(document, 'h1', 'font-weight')[0].value).toBe('800');
		expect(measurePlaces(document, '.btn', 'background')[0].value).toBe('#2bd4c7');
	});
	it('a value that cannot be measured says why instead of inventing one', () => {
		style.textContent = '';
		const r = measurePlaces(document, 'ul > li,.card', 'gap');
		expect(r[0]).toMatchObject({ value: null, reason: expect.stringContaining('تعذّر بناء عنصر قياس') });
		expect(r[1].value).toBeNull();
		expect(r[1].reason).toContain('المتصفح أعاد');
	});
	it('original: the published overrides are switched off for the read and restored in the same task (no leftover change)', () => {
		style.textContent = '.card{border-radius:12px}';
		const ov = document.createElement('style'); ov.id = PRESENTATION_STYLE_ID; ov.textContent = 'html .card{border-radius:30px!important}'; document.head.appendChild(ov);
		expect(measurePlaces(document, '.card', 'border-radius')[0].value).toBe('30px (1.875rem)'); // current = override
		expect(measurePlaces(document, '.card', 'border-radius', { original: true })[0].value).toBe('12px (0.75rem)'); // the site's own value
		expect(ov.isConnected).toBe(true); expect(document.head.contains(ov)).toBe(true);
		expect(document.querySelector('[data-ws-measure]')).toBeNull(); // the probe host is gone
	});
	it('helpers: colour / length text and place names', () => {
		expect(colourText('rgb(0, 0, 0)')).toBe('#000000');
		expect(colourText('rgba(255, 255, 255, 0.5)')).toBe('#ffffff (شفافية 50%)');
		expect(lengthText('14px')).toBe('14px (0.875rem)'); expect(lengthText('0px')).toBe('0px'); expect(lengthText('1.5rem')).toBe('1.5rem');
		expect(placeLabel('.project-card')).toBe('بطاقة مشروع'); expect(placeLabel('.unknown-thing')).toBe('.unknown-thing');
	});
});

describe('effective-style: editor-ready raw values', () => {
	it('colours, line-height ratios and font stacks come back in the form the editor accepts', () => {
		const st = document.createElement('style'); st.textContent = '.t{color:rgba(10,20,30,0.5);font-size:20px;line-height:30px;font-family:"Tajawal", system-ui} .u{letter-spacing:normal}'; document.head.appendChild(st);
		expect(measurePlaces(document, '.t', 'color')[0]).toMatchObject({ value: '#0a141e (شفافية 50%)', raw: 'rgba(10,20,30,0.5)' });
		expect(measurePlaces(document, '.t', 'line-height')[0].raw).toBe('1.5');
		expect(measurePlaces(document, '.t', 'font-family')[0].raw).toBe("'Tajawal',system-ui");
		expect(measurePlaces(document, '.u', 'letter-spacing')[0]).toMatchObject({ raw: 'normal' });
		st.remove();
	});
});

describe('effective-style: real elements of the page come first', () => {
	it('counts the real elements that match a place, groups their distinct values, and says the number comes from this page', () => {
		const st = document.createElement('style'); st.textContent = '.card{border-radius:12px} .card.big{border-radius:20px}'; document.head.appendChild(st);
		const wrap = document.createElement('div'); wrap.innerHTML = '<div class="card"></div><div class="card"></div><div class="card big"></div>'; document.body.appendChild(wrap);
		const r = measurePlaces(document, '.card', 'border-radius');
		expect(r.map(p => [p.value, p.count, p.basis])).toEqual([['12px (0.75rem)', 2, 'instances'], ['20px (1.25rem)', 1, 'instances']]);
		expect(r[0].place).toContain('عنصران');
		expect(groupByValue(r).length).toBe(2);
		wrap.remove(); st.remove();
	});
    it('only records existing elements during page capture and converts rem using that page root', () => {
        const style=document.createElement('style');style.textContent='html{font-size:20px}.card{border-radius:20px}';document.head.appendChild(style);
        expect(measurePlaces(document,'.card','border-radius',{existingOnly:true})).toEqual([]);
        const card=document.createElement('article');card.className='card';document.body.appendChild(card);
        try {expect(measurePlaces(document,'.card','border-radius',{existingOnly:true})[0]).toMatchObject({basis:'instances',value:'20px (1rem)'});}
        finally {card.remove();style.remove();}
    });

});
