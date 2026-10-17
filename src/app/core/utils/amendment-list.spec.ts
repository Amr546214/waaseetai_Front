import { sortAmendments, upsertAmendment } from './amendment-list';

describe('amendment list helpers', () => {
  const a = { id: 'a', createdAt: '2026-10-01T10:00:00Z' };
  const b = { id: 'b', createdAt: '2026-10-02T10:00:00Z' };
  const c = { id: 'c', createdAt: '2026-10-02T10:00:00Z' };

  it('orders newest first by creation time with a deterministic id tie-break', () => {
    expect(sortAmendments([a, b, c]).map(x => x.id)).toEqual(['c', 'b', 'a']);
    expect(sortAmendments([c, a, b]).map(x => x.id)).toEqual(['c', 'b', 'a']);
  });

  it('puts a just-saved request first without a refresh and never doubles it when it arrives again', () => {
    const created = { id: 'n', createdAt: '2026-10-03T10:00:00Z' };
    const once = upsertAmendment([a, b], created);
    expect(once.map(x => x.id)).toEqual(['n', 'b', 'a']);
    const twice = upsertAmendment(once, { ...created, status: 'APPROVED' } as any);
    expect(twice.length).toBe(3);
    expect((twice[0] as any).status).toBe('APPROVED');
  });

  it('a later status change does not move an older request above a newer one', () => {
    const updated = { ...a, status: 'APPROVED', updatedAt: '2026-10-09T00:00:00Z' };
    expect(upsertAmendment([b], updated).map(x => x.id)).toEqual(['b', 'a']);
  });
});
