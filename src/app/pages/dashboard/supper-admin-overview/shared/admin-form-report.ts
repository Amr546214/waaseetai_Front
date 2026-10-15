import { clearAllInvalid } from '../../../../shared/forms/form-error-focus';
import { ClientBackendOptions, handleClientError } from '../../clients-overview/client-form-report';

/**
 * Admin console entry point to the shared field-error helpers (ws-select aware). Admin forms use the same pattern as the
 * client/provider forms: hand-validated problems -> reportAdminProblems (message under the field, red border, aria-invalid,
 * role=alert, focus below the sticky header); a failed request -> handleAdminError (400/422 field names go under their
 * fields, every other failure gets the honest generic Arabic message through `show`, never a field error).
 */
export { reportClientProblems as reportAdminProblems, reportClientBackend as reportAdminBackend } from '../../clients-overview/client-form-report';
export { SubmitGuard, clearAllInvalid } from '../../../../shared/forms/form-error-focus';

/** handleClientError, after wiping the marks of the previous attempt (a stale red field must not survive a different failure). */
export function handleAdminError(root: ParentNode | null | undefined, err: unknown, opts: ClientBackendOptions, show: (message: string) => void): void {
	clearAllInvalid(root);
	handleClientError(root, err, opts, show);
}
