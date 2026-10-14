import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Static guards for the dispute freeze / resolution work: the reason is shown on both project pages, approve actions are
// disabled (not removed), resolution codes never reach the user raw, and the admin screen no longer implies a fake money split.
const read = (p: string) => readFileSync('src/app/' + p, 'utf8');

describe('dispute freeze - static guards', () => {
	it('provider progress page shows the freeze reason with a link to the dispute, and keeps delivery/chat untouched', () => {
		const html = read('pages/dashboard/provider-overview/projects/active/progress/progress.html');
		expect(html).toContain('data-testid="provider-freeze-banner"');
		expect(html).toContain('disputeFreeze.reason');
		expect(html).toContain('/provider-overview/disputes/');
		expect(html).toContain('يمكنك متابعة التسليم والمحادثة ورفع الأدلة');
		expect(html).not.toMatch(/canUploadDelivery[^}]*disputeFreeze/);
	});

	it('client review list marks frozen items; the client review page keeps revision and chat outside the freeze', () => {
		expect(read('pages/dashboard/clients-overview/project/review-list/review-list.html')).toContain('item.frozen');
		const html = read('pages/dashboard/clients-overview/project/delivery-review/delivery-review.html');
		expect(html).toMatch(/data-testid="dr-approve"[^>]*\[disabled\]="saving\(\) \|\| !!freezeReason\(\)"/);
		expect(html).toMatch(/data-testid="dr-revision-toggle"[^>]*\[disabled\]="saving\(\)"/);
	});

	it('every place that prints a stored resolution goes through the Arabic label helper', () => {
		expect(read('pages/dashboard/clients-overview/disputes/disputes.html')).toContain('resolutionText(x)');
		expect(read('pages/dashboard/clients-overview/disputes/disputes.html')).not.toMatch(/\{\{\s*x\.resolution\s*\}\}/);
		expect(read('pages/dashboard/supper-admin-overview/sa-disputes/sa-dispute-detail/sa-dispute-detail.html')).not.toMatch(/\{\{\s*d\.resolution\s*\}\}/);
		for (const f of ['pages/dashboard/provider-overview/disputes/disputes.mapper.ts', 'pages/dashboard/clients-overview/disputes/disputes.ts']) {
			const ts = read(f);
			expect(ts, f).toContain('disputeResolutionText');
			expect(ts, f).not.toMatch(/d\.resolutionNote \|\| d\.resolution/);
		}
	});

	it('admin screen: no split slider / quick-verdict that only looked financial; the two kinds are separate forms', () => {
		const html = read('pages/dashboard/supper-admin-overview/sa-disputes/sa-dispute-detail/sa-dispute-detail.html');
		expect(html).not.toContain('dp-split-slider');
		expect(html).not.toContain('applyVerdict');
		expect(html).toContain('data-testid="financial-form"');
		expect(html).toContain('data-testid="fin-confirm-check"');
		const ts = read('pages/dashboard/supper-admin-overview/sa-disputes/sa-dispute-detail/sa-dispute-detail.ts');
		expect(ts).not.toMatch(/resolutionPresets = \[[^\]]*(REFUND_CLIENT|RELEASE|PARTIAL)/);
	});

	it('the financial API call sends the explicit-contract fields and goes to the dedicated endpoint', () => {
		const svc = read('core/services/dispute-api.service.ts');
		expect(svc).toContain('/admin/disputes/${id}/resolve-financial');
		const model = read('core/models/dispute.model.ts');
		for (const f of ['outcome', 'refundToClient', 'releaseToProvider', 'expectedHeldAmount', 'confirm: true']) expect(model).toContain(f);
	});
});
