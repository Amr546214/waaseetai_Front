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
	it('the template swaps the AI card for the closure card on closed projects (no AI mark, no analyze button inside it)', () => {
		const html = readFileSync(join(dir, 'project-details.html'), 'utf8');
		const closed = html.slice(html.indexOf('@if (isClosedProject(data))'), html.indexOf('} @else {', html.indexOf('@if (isClosedProject(data))')));
		expect(closed).toContain('data-testid="pd-closure-card"'); expect(closed).not.toContain('#i-ai'); expect(closed).not.toContain('analyzeProjectHealth');
	});
});
