/**
 * Amendment request lists: newest first by the REAL creation time, a deterministic tie-break by id (the server orders the same way), and an
 * id-keyed upsert so a row that arrives twice (success response + socket event + reload) is shown once.
 */
export interface AmendmentLike { id: string; createdAt?: string | Date | null }

const time = (a: AmendmentLike) => (a.createdAt ? new Date(a.createdAt).getTime() : 0);

export function sortAmendments<T extends AmendmentLike>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => {
    // rows without a creation time (never from the server) keep their given order
    if (!a.createdAt && !b.createdAt) return 0;
    return (time(b) - time(a)) || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);
  });
}

export function upsertAmendment<T extends AmendmentLike>(list: readonly T[], row: T | null | undefined): T[] {
  if (!row?.id) return sortAmendments(list);
  return sortAmendments([...list.filter(a => a.id !== row.id), row]);
}
