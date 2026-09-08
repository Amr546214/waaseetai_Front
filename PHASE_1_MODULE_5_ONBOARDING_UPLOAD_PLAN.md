# Phase 1 — Module 5: Onboarding Upload / رفع ملفات استكمال البيانات

## Investigation & Implementation Plan (Chunk 0)

---

## 1. Existing Frontend Code Found

### A) Provider Profile Data Page (REAL upload — already working)

- **Route:** `/provider-overview/profile/data`
- **Component:** `src/app/pages/dashboard/provider-overview/profile/data/data.ts`
- **Template:** `src/app/pages/dashboard/provider-overview/profile/data/data.html`
- **Service:** `src/app/core/services/provider-profile.service.ts`
- **Upload method:** `ProviderProfileService.uploadDocument(file: File)` → `POST /api/provider/profile/documents/upload` (multipart/form-data, field name: `file`)
- **Features:**
  - Real file upload with `HttpEvent` progress tracking
  - Documents: ID (front), certificates, commercial registration, VAT certificate
  - File validation: max 10MB, allowed types: PDF, JPG, PNG
  - Upload progress bar, preview (image or PDF icon), remove/replace actions
  - Sensitive change flow: `initiateSensitiveChange('DOCUMENTS', changes)` → OTP modal → `verifySensitiveChange(requestId, code)`
  - Loads existing document URLs from profile (`profile.user.idDocumentUrl`, `profile.certUrls`, etc.)
  - Completion percentage calculation includes documents
- **Status:** ✅ Real backend upload. No mock behavior detected.

### B) Provider Profile Setup Wizard (MOCK upload — needs fix)

- **Route:** `/provider-overview/profile/setup`
- **Component:** `src/app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts`
- **Template:** `src/app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html`
- **Service:** `ProfileApiService.saveProviderProfileSetup()` → `POST /api/provider/profile/setup`
- **Features:**
  - 7-step wizard: prof data → specialties → bank → docs → portfolio → review → test
  - Step 4 (docs): file selection for frontId, backId, certs
  - `onFileSelected()` only stores **file names** as strings — **NO actual file upload** to backend
  - NAFATH verification is **mocked** with `setTimeout(1800ms)` — no backend call
  - Portfolio items (step 5): file names stored locally only, no upload
  - Final submit sends file names (not URLs) in the payload
- **Status:** ⚠️ MOCK upload behavior. Files are never sent to backend. NAFATH is fake.

### C) Client Profile Setup Wizard (MOCK upload — needs fix)

- **Route:** `/client-overview/profile-setup`
- **Component:** `src/app/pages/dashboard/clients-overview/profile/profile-setup/profile-setup.ts`
- **Template:** `src/app/pages/dashboard/clients-overview/profile/profile-setup/profile-setup.html`
- **Service:** `ProfileApiService.saveClientProfileSetup()` → `POST /api/client/profile/setup`
- **Features:**
  - 5-step wizard: details → identity → bank → documents → review
  - Step 2 (identity): file selection for frontId, backId
  - Step 4 (documents): supporting docs upload
  - `onFileSelected()` converts files to **base64 strings** via `FileReader.readAsDataURL()` — stored in form, sent as base64 in JSON payload to backend
  - NAFATH button only shows a toast — no backend call
  - Skip button allows bypassing setup entirely
- **Status:** ⚠️ PARTIAL. Base64 conversion is done but no multipart upload. NAFATH is fake. Base64 in JSON is not a real upload endpoint.

### D) Client Profile Edit Page (MOCK upload — needs fix)

- **Route:** `/client-overview/profile/edit`
- **Component:** `src/app/pages/dashboard/clients-overview/profile/profile-edit/profile-edit.ts`
- **Features:**
  - Avatar upload: converts to base64, auto-saves via `updateProfile()`
  - ID upload (`onIdUpload`): only stores **file name** in a signal — no upload at all
  - Identity form has `idNumber`, `idExpiryDate`, `nationality` fields
  - Change requests system: shows pending/rejected requests per tab
- **Status:** ⚠️ MOCK. ID upload stores filename only. Avatar uses base64 in JSON.

### E) Admin KYC Page (PLACEHOLDER — not implemented)

- **Route:** `/supper-admin-overview/kyc`
- **Component:** `src/app/pages/dashboard/supper-admin-overview/sa-kyc/sa-kyc.ts`
- **Template:** `src/app/pages/dashboard/supper-admin-overview/sa-kyc/sa-kyc.html`
- **Status:** Empty placeholder component. No logic, no API calls.

### F) Accreditation Upload (Separate feature — not onboarding)

- **Route:** `/provider-overview/business-models/accreditation/new`
- **Component:** `src/app/pages/dashboard/provider-overview/business-models/accreditation/new/components/step2-upload/step2-upload.component.ts`
- **Status:** Separate business model accreditation flow. Not part of onboarding. Out of scope for Module 5.

---

## 2. Existing Routes

| Route | Component | Upload Type | Status |
|-------|-----------|-------------|--------|
| `/provider-overview/profile/data` | `Data` | Real multipart upload | ✅ Working |
| `/provider-overview/profile/setup` | `ProfileSetupDashboard` (provider) | Mock (filename only) | ⚠️ Needs fix |
| `/client-overview/profile-setup` | `ProfileSetupDashboard` (client) | Base64 in JSON | ⚠️ Needs fix |
| `/client-overview/profile/edit` | `ProfileEdit` | Mock (filename only) | ⚠️ Needs fix |
| `/supper-admin-overview/kyc` | `SaKyc` | None | 🚫 Placeholder |

---

## 3. Confirmed Backend Endpoints (from code analysis)

| # | Role | Method | Path | Content-Type | Notes |
|---|------|--------|------|-------------|-------|
| 1 | Provider | GET | `/api/provider/profile/me` | JSON | Get provider profile with document URLs |
| 2 | Provider | POST | `/api/provider/profile/documents/upload` | multipart/form-data | Upload single file, returns `{ data: { url, name } }` |
| 3 | Provider | POST | `/api/provider/profile/sensitive-change` | JSON | Initiate sensitive change (DOCUMENTS category) |
| 4 | Provider | POST | `/api/provider/profile/sensitive-change/verify` | JSON | Verify OTP for sensitive change |
| 5 | Provider | GET | `/api/provider/profile/setup` | JSON | Get saved setup data |
| 6 | Provider | POST | `/api/provider/profile/setup` | JSON | Save setup data (currently sends filenames, should send URLs) |
| 7 | Client | GET | `/api/client/profile/setup` | JSON | Get saved setup data |
| 8 | Client | POST | `/api/client/profile/setup` | JSON | Save setup data (currently sends base64) |
| 9 | Both | GET | `/api/profiles/me` | JSON | Get profile (used by ProfileEdit) |
| 10 | Both | PUT | `/api/profiles/update` | JSON | Update profile |
| 11 | Both | PUT | `/api/profiles/update/:tabName` | JSON | Update specific tab |
| 12 | Both | GET | `/api/profiles/my-change-requests` | JSON | Get change requests |

### Endpoints NOT found (gaps):

| Needed | Status |
|--------|--------|
| `POST /api/client/profile/documents/upload` | ❌ Not found in code. Client has no multipart upload endpoint. |
| `POST /api/provider/profile/nafath/verify` | ❌ Not found. NAFATH is mocked. |
| `POST /api/client/profile/nafath/verify` | ❌ Not found. NAFATH is mocked. |
| `GET /api/admin/kyc` or `GET /api/admin/verifications` | ❌ Not found. Admin KYC page is empty placeholder. |
| `POST /api/admin/kyc/:id/approve` | ❌ Not found. |
| `POST /api/admin/kyc/:id/reject` | ❌ Not found. |

---

## 4. Missing Backend Endpoints / Gaps

### A) Client document upload endpoint missing

- **Issue:** No `POST /api/client/profile/documents/upload` endpoint found in code.
- **Impact:** Client setup wizard sends base64 strings in JSON payload. This is not a real file upload and may not be supported by backend.
- **Needed:** Backend should provide a multipart upload endpoint for client documents (same as provider's `/documents/upload`).

### B) NAFATH verification endpoint missing

- **Issue:** No NAFATH verification endpoint found. Both provider and client setup wizards mock the NAFATH flow.
- **Impact:** Identity verification is fake. Users can bypass KYC.
- **Needed:** Backend should provide NAFATH verification endpoints (initiate + verify/poll).

### C) Admin KYC/verification review endpoints missing

- **Issue:** No admin endpoints found for reviewing/approving/rejecting KYC submissions.
- **Impact:** Admin KYC page is a placeholder. Cannot review uploaded documents.
- **Needed:** Backend should provide:
  - `GET /api/admin/kyc` — list pending KYC submissions
  - `GET /api/admin/kyc/:id` — get KYC details with document URLs
  - `POST /api/admin/kyc/:id/approve` — approve KYC
  - `POST /api/admin/kyc/:id/reject` — reject KYC with reason

### D) Swagger schema gap

- **Issue:** Swagger spec is JS-rendered and not fetchable programmatically. Cannot confirm exact schema for `OnboardingUploadRequest`, `UploadRequest`, or other onboarding-related schemas.
- **Impact:** Cannot verify exact request/response shapes for setup endpoints.
- **Needed:** Backend team should provide raw OpenAPI JSON URL or document exact schemas.

---

## 5. Current Frontend State Summary

| Page | Real Upload? | Calls Backend? | Mock Behavior |
|------|-------------|----------------|---------------|
| Provider profile/data | ✅ Yes (multipart) | ✅ Yes | None |
| Provider profile/setup | ❌ No | ⚠️ Sends filenames | File names stored, NAFATH fake |
| Client profile-setup | ⚠️ Base64 in JSON | ✅ Yes | Base64 instead of multipart, NAFATH fake |
| Client profile/edit | ❌ No | ⚠️ Filename only for ID | ID upload stores name only, avatar is base64 |
| Admin KYC | N/A | ❌ No | Empty placeholder |

---

## 6. Proposed Chunks

### Chunk 1 — Upload models + API service
- Create `src/app/core/models/onboarding.model.ts` with interfaces for upload requests/responses
- Add client document upload method to `ProfileApiService` (or create `OnboardingApiService`)
- Add NAFATH verification methods (if backend confirms endpoints)
- Add admin KYC methods (if backend confirms endpoints)

### Chunk 2 — Provider profile setup wizard: replace mock upload with real upload
- Modify `profile-setup.ts` (provider) `onFileSelected()` to call `ProviderProfileService.uploadDocument()` 
- Store returned URLs instead of filenames
- Replace mock NAFATH with safe unavailable state (or real call if endpoint exists)
- Update portfolio file handling to use real upload
- Update final submit payload to send URLs instead of filenames

### Chunk 3 — Client profile setup wizard: replace base64 with real upload
- Modify `profile-setup.ts` (client) `onFileSelected()` to call real multipart upload
- Store returned URLs instead of base64 strings
- Replace mock NAFATH with safe unavailable state
- Update final submit payload to send URLs instead of base64

### Chunk 4 — Client profile edit: fix ID upload
- Modify `profile-edit.ts` `onIdUpload()` to call real upload endpoint
- Store returned URL in form instead of filename

### Chunk 5 — Admin KYC review page (if backend supports it)
- Implement `sa-kyc.ts` with list of pending KYC submissions
- Add detail modal with document preview
- Add approve/reject actions
- If no backend endpoints: implement safe unavailable state

### Chunk 6 — Safe cleanup of remaining mock behavior
- Remove any remaining fake NAFATH flows
- Remove any remaining base64 upload patterns
- Remove any remaining filename-only storage
- Add code comments about backend gaps

### Chunk 7 — Runtime testing + blockers update
- Build verification
- Manual testing instructions
- Update `PHASE_1_BACKEND_BLOCKERS_REPORT.md`

---

## 7. Files Likely to Modify

| File | Chunk | Changes |
|------|-------|---------|
| `src/app/core/models/onboarding.model.ts` | 1 | New file: upload models |
| `src/app/core/services/profile-api.service.ts` | 1 | Add client upload method |
| `src/app/core/services/provider-profile.service.ts` | 1 | Add NAFATH method if available |
| `src/app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts` | 2 | Real upload, remove mock NAFATH |
| `src/app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html` | 2 | Update upload UI states |
| `src/app/pages/dashboard/clients-overview/profile/profile-setup/profile-setup.ts` | 3 | Replace base64 with multipart |
| `src/app/pages/dashboard/clients-overview/profile/profile-setup/profile-setup.html` | 3 | Update upload UI states |
| `src/app/pages/dashboard/clients-overview/profile/profile-edit/profile-edit.ts` | 4 | Fix ID upload |
| `src/app/pages/dashboard/clients-overview/profile/profile-edit/profile-edit.html` | 4 | Update ID upload UI |
| `src/app/pages/dashboard/supper-admin-overview/sa-kyc/sa-kyc.ts` | 5 | Implement or safe unavailable |
| `src/app/pages/dashboard/supper-admin-overview/sa-kyc/sa-kyc.html` | 5 | Implement or safe unavailable |
| `src/app/pages/dashboard/supper-admin-overview/sa-kyc/sa-kyc.css` | 5 | New styles |

---

## 8. Manual Testing Checklist

### Provider Profile Data (already working — verify still works)
- [ ] Login as provider
- [ ] Navigate to `/provider-overview/profile/data`
- [ ] Upload ID document — verify progress bar, preview, success
- [ ] Upload certificate — verify progress bar, preview, success
- [ ] Click "إرسال طلب تعديل" — verify OTP modal appears
- [ ] Enter OTP — verify sensitive change saved

### Provider Profile Setup (after Chunk 2)
- [ ] Login as provider
- [ ] Navigate to `/provider-overview/profile/setup`
- [ ] Go to Step 4 (docs)
- [ ] Upload front ID — verify real upload (progress, success)
- [ ] Upload certificate — verify real upload
- [ ] Go to Step 5 (portfolio) — upload portfolio files
- [ ] Complete wizard — verify payload sends URLs not filenames
- [ ] Check NAFATH button — verify safe unavailable state (or real flow)

### Client Profile Setup (after Chunk 3)
- [ ] Login as client
- [ ] Navigate to `/client-overview/profile-setup`
- [ ] Go to Step 2 (identity)
- [ ] Upload front ID — verify real multipart upload (not base64)
- [ ] Upload back ID — verify real upload
- [ ] Go to Step 4 (documents) — upload supporting docs
- [ ] Complete wizard — verify payload sends URLs not base64
- [ ] Check NAFATH button — verify safe unavailable state

### Client Profile Edit (after Chunk 4)
- [ ] Login as client
- [ ] Navigate to `/client-overview/profile/edit`
- [ ] Upload ID — verify real upload (not filename only)

### Admin KYC (after Chunk 5)
- [ ] Login as admin (if possible)
- [ ] Navigate to `/supper-admin-overview/kyc`
- [ ] If backend supports: verify list of KYC submissions, detail modal, approve/reject
- [ ] If backend doesn't support: verify safe unavailable state

---

## 9. Backend Questions / Blockers

1. **Client document upload:** Is there a `POST /api/client/profile/documents/upload` endpoint (multipart/form-data)? If not, backend needs to provide one.
2. **NAFATH verification:** Are there NAFATH initiate/verify endpoints? If not, frontend will show safe unavailable state.
3. **Admin KYC review:** Are there admin endpoints for listing/reviewing/approving/rejecting KYC submissions? If not, admin page will show safe unavailable state.
4. **Swagger spec:** The OpenAPI JSON is not accessible at standard URLs. Please provide the raw spec URL or paste relevant endpoint definitions.
5. **OnboardingUploadRequest / UploadRequest schemas:** These were mentioned in a previous Swagger schema list. What are the exact paths, methods, and field names for these?
6. **File constraints:** What are the max file size, allowed types, and max number of files per upload? (Current frontend assumes 10MB max, PDF/JPG/PNG only.)

---

## 10. Safe to Proceed: **YES**

Provider profile/data page already has a working real upload flow. Provider and client setup wizards have clear mock behaviors to fix. Admin KYC page is a placeholder to implement or mark unavailable.

**Recommended first code chunk:** Chunk 1 — Create upload models and add missing API service methods. This is safe because it only adds new files and methods without modifying existing components.

**Prerequisite:** Before Chunk 3 (client upload), we need confirmation from backend about the client document upload endpoint. If it doesn't exist, we'll implement a safe unavailable state for client uploads and document it as a blocker.
