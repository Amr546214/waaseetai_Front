/**
 * Admin console entry point to the shared field-error helpers (ws-select aware). Admin forms use the same pattern as the
 * client/provider forms: hand-validated problems -> reportAdminProblems (message under the field, red border, aria-invalid,
 * role=alert, focus below the sticky header); a failed request -> handleAdminError (400/422 field names go under their
 * fields, every other failure gets the honest generic Arabic message through `show`, never a field error).
 */
export { reportClientProblems as reportAdminProblems, handleClientError as handleAdminError, reportClientBackend as reportAdminBackend } from '../../clients-overview/client-form-report';
export { SubmitGuard, clearAllInvalid } from '../../../../shared/forms/form-error-focus';
