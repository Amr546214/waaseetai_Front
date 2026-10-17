import { mapHttpError, MappedHttpError } from '../../../core/forms/http-error';
import { clearInvalid, FieldProblem, reportBackendError, reportProblems, ReportOptions, resolveField } from '../../../shared/forms/form-error-focus';

/**
 * Glue between the shared field-error helper (shared/forms/form-error-focus) and the client pages.
 * A <ws-select id="x"> is not focusable itself, so its trigger button gets the id "x-trigger" and the select host carries
 * data-field-wrap (the message goes right under the whole select); choosing an option clears the mark again.
 */
export function triggerId(root: ParentNode, id: string): string {
	const host = root.querySelector<HTMLElement>(`ws-select[id="${id}"]`);
	const btn = host?.querySelector<HTMLElement>('button');
	if (!host || !btn) return id;
	if (!btn.id) btn.id = `${id}-trigger`;
	if (!host.hasAttribute('data-field-wrap')) {
		host.setAttribute('data-field-wrap', '');
		host.addEventListener('click', (e) => {
			if ((e.target as HTMLElement | null)?.closest?.('[data-testid="ws-select-option"]')) setTimeout(() => clearInvalid(btn), 0);
		});
	}
	return btn.id;
}

/** reportProblems for signal / hand-validated forms (ws-select aware). Messages are role=alert under the field. */
export function reportClientProblems(root: ParentNode | null | undefined, problems: FieldProblem[], opts: ReportOptions = {}) {
	const mapped = root ? problems.map((p) => (p.field && !p.el ? { ...p, field: triggerId(root, p.field) } : p)) : problems;
	return reportProblems(root, mapped, opts);
}

/** mapHttpError's message; a status-less failure that still carries an Arabic server message (a wrapped/rethrown error) keeps that message. */
function genericMessage(err: unknown, mapped: MappedHttpError): string {
	const body = (err as any)?.error?.message;
	if (mapped.kind === 'network' && typeof body === 'string' && /[؀-ۿ]/.test(body)) return body;
	return mapped.message;
}

export interface ClientBackendOptions extends ReportOptions {
	/** server field name -> control id/name */
	resolve?: Record<string, string>;
	/** server field name -> wizard step */
	steps?: Record<string, string | number>;
	fallback?: string;
}

/**
 * Failed request -> either the message under the right field (400/422 with field names that match) or the honest generic
 * message to show in a banner/toast. `generic` is '' when the whole explanation is already on the fields.
 */
export async function reportClientBackend(root: ParentNode | null | undefined, err: unknown, opts: ClientBackendOptions = {}): Promise<{ mapped: MappedHttpError; handled: boolean; generic: string }> {
	const mapped = mapHttpError(err, { fallback: opts.fallback });
	const resolve: Record<string, string> = {};
	for (const [k, v] of Object.entries(opts.resolve ?? {})) resolve[k] = root ? triggerId(root, v) : v;
	const res = await reportBackendError(root, mapped, { ...opts, resolve });
	if (!res.validation) return { mapped, handled: false, generic: genericMessage(err, mapped) };
	const rest = Object.values(res.unresolved);
	if (res.handled && !rest.length) return { mapped, handled: true, generic: '' };
	return { mapped, handled: res.handled, generic: rest.length ? rest.join(' - ') : mapped.message };
}

/** True when the failure is a 400/422 that names fields (only then is anything put on a control; everything else is synchronous and generic). */
export function hasFieldErrors(err: unknown): boolean {
	const m = mapHttpError(err);
	return m.kind === 'backend-validation' && Object.keys(m.fieldErrors ?? {}).length > 0;
}

/**
 * Failure handler: a field-named 400/422 goes under its fields (the `show` callback only gets what matched no field);
 * every other failure calls `show` immediately with the honest generic Arabic message.
 */
export function handleClientError(root: ParentNode | null | undefined, err: unknown, opts: ClientBackendOptions, show: (message: string) => void): void {
	if (!hasFieldErrors(err)) { show(genericMessage(err, mapHttpError(err, { fallback: opts.fallback }))); return; }
	void reportClientBackend(root, err, opts).then((r) => { if (r.generic) show(r.generic); });
}

export { resolveField };
