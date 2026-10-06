import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Source scan: wording that promised features ("soon"), claimed an AI review that no backend step performs, or showed a rank/percentage
// that no response provides must not come back. Comment lines are ignored; specs are not scanned.
function sources(dir: string): { file: string; lines: string[] }[] {
	const out: { file: string; lines: string[] }[] = [];
	for (const e of readdirSync(dir, { withFileTypes: true })) {
		const p = join(dir, e.name);
		if (e.isDirectory()) out.push(...sources(p));
		else if (/\.(html|ts)$/.test(e.name) && !/\.spec\.ts$/.test(e.name)) {
			out.push({ file: p, lines: readFileSync(p, 'utf-8').split('\n') });
		}
	}
	return out;
}
const all = sources(__dirname);
const code = (l: string) => !/^\s*(\/\/|\*|\/\*|<!--)/.test(l);
const hits = (re: RegExp, allow?: RegExp) =>
	all.flatMap(f => f.lines.map((l, i) => ({ f: f.file.replace(__dirname, ''), n: i + 1, l })).filter(x => code(x.l) && re.test(x.l) && !(allow && allow.test(x.l)))).map(x => `${x.f}:${x.n}`);

describe('no unsourced claims in the source', () => {
	it('no "soon" promises (an expiry state such as "تنتهي قريباً" is a status, not a promise, and stays)', () => {
		expect(hits(/(?<!ت)قريباً|(?<!ت)قريبا(?![ء-ي])|قريبًا|سيتم تفعيله|سيُفعَّل|ستتوفر|coming soon/i, /تنتهي قريباً|ينتهي قريباً|المنتهية قريباً/)).toEqual([]);
	});
	it('no "AI review" wording for steps/statuses that no model performs', () => {
		expect(hits(/مراجعة الذكاء|يفحصه الذكاء|فحص الذكاء جار|يتحقق الذكاء من البيانات|تحقق الذكاء من/)).toEqual([]);
	});
	it('the specialty wizard shows no rank/percentage that no response provides', () => {
		const wiz = all.find(f => f.file.endsWith('specialties/specialties.html'))!;
		const txt = wiz.lines.join('\n');
		expect(txt).not.toContain('نماذجك تتفوق');
		expect(txt).not.toMatch(/86\s*%/);
		expect(txt).not.toContain('مؤشر التميز المهني');
	});

	it('no AI badge/claim without a real model output behind it (login, home, curated, wallets, disputes, review, amendments, admin pages)', () => {
		const banned = [
			'حماية متقدمة بالذكاء الاصطناعي', 'دعم ذكي في كل خطوة', 'AI يقترح والانسان يقرر', 'AI Forecast', 'AI Compliance', 'fcm-ai-lbl">AI Tier', 'AI Tier Predict',
			'تنبيهات AI', 'توقعات الشهر القادم (AI)', 'قبول الكل الآمن (AI)', 'مُدارة بالذكاء الاصطناعي', 'يراقب إنفاق', 'يراقب أرباح', 'جودة AI ',
			'ai-banner-label">تحليل الذكاء الاصطناعي', 'ai-banner-label">فحص الذكاء الاصطناعي', 'وفق AI', 'تحليل AI:', 'class="txt-ai"><use href="#i-ai"></use></svg>رؤى الذكاء الاصطناعي', 'حركات AI هذا الشهر', 'اجتاز فحص الذكاء',
			'توصية الذكاء', 'تنبيه الذكاء', "'تقييم الذكاء:'", 'ai-title">تقييم الذكاء', 'AI يرشدك', 'يفحص الذكاء أثر', 'AI تحقّق من مطابقة التسليم', 'وسيط AI، فحص جودة التسليم',
		];
		const found = banned.flatMap(b => all.flatMap(f => f.lines.map((l, i) => ({ f: f.file.replace(__dirname, ''), n: i + 1, l })).filter(x => code(x.l) && x.l.includes(b)).map(x => `${b} @ ${x.f}:${x.n}`)));
		expect(found).toEqual([]);
	});
	it('the confidence percentage of change requests (a fixed backend constant) is not rendered, and the dead aiInsight block is gone', () => {
		const t = all.filter(f => /requests?\.html$|profile-requests\.html$/.test(f.file)).map(f => f.lines.join('\n')).join('\n');
		expect(t).not.toMatch(/ثقة\s*\{\{\s*req\.aiConfidence/);
		expect(t).not.toContain('req.aiConfidenceScore');
		const co = all.find(f => f.file.endsWith('client-overview.component.html'))!.lines.join('\n');
		expect(co).not.toContain('aiInsight');
	});
});
