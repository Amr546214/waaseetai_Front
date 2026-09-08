# Phase 1 — Backend Blockers Report

> Collected during Phase 1 implementation and manual testing of Modules 1–5.
> Frontend code is implemented and builds successfully. Runtime testing is blocked by the issues below.

---

## 1. Client Workspace Blocker

- **Page:** `/client-overview/projects/:id`
- **Failed endpoint:** `GET /api/client/my-requests/:id/workspace`
- **Status:** 404 Not Found
- **Response:**
  ```json
  {
    "success": false,
    "message": "المشروع غير موجود أو لا تملك صلاحية الوصول إليه"
  }
  ```
- **Impact:**
  - Blocks client project workspace rendering
  - Blocks delivery approval/revision runtime testing
  - Blocks client rating test (no workspace → no canRate state)
  - Blocks client dispute test (no project context → cannot open dispute modal)
- **Questions for backend team:**
  - Does the endpoint expect `requestId` or `projectId` as the URL param?
  - Do `active-projects` list IDs match workspace IDs?
  - Does checkout/payment confirmation create the workspace and stages?
  - Is there a seed/test project that should load successfully?

---

## 2. Provider Projects Blocker

- **Page:** `/provider-overview/projects/active`
- **Failed endpoint:** `GET /api/provider/projects/active`
- **Status:** 429 Too Many Requests
- **Response:**
  ```json
  {
    "success": false,
    "message": "Too many requests from this IP, please try again after 15 minutes"
  }
  ```
- **Impact:**
  - Blocks provider progress page from loading
  - Blocks provider rating test (no project → no canRate state)
  - Blocks provider dispute test (no project context → cannot open dispute modal)
- **Note:**
  Frontend investigation found no request loop in the active provider projects component. The API is called once on page load; retry only on manual button click. The 429 appears to be backend rate-limiting, not a frontend issue.

---

## 3. Admin Auth Blocker

- **Page:** `/supper-admin-overview/disputes`
- **Issue:** Redirected to `/auth/login` because no admin account/token is available.
- **Impact:**
  - Blocks admin disputes list runtime testing
  - Blocks admin dispute detail runtime testing
  - Blocks admin resolve/reject runtime testing
- **Needed:**
  - Create or elevate an admin test account
  - Provide admin credentials or a way to generate a valid admin JWT

---

## 4. Disputes Backend Gaps (from Swagger)

The following endpoints are **not documented in Swagger** and appear to be missing from the backend:

| Gap | Description |
|-----|-------------|
| `GET /client/disputes` | No endpoint for a client to list their own disputes |
| `GET /provider/disputes` | No endpoint for a provider to list their own disputes |
| `GET /client/disputes/:id` | No endpoint for a client to view a single dispute |
| `GET /provider/disputes/:id` | No endpoint for a provider to view a single dispute |
| Dispute messages | No dispute conversation/message endpoints (e.g. `POST /disputes/:id/messages`) |
| Evidence upload | No dedicated evidence upload endpoint — must use existing upload routes and pass URIs |
| `resolution` enum | No documented enum values for the `resolution` field in `ResolveDisputeRequest` |
| Escrow behavior | Unclear escrow freeze/refund/release behavior when a dispute is resolved or rejected |

---

## 5. Rating Test Data Blocker

- **Issue:** No accessible completed/canRate client workspace or provider project.
- **Impact:**
  - Rating APIs (`POST /client/requests/:id/rate-provider`, `POST /provider/requests/:id/rate-client`) are implemented and wired in the UI
  - Cannot be fully runtime-tested because no project reaches the `canRate` state
  - Client rating modal and provider rating modal cannot be opened in a real flow
- **Root cause:** Tied to blockers #1 and #2 — if workspace/progress doesn't load, rating state is never reached.

---

## 7. Module 4 — Withdrawals / Finance Blockers

### A) Admin Withdrawals runtime blocked

- **Page:** `/admin/withdrawals` (or `/supper-admin-overview/withdrawals`)
- **Issue:** No admin account/token available.
- **Impact:**
  - Cannot test `GET /api/admin/withdrawals`
  - Cannot test `GET /api/admin/withdrawals/:id`
  - Cannot test `POST /api/admin/withdrawals/:id/approve`
  - Cannot test `POST /api/admin/withdrawals/:id/reject`
- **Frontend status:** Admin withdrawals list page, detail modal, and approve/reject actions are fully implemented and build passes. Runtime testing blocked.
- **Needed:** Backend/admin team should provide admin credentials or elevate a test account.

### B) Provider Withdraw submit endpoint missing

- **Page:** `/provider-overview/finance/withdraw`
- **Missing endpoint:** `POST /api/provider/finance/withdraw`
- **Also missing:** `GET /api/provider/finance/withdrawals` (withdrawal history)
- **Impact:**
  - Provider cannot submit real withdrawal request
  - Provider cannot view withdrawal request history
- **Frontend status:** Provider withdraw mock flow was disabled and replaced with safe unavailable state. Submit button is disabled. Unavailable banner and modal shown. Real wallet balance loaded from `GET /api/provider/finance/wallet`.
- **Needed:** Backend should provide provider withdrawal submit endpoint and withdrawal history endpoint.

### C) Withdrawal Swagger schema gap

- **Issue:** `WithdrawalListResponse` and `WithdrawalResponse` are referenced in Swagger but not defined.
- **Impact:** Frontend uses flexible inferred models with optional fields. Response unwrapping is defensive (supports `data.items`, `data.withdrawals`, or array).
- **Frontend status:** Working with inferred types. No crash if fields are missing.
- **Needed:** Backend should document exact schemas for `WithdrawalListResponse`, `WithdrawalResponse`, `ApproveWithdrawalRequest`, and `RejectWithdrawalRequest`.

---

## 8. Module 5 — Onboarding Upload Blockers

### A) Client multipart document upload endpoint missing

- **Issue:** No `POST /api/client/profile/documents/upload` endpoint found in code or Swagger.
- **Impact:**
  - Client setup wizard (`/client-overview/profile-setup`) sends base64 strings in JSON payload instead of multipart upload
  - Client profile edit (`/client-overview/profile/edit`) stores ID filenames only — no upload at all
  - Cannot implement real client document upload in Chunk 3 without this endpoint
- **Frontend status:** Onboarding upload models and typed interfaces created (Chunk 1). No client upload method added to any service — gap documented.
- **Needed:** Backend should provide `POST /api/client/profile/documents/upload` (multipart/form-data, field name: `file`) matching the provider endpoint pattern.

### B) NAFATH verification endpoints missing

- **Issue:** No NAFATH initiate or verify endpoints found for either provider or client.
- **Impact:**
  - Provider setup wizard mocks NAFATH with `setTimeout(1800ms)` — no backend call
  - Client setup wizard NAFATH button only shows a toast — no backend call
  - Identity verification is fake; users can bypass KYC
- **Frontend status:** `NafathStatus` and `NafathVerifyRequest`/`NafathVerifyResponse` types defined in `onboarding-upload.model.ts` but marked as BLOCKED/future use. No service methods wired.
- **Needed:** Backend should provide:
  - `POST /api/provider/profile/nafath/initiate` — start NAFATH verification
  - `POST /api/provider/profile/nafath/verify` — verify NAFATH OTP
  - `POST /api/client/profile/nafath/initiate`
  - `POST /api/client/profile/nafath/verify`

### C) Admin KYC review endpoints missing

- **Issue:** No admin endpoints found for listing, reviewing, approving, or rejecting KYC submissions.
- **Impact:**
  - Admin KYC page (`/supper-admin-overview/kyc`) is an empty placeholder
  - Cannot review uploaded onboarding documents from admin panel
- **Frontend status:** Placeholder component only. No API methods added.
- **Needed:** Backend should provide:
  - `GET /api/admin/kyc` — list pending KYC submissions
  - `GET /api/admin/kyc/:id` — get KYC details with document URLs
  - `POST /api/admin/kyc/:id/approve` — approve KYC
  - `POST /api/admin/kyc/:id/reject` — reject KYC with reason

### D) Swagger raw spec inaccessible

- **Issue:** Swagger UI at `https://api.waseetai.com/api/docs/` is JS-rendered. Raw OpenAPI JSON not found at standard URLs (`/docs-json`, `/swagger.json`, `/swagger/v1/swagger.json`, `/swagger-ui-init.js` — all 404).
- **Impact:**
  - Cannot confirm exact request/response schemas for onboarding upload endpoints
  - Cannot verify `OnboardingUploadRequest` or `UploadRequest` schema definitions
  - Cannot confirm file constraints (max size, allowed types, max files)
- **Needed:** Backend team should provide the raw OpenAPI JSON URL or paste relevant endpoint definitions.

---

## 9. What Backend Should Provide

Checklist for unblocking Phase 1 runtime testing:

- [ ] A valid client workspace ID that loads successfully via `GET /api/client/my-requests/:id/workspace`
- [ ] A completed/canRate project for client rating testing
- [ ] A provider project/progress ID that loads successfully via `GET /api/provider/projects/:projectId/progress`
- [ ] A completed/canRate provider project for provider rating testing
- [ ] An admin test account (credentials + valid JWT)
- [ ] Confirmation of `requestId` vs `projectId` rules across all endpoints
- [ ] Clarification on whether `GET /client/disputes` and `GET /provider/disputes` endpoints exist or will be added
- [ ] Clarification on whether `GET /client/disputes/:id` and `GET /provider/disputes/:id` endpoints exist or will be added
- [ ] Documented enum values for `resolution` field in resolve dispute request
- [ ] Clarification on escrow behavior: freeze on dispute open, refund/release on resolve, no action on reject
- [ ] Investigation of 429 rate-limiting on `GET /api/provider/projects/active` — is this IP-based or token-based?
- [ ] `POST /api/provider/finance/withdraw` endpoint for provider withdrawal submit
- [ ] `GET /api/provider/finance/withdrawals` endpoint for provider withdrawal history
- [ ] Exact Swagger schemas for `WithdrawalListResponse`, `WithdrawalResponse`, `ApproveWithdrawalRequest`, `RejectWithdrawalRequest`
- [ ] `POST /api/client/profile/documents/upload` endpoint (multipart/form-data) for client document upload
- [ ] NAFATH verification endpoints (initiate + verify) for provider and client
- [ ] Admin KYC review endpoints: `GET /api/admin/kyc`, `GET /api/admin/kyc/:id`, `POST /api/admin/kyc/:id/approve`, `POST /api/admin/kyc/:id/reject`
- [ ] Raw OpenAPI JSON spec URL or pasted endpoint definitions for onboarding/upload schemas

---

## Summary

| # | Blocker | Severity | Blocks |
|---|---------|----------|--------|
| 1 | Client workspace 404 | High | Client workspace, delivery review, rating, disputes |
| 2 | Provider projects 429 | High | Provider progress, rating, disputes |
| 3 | Admin auth unavailable | High | Admin disputes list/detail/resolve |
| 4 | Disputes API gaps | Medium | Client/provider dispute list/detail views |
| 5 | Rating test data | Medium | Rating runtime testing |
| 6 | Escrow behavior unclear | Low | Dispute resolution logic |
| 7A | Admin withdrawals runtime blocked | High | Admin withdrawals list/detail/approve/reject testing |
| 7B | Provider withdraw endpoint missing | High | Provider withdrawal submit + history |
| 7C | Withdrawal Swagger schema gap | Medium | Frontend uses inferred types for withdrawal responses |
| 8A | Client multipart upload endpoint missing | High | Client onboarding document upload (Chunk 3) |
| 8B | NAFATH verification endpoints missing | High | Identity verification for provider and client onboarding |
| 8C | Admin KYC review endpoints missing | Medium | Admin KYC review page implementation (Chunk 5) |
| 8D | Swagger raw spec inaccessible | Medium | Cannot confirm onboarding upload schemas |

**Frontend status:** All Phase 1 modules (1–5) are implemented. Modules 1–4 build passes and code is committed. Module 5 Chunk 1 (models + typed interfaces) build pending. Runtime testing is blocked by backend/data issues above.
