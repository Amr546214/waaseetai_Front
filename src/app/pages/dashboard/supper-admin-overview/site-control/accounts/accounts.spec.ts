import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Accounts } from './accounts';
import { LevelsService, LevelsPayload } from '../../../../../core/levels/levels.service';
import { LevelIdentityAdminApi, LevelIdentityRow, LevelIdentityView } from '../../../../../core/levels/level-identity-admin.api';
import { setRuntimeLevels, providerLevelOfTitle, providerLevelName, levelColor, defaultLevelColor } from '../../../../../core/levels/level-colors';

const col = (role: 'PROVIDER' | 'CLIENT' | 'MARKETER', l: number) => ({ dark: defaultLevelColor(role, l, 'dark'), light: defaultLevelColor(role, l, 'light') });
const NAMES = { PROVIDER: ['مبتدئ', 'منجز', 'منفذ'], CLIENT: ['زائر', 'مستكشف', 'باحث'], MARKETER: ['مسوق', 'مساعد', 'موصل'] } as const;
const payload = (): LevelsPayload => ({ version: 1, thresholdRule: 'GREATER_OR_EQUAL', payments: { clientDeposit: {}, marketerWithdrawal: {} }, roles: Object.fromEntries((['PROVIDER', 'CLIENT', 'MARKETER'] as const).map(r => [r, { label: r, percentKind: 'COMMISSION', levels: NAMES[r].map((name, i) => ({ level: i + 1, name, percent: 10 - i, station: 1, color: col(r, i + 1), thresholds: { points: 0 } })) }])) as never });
const rows = (): LevelIdentityRow[] => (['PROVIDER', 'CLIENT', 'MARKETER'] as const).flatMap(r => NAMES[r].map((name, i) => ({ role: r, level: i + 1, name, defaultName: name, color: col(r, i + 1), defaultColor: col(r, i + 1), overridden: { name: false, dark: false, light: false } })));
const view = (version = 0, patch: Partial<LevelIdentityRow> & { role: 'PROVIDER' | 'CLIENT' | 'MARKETER'; level: number } = { role: 'PROVIDER', level: 0 }): LevelIdentityView => ({ version, nameMax: 24, rows: rows().map(r => (r.role === patch.role && r.level === patch.level ? { ...r, ...patch } : r)) });

function setup(extra: Record<string, unknown> = {}) {
	const api = { view: vi.fn(() => of({ success: true, data: view() })), save: vi.fn(), ...extra };
	const levels = { payload: () => payload(), load: vi.fn(() => of({ success: true, data: payload() })), level: (r: 'PROVIDER' | 'CLIENT' | 'MARKETER', n: number) => payload().roles[r].levels.find(l => l.level === n) ?? null };
	TestBed.configureTestingModule({ imports: [Accounts], providers: [{ provide: LevelIdentityAdminApi, useValue: api }, { provide: LevelsService, useValue: levels }] });
	const f = TestBed.createComponent(Accounts); f.detectChanges();
	const root = () => (f.nativeElement as HTMLElement).shadowRoot!;
	const q = (id: string) => root().querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
	const settle = async () => { for (let i = 0; i < 5; i++) { await f.whenStable(); await new Promise(r => setTimeout(r, 0)); f.detectChanges(); } };
	const type = async (id: string, v: string) => { const el = q(id) as HTMLInputElement; el.value = v; el.dispatchEvent(new Event('input')); await settle(); };
	return { f, c: f.componentInstance, api, levels, root, q, settle, type };
}

describe('«هوية المستويات والشارات»', () => {
	afterEach(() => { TestBed.resetTestingModule(); setRuntimeLevels({}); });

	it('the account-type buttons are real styled tabs (the design of the other tab bars), one marked active', async () => {
		const t = setup(); await t.settle();
		const tabs = [...t.root().querySelectorAll('.role-tab')] as HTMLElement[];
		expect(tabs.map(b => b.textContent!.trim())).toEqual(['مقدّم الخدمة', 'طالب الخدمة', 'المسوّق']);
		expect(tabs.map(b => b.classList.contains('active'))).toEqual([true, false, false]);
		expect(tabs.every(b => b.getAttribute('role') === 'tab')).toBe(true);
		t.q('level-role-MARKETER')!.click(); await t.settle();
		expect(t.q('level-role-MARKETER')!.classList.contains('active')).toBe(true); expect(t.q('level-role-PROVIDER')!.classList.contains('active')).toBe(false);
		expect((t.q('level-pick-1')!.querySelector('.level-n')!).textContent).toContain('المستوى 1');
	});
	it('editing the name and a colour enables save; only the changed fields are sent, for the selected level, bound to the version read', async () => {
		const saved = view(1, { role: 'PROVIDER', level: 2, name: 'منجز ذهبي', color: { dark: '#112233', light: col('PROVIDER', 2).light }, overridden: { name: true, dark: true, light: false } });
		const t = setup({ save: vi.fn(() => of({ success: true, data: saved })) }); await t.settle();
		t.q('level-pick-2')!.click(); await t.settle();
		expect((t.q('level-save') as HTMLButtonElement).disabled).toBe(true);
		await t.type('level-name-input', 'منجز ذهبي'); await t.type('level-dark-input', '#112233');
		expect((t.q('level-save') as HTMLButtonElement).disabled).toBe(false);
		t.q('level-save')!.click(); await t.settle();
		expect(t.api.save).toHaveBeenCalledTimes(1);
		expect(t.api.save).toHaveBeenCalledWith(0, [{ role: 'PROVIDER', level: 2, name: 'منجز ذهبي', dark: '#112233' }]);
		expect(t.q('level-notice-ok')!.textContent).toContain('لكل المستخدمين'); expect(t.levels.load).toHaveBeenCalled(); // the table the badges read is refreshed
		expect(t.q('level-pick-2')!.textContent).toContain('معدَّل');
		expect((t.q('level-name-input') as HTMLInputElement).value).toBe('منجز ذهبي');
	});
	it('invalid values are refused on the page before anything is sent: empty / duplicate / too long name, bad colour', async () => {
		const t = setup(); await t.settle(); t.q('level-pick-2')!.click(); await t.settle();
		await t.type('level-name-input', ''); expect(t.q('level-name-problem')!.textContent).toContain('مطلوب');
		await t.type('level-name-input', 'مبتدئ'); expect(t.q('level-name-problem')!.textContent).toContain('المستوى 1');
		await t.type('level-name-input', 'ا'.repeat(25)); expect(t.q('level-name-problem')!.textContent).toContain('أطول');
		await t.type('level-name-input', '<b>'); expect(t.q('level-name-problem')).toBeTruthy();
		await t.type('level-name-input', 'منجز'); await t.type('level-dark-input', 'red');
		expect((t.q('level-save') as HTMLButtonElement).disabled).toBe(true);
		expect(t.api.save).not.toHaveBeenCalled();
	});
	it('going back to the original value sends null (= default), and the reset links restore the originals', async () => {
		const t = setup(); await t.settle(); t.q('level-pick-1')!.click(); await t.settle();
		await t.type('level-name-input', 'اسم جديد'); t.q('level-name-reset')!.click(); await t.settle();
		expect((t.q('level-name-input') as HTMLInputElement).value).toBe('مبتدئ'); expect((t.q('level-save') as HTMLButtonElement).disabled).toBe(true);
		await t.type('level-light-input', '#010203'); expect(t.c.changes()).toEqual({ role: 'PROVIDER', level: 1, light: '#010203' });
		t.q('level-light-reset')!.click(); await t.settle(); expect(t.c.changes()).toBeNull();
	});
	it('a concurrent change (409) is shown with a reload, never overwritten; a server refusal shows its own reason and nothing changes', async () => {
		const conflict = new HttpErrorResponse({ status: 409, error: { message: 'عُدّلت هوية المستويات من جهة أخرى', code: 'LEVEL_IDENTITY_VERSION_CONFLICT' } });
		const t = setup({ save: vi.fn(() => throwError(() => conflict)) }); await t.settle(); t.q('level-pick-1')!.click(); await t.settle();
		await t.type('level-name-input', 'اسم'); t.q('level-save')!.click(); await t.settle();
		expect(t.q('level-notice-conflict')!.textContent).toContain('من جهة أخرى'); expect(t.q('level-conflict-reload')).toBeTruthy();
		t.api.view.mockClear(); t.q('level-conflict-reload')!.click(); await t.settle(); expect(t.api.view).toHaveBeenCalled();
		const refused = new HttpErrorResponse({ status: 400, error: { message: 'x', errors: [{ message: 'الاسم «مبتدئ» مستعمل' }] } });
		t.api.save.mockReturnValue(throwError(() => refused)); await t.type('level-name-input', 'اسم ثانٍ'); t.q('level-save')!.click(); await t.settle();
		expect(t.q('level-notice-error')!.textContent).toContain('مستعمل');
	});
	it('a read failure (403) says so and shows no editor', async () => {
		const t = setup({ view: vi.fn(() => throwError(() => new HttpErrorResponse({ status: 403 }))) }); await t.settle();
		expect(t.root().textContent).toContain('ليست لديك صلاحية'); expect(t.q('level-editor')).toBeNull();
	});
	it('pages that only have a level number or a provider title follow the published names and colours (runtime table), and fall back to the workbook when it is empty', () => {
		expect(providerLevelName(2)).toBe('منجز'); expect(providerLevelOfTitle('منجز')).toBe(2);
		setRuntimeLevels({ PROVIDER: [{ name: 'مبتدئ', color: col('PROVIDER', 1) }, { name: 'منجز ذهبي', color: { dark: '#112233', light: '#445566' } }] });
		expect(providerLevelName(2)).toBe('منجز ذهبي'); expect(providerLevelOfTitle('منجز ذهبي')).toBe(2); expect(providerLevelOfTitle('منجز')).toBe(2); expect(levelColor('PROVIDER', 2, 'dark')).toBe('#112233'); expect(levelColor('PROVIDER', 3, 'dark')).toBe(defaultLevelColor('PROVIDER', 3, 'dark'));
	});
});
