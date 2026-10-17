import { MappedHttpError, mapHttpError } from '../../core/forms/http-error';
import { reportBackendError, BackendErrorResult, ReportOptions } from './form-error-focus';

/**
 * The failed-request half of every form submit, in one call:
 *  - 400/422 that names fields -> the message goes under the matching control (red, aria-invalid, role=alert, focus);
 *  - everything else (network, 429, 5xx, 401, 403, 409, 400 without fields) -> `onGeneric(message)` with the honest
 *    Arabic message, so the caller shows it in its banner / toast. It is NEVER turned into a field error.
 */
export async function handleSubmitError(
	root: ParentNode | null | undefined,
	err: unknown,
	opts: ReportOptions & {
		fallback?: string;
		resolve?: Record<string, string>;
		steps?: Record<string, string | number>;
		unauthorizedIs?: 'session' | 'credentials';
		onGeneric: (message: string, mapped: MappedHttpError) => void;
	},
): Promise<{ mapped: MappedHttpError; result: BackendErrorResult }> {
	const mapped = mapHttpError(err, { fallback: opts.fallback, unauthorizedIs: opts.unauthorizedIs });
	const result = await reportBackendError(root, mapped, opts);
	if (!result.handled) opts.onGeneric(mapped.message, mapped);
	return { mapped, result };
}
