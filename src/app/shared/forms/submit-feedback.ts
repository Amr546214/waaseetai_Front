import { MappedHttpError } from '../../core/forms/http-error';
import { reportBackendError, ReportOptions } from './form-error-focus';

/**
 * What to show in the generic banner after a failed request, once the field errors were put on their controls.
 *  - 400/422 whose fields matched controls -> '' (the message is under the field; nothing generic is invented)
 *  - 400/422 with fields that matched nothing -> those messages joined, so nothing is dropped
 *  - network / 429 / 5xx / 401 / 403 / 409 / anything else -> mapped.message (honest, never a field error)
 */
export async function backendBannerMessage(
	root: ParentNode | null | undefined,
	mapped: MappedHttpError,
	opts: ReportOptions & { resolve?: Record<string, string>; steps?: Record<string, string | number>; labels?: Record<string, string> } = {},
): Promise<string> {
	const res = await reportBackendError(root, mapped, opts);
	if (!res.validation) return mapped.message;
	const rest = Object.values(res.unresolved);
	if (res.handled && !rest.length) return '';
	if (rest.length) return rest.join(' - ');
	return mapped.message;
}

/**
 * Synchronous half: the honest generic message when the failure is NOT a field-named 400/422 (network, 429, 5xx, 401, 403,
 * 409, 400 without fields), otherwise null (then use backendBannerMessage, which has to wait for the step/render).
 * Callers set their banner / reset their busy flag in the same tick for the generic case.
 */
export function genericBanner(mapped: MappedHttpError): string | null {
	if (mapped.kind === 'backend-validation' && Object.keys(mapped.fieldErrors ?? {}).length > 0) return null;
	return mapped.message;
}
