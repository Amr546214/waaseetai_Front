import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ProjectDetails } from './project-details';

// An ended project (completed / cancelled / closed by a settlement) shows a factual closure summary, not "no insights yet" predictions.
const dir = join(process.cwd(), 'src/app/pages/dashboard/clients-overview/project/project-details');
describe('project details: closed project card', () => {
	const c = Object.create(ProjectDetails.prototype) as ProjectDetails;
	(c as any).formatNumber = (v: number) => String(v);
	const settled = { closedBySettlement: true, status: 'CANCELLED', statusLabel: 'إلغاء بالتراضي — تمت التسوية وأُغلق العقد', stages: [{ status: 'completed' }, { status: 'completed' }, { status: 'completed' }, { status: 'pending' }, { status: 'pending' }], financial: { settlement: { refundToClient: 75, releaseToProvider: 0 }, releasedByStageApprovals: 625 }, escrowTotal: 700, escrowReleased: 625 };

	it('settled / completed / cancelled are closed; an active project is not', () => {
		expect(c.isClosedProject(settled)).toBe(true);
		expect(c.isClosedProject({ status: 'COMPLETED' })).toBe(true);
		expect(c.isClosedProject({ status: 'cancelled' })).toBe(true);
		expect(c.isClosedProject({ status: 'IN_PROGRESS', stages: [] })).toBe(false);
	});
	it('the summary states only real figures: stages done, money released / refunded, the status label', () => {
		const lines = c.closureSummary(settled).join(' | ');
		expect(lines).toContain('3 من 5 مراحل اكتملت واعتُمدت'); expect(lines).toContain('625'); expect(lines).toContain('75'); expect(lines).toContain('إلغاء بالتراضي');
	});
	it('without a settlement it reports released of total from the escrow numbers', () => {
		expect(c.closureSummary({ status: 'COMPLETED', stages: [{ status: 'completed' }], escrowTotal: 300, escrowReleased: 300 }).join(' | ')).toContain('أُفرج 300 $ من أصل 300 $');
	});
	it('the AI insights card is the one card for every project: AI icon, title رؤى الذكاء, predictions hidden once closed, facts only as the fallback when the AI call failed', () => {
		const html = readFileSync(join(dir, 'project-details.html'), 'utf8');
		expect(html).not.toContain('pd-closure-card');
		const card = html.slice(html.indexOf('<div class="lc-ai">'), html.indexOf('data-testid="pd-escrow-sum"'));
		expect(card).toContain('#i-ai'); expect(card).toContain('رؤى الذكاء');
		expect(card).toContain('@if (!isClosedProject(data)) {<span class="conf">'); expect(card).toContain('@if (!isClosedProject(data)) {<div class="lc-aim">');
		expect(card).toMatch(/تعذر إجراء تحليل[\s\S]{0,260}pd-closure-fact/);
		expect(card).toContain('analyzeProjectHealth()');
	});
	it('the analysis starts by itself once per project when the workspace loads', () => {
		const ts = readFileSync(join(dir, 'project-details.ts'), 'utf8');
		expect(ts).toMatch(/this\.project\.set\(response\.data\);[\s\S]{0,400}this\.healthRequestedFor !== this\.projectId[\s\S]{0,120}this\.analyzeProjectHealth\(\)/);
	});
});
