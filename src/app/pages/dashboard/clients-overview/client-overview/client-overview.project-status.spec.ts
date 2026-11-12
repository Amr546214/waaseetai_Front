import { ClientOverviewComponent } from './client-overview.component';

// Found by running the REAL client UI against the REAL isolated API: a consensually cancelled project showed «متنازع عليه» and an administratively released one showed «مكتمل».
const label = (p: { status?: string; closureKind?: string | null }) => ClientOverviewComponent.prototype.projectStatusLabel.call({}, p);

describe('client dashboard: project card wording from the real stored state', () => {
  it('a cancelled project is «ملغى», never «متنازع عليه»', () => { expect(label({ status: 'CANCELLED' })).toBe('ملغى'); expect(label({ status: 'CANCELLED', closureKind: 'CONSENSUAL_CANCEL' })).toBe('ملغى'); });
  it('a project closed by an administrative release is «أُغلق بصرف إداري», not «مكتمل»; a delivered one stays «مكتمل»', () => {
    expect(label({ status: 'COMPLETED', closureKind: 'ADMIN_RELEASE' })).toBe('أُغلق بصرف إداري');
    expect(label({ status: 'COMPLETED', closureKind: null })).toBe('مكتمل'); expect(label({ status: 'COMPLETED' })).toBe('مكتمل');
  });
  it('«متنازع عليه» only for a really DISPUTED project; an unknown status is never read as a dispute', () => {
    expect(label({ status: 'DISPUTED' })).toBe('متنازع عليه'); expect(label({ status: 'SOMETHING_NEW' })).toBe('قيد المعالجة'); expect(label({})).toBe('قيد المعالجة');
    expect(label({ status: 'OPEN' })).toBe('مفتوح للعروض'); expect(label({ status: 'IN_PROGRESS' })).toBe('قيد التنفيذ'); expect(label({ status: 'PENDING_SIGNATURE' })).toBe('بانتظار التوقيع');
  });
});
