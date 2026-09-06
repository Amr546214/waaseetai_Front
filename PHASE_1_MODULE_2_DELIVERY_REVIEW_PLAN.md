# Phase 1 — Module 2: Client Delivery Review / Approval / Rating

## Investigation & Implementation Plan (Chunk 0)

---

## 1. Existing Code Found

### 1.1 Client Project Workspace (Delivery Review)

**Component:** `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts`
- Loads workspace data from `GET /client/my-requests/:projectId/workspace`
- Displays project stages, deliveries, threads, files, AI insights
- Supports stage review modal: approve or request revision
- Posts review decision to `POST /client/my-requests/:projectId/stages/:stageId/review` with `{ decision: 'approve' | 'revision', note: string }`
- Handles support actions: edit request, dispute, cancel
- Tabs: overview, milestones, messages, files

**Template:** `src/app/pages/dashboard/clients-overview/project/project-details/project-details.html`
- Full workspace UI with stage timeline, KPIs, escrow info, AI insights
- Review modal with approve/revision buttons
- Support action modal for edit/dispute/cancel

### 1.2 Provider Delivery Submission

**Component:** `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.ts`
- Loads project progress from `GET /provider/projects/:projectId/progress`
- Delivery submission via `POST /provider/projects/:projectId/stages/:stageId/deliveries` with `{ note: string, files: string[] }`
- Tabs: overview, milestones, messages, files, deliveries, edits
- Delivery modal with note textarea and file URLs input

**Template:** `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.html`
- Full provider workspace with stage timeline, delivery history, edit requests
- Delivery submission form modal

### 1.3 Legacy Review-Project Component (Mock)

**Component:** `src/app/pages/dashboard/clients-overview/project/review-project/review-project.ts`
- **Mock data only** — hardcoded project details and files
- `openAccept()` only logs to console, no API call
- Not currently routed (no route entry in `client.routes.ts`)

### 1.4 Client Request Details

**Component:** `src/app/pages/dashboard/clients-overview/my-request/request-details/request-details.ts`
- Loads request details from `GET /client/my-requests/:id`
- Manages offers, negotiation, chat initiation
- Accepts offer via `POST /client/my-requests/:id/offers/select`
- **No rating or review submission found here**

### 1.5 Marketplace Offer (Reviews Display Only)

**Component:** `src/app/pages/website/marketplace/offer/offer.ts`
- Displays existing reviews for marketplace models (read-only)
- Review filtering by star rating
- **No rating submission UI** — only displays reviews from API

### 1.6 Services

| Service | File | Relevant Methods |
|---------|------|-------------------|
| `ActiveProjectsService` | `src/app/core/services/active.service.ts` | `getProjectProgress(projectId)`, `submitDelivery(projectId, stageId, payload)` |
| `ProjectApiService` | `src/app/core/services/project-api.service.ts` | `getMyRequests()`, `getRequestDetails(id)`, `createProject()`, `uploadAttachments()` — **No review/rating methods** |
| `ProviderApiService` | `src/app/core/services/provider-api.service.ts` | `getProviderStatistics()` (includes `providerRating`, `humanRating`, `aiRating` in response) — **No rating submission** |
| `MarketplaceService` | `src/app/core/services/marketplace.service.ts` | `getPublishedModelById(id)` (includes `reviews` array), `requestService()` — **No rating submission** |

### 1.7 Models

| Model | File | Contents |
|-------|------|----------|
| `ApiResponse<T>` | `src/app/core/models/api.model.ts` | Generic API response wrapper |
| `ClientRequestPayload` | `src/app/core/models/api.model.ts` | Request creation payload — **No review/rating types** |
| `DashboardStatsPayload` | `src/app/core/models/dashboard.model.ts` | Contains `aiRating`, `humanRating`, `providerRating` in summary — **Display only, no submission types** |
| `MarketplaceModel` | `src/app/core/services/marketplace.service.ts` | Contains `rating`, `reviewsCount`, `reviews[]` — **Display only** |
| `Offer` (local) | `request-details.ts` | Contains `rating` field for provider — **Display only** |

---

## 2. Existing Routes

### Client Routes (`src/app/pages/dashboard/clients-overview/client.routes.ts`)

| Path | Component | Purpose |
|------|-----------|---------|
| `projects/active` | `ActiveProject` | List of active projects |
| `projects/:id` | `ProjectDetails` | Project workspace (delivery review) |
| `projects/archived` | `ArchivedProjects` | Archived projects |
| `my-requests/:id` | `RequestDetails` | Request details & offers |
| `my-requests/:id/contract` | `ContractSignature` | Contract signing |
| `my-requests/:id/deposit` | `EscrowDeposit` | Escrow deposit |
| `disputes` | `Disputes` | Disputes list |

### Provider Routes (`src/app/pages/dashboard/provider-overview/provider.routes.ts`)

| Path | Component | Purpose |
|------|-----------|---------|
| `projects/active` | `Active` | Active projects list |
| `projects/active/progress/:id` | `Progress` | Project progress & delivery submission |
| `projects/progress/:id` | `Progress` | (alias) Same as above |
| `projects/archived` | `Archived` | Archived projects |
| `offers/:id/sign-contract` | `SignContract` | Contract signing |
| `disputes` | `Disputes` | Disputes list |

### Missing Routes

- **No route for project completion / rating submission** (client side)
- **No route for project completion / rating submission** (provider side)
- **No route for final delivery acceptance & escrow release confirmation**

---

## 3. Backend Endpoints

### 3.1 Available & Confirmed Endpoints

| Endpoint | Method | Used In | Purpose |
|----------|--------|---------|---------|
| `/client/my-requests/:id/workspace` | GET | `project-details.ts` | Load client project workspace with stages, deliveries, threads |
| `/client/my-requests/:id` | GET | `request-details.ts` | Load request details with offers |
| `/client/my-requests/:id/stages/:stageId/review` | POST | `project-details.ts` | Submit stage review decision (approve/revision) |
| `/client/my-requests/:id/offers/select` | POST | `request-details.ts` | Select an offer |
| `/provider/projects/:id/progress` | GET | `progress.ts` | Load provider project progress |
| `/provider/projects/:id/stages/:stageId/deliveries` | POST | `progress.ts` | Submit delivery for a stage |
| `/provider/statistics` | GET | `provider-api.service.ts` | Provider dashboard stats (includes ratings) |
| `/marketplace/models/:id` | GET | `offer.ts` | Get model details (includes reviews display) |

### 3.2 Known Backend Endpoints (Not Yet Integrated)

Per user-provided spec, these endpoints exist on the backend but are **not yet called from the frontend**:

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/client/requests/:id/rate` | POST | Client rates provider after project completion | **Not integrated** |
| `/provider/requests/:id/rate` | POST | Provider rates client after project completion | **Not integrated** |

### 3.3 Missing Endpoints (Unknown / Needs Backend Confirmation)

| Endpoint | Purpose | Notes |
|----------|---------|-------|
| `GET /client/my-requests/:id/rating-status` | Check if client has already rated | May not exist — alternatively, rating status could be part of workspace response |
| `GET /provider/projects/:id/rating-status` | Check if provider has already rated | Same as above |
| `GET /client/my-requests/:id/completion-status` | Check if project is completed and ready for rating | May be part of workspace data (`status === 'COMPLETED'`) |

---

## 4. Proposed UI Pages / Components

### 4.1 Client Rating Modal (in ProjectDetails)

**Purpose:** After all stages are approved and project status is `COMPLETED`, show a rating modal for the client to rate the provider.

**UI Elements:**
- Star rating (1-5) with interactive hover
- Optional text review/comment
- Provider name and project summary display
- Submit button with loading state
- Skip option (if rating is optional)
- Success confirmation state

**Trigger:** When `project.status === 'COMPLETED'` and `project.canRate === true` (from workspace API)

### 4.2 Provider Rating Modal (in Progress)

**Purpose:** After project completion, show a rating modal for the provider to rate the client.

**UI Elements:**
- Star rating (1-5) for client communication, clarity, professionalism
- Optional text review
- Client name and project summary
- Submit button with loading state
- Skip option
- Success confirmation

**Trigger:** When `projectData.status === 'COMPLETED'` and `projectData.canRate === true`

### 4.3 Delivery Review Enhancement (Existing ProjectDetails)

**Purpose:** Enhance the existing stage review flow with better visual feedback.

**Enhancements:**
- Show AI quality check summary for each delivery (if available from API)
- Display delivery round count and revision history more prominently
- Add "View files" preview before approve/revision
- Show escrow release confirmation on approve

### 4.4 Project Completion Banner

**Purpose:** Visual indicator when project is completed but rating is pending.

**UI Elements:**
- Banner in project workspace: "المشروع مكتمل — قيّم تجربتك"
- CTA button to open rating modal
- Dismiss option if rating already submitted

---

## 5. Proposed Implementation Chunks

### Chunk 1: Rating Models & Service Layer

**Files to create/modify:**
- `src/app/core/models/rating.model.ts` (NEW) — Rating payload & response interfaces
- `src/app/core/services/rating.service.ts` (NEW) — Service with `submitClientRating(requestId, payload)` and `submitProviderRating(requestId, payload)` methods

**Details:**
```typescript
// rating.model.ts
export interface RatingPayload {
  rating: number;          // 1-5
  comment?: string;        // optional text review
  communication?: number;  // sub-rating (provider rating client)
  clarity?: number;        // sub-rating
  professionalism?: number; // sub-rating
}

export interface RatingResponse {
  success: boolean;
  message?: string;
  data?: {
    ratingId: string;
    averageRating?: number;
  };
}
```

```typescript
// rating.service.ts
submitClientRating(requestId: string, payload: RatingPayload): Observable<RatingResponse>
  // POST /client/requests/:id/rate

submitProviderRating(requestId: string, payload: RatingPayload): Observable<RatingResponse>
  // POST /provider/requests/:id/rate
```

### Chunk 2: Client Rating Modal Component

**Files to create:**
- `src/app/pages/dashboard/clients-overview/project/rating-modal/rating-modal.ts`
- `src/app/pages/dashboard/clients-overview/project/rating-modal/rating-modal.html`
- `src/app/pages/dashboard/clients-overview/project/rating-modal/rating-modal.css`

**Details:**
- Standalone component with star rating UI
- Input: provider name, project title
- Output: rating submission event
- Integrates with `RatingService`

### Chunk 3: Integrate Rating Modal into Client ProjectDetails

**Files to modify:**
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts`
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.html`
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.css`

**Changes:**
- Add `canRate` signal based on workspace response (`status === 'COMPLETED'` and `canRate === true`)
- Add completion banner in template
- Add rating modal trigger
- Import `RatingModalComponent` and `RatingService`
- Handle rating submission success: hide banner, show toast

### Chunk 4: Provider Rating Modal Component

**Files to create:**
- `src/app/pages/dashboard/provider-overview/projects/active/rating-modal/rating-modal.ts`
- `src/app/pages/dashboard/provider-overview/projects/active/rating-modal/rating-modal.html`
- `src/app/pages/dashboard/provider-overview/projects/active/rating-modal/rating-modal.css`

**Details:**
- Similar to client rating modal but for provider rating client
- Includes sub-ratings: communication, clarity, professionalism
- Integrates with `RatingService`

### Chunk 5: Integrate Rating Modal into Provider Progress

**Files to modify:**
- `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.ts`
- `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.html`
- `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.css`

**Changes:**
- Add `canRate` signal based on progress response
- Add completion banner
- Add rating modal trigger
- Import provider `RatingModalComponent` and `RatingService`

### Chunk 6: Delivery Review Enhancement (Optional)

**Files to modify:**
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts`
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.html`
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.css`

**Changes:**
- Enhanced file preview in review modal
- AI quality check display (if API provides)
- Better revision history display
- Escrow release confirmation animation on approve

---

## 6. Files Likely to Modify (Summary)

| File | Action | Chunk |
|------|--------|-------|
| `src/app/core/models/rating.model.ts` | CREATE | 1 |
| `src/app/core/services/rating.service.ts` | CREATE | 1 |
| `src/app/pages/dashboard/clients-overview/project/rating-modal/rating-modal.ts` | CREATE | 2 |
| `src/app/pages/dashboard/clients-overview/project/rating-modal/rating-modal.html` | CREATE | 2 |
| `src/app/pages/dashboard/clients-overview/project/rating-modal/rating-modal.css` | CREATE | 2 |
| `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts` | MODIFY | 3 |
| `src/app/pages/dashboard/clients-overview/project/project-details/project-details.html` | MODIFY | 3 |
| `src/app/pages/dashboard/clients-overview/project/project-details/project-details.css` | MODIFY | 3 |
| `src/app/pages/dashboard/provider-overview/projects/active/rating-modal/rating-modal.ts` | CREATE | 4 |
| `src/app/pages/dashboard/provider-overview/projects/active/rating-modal/rating-modal.html` | CREATE | 4 |
| `src/app/pages/dashboard/provider-overview/projects/active/rating-modal/rating-modal.css` | CREATE | 4 |
| `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.ts` | MODIFY | 5 |
| `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.html` | MODIFY | 5 |
| `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.css` | MODIFY | 5 |

**Files NOT to touch:**
- Checkout/cart components and services
- Marketplace components (unless rating display needs update)
- Auth/guard files
- Unrelated dashboard pages

---

## 7. Safe Implementation Order

1. **Chunk 1** — Models & Service (no UI impact, safe foundation)
2. **Chunk 2** — Client Rating Modal component (isolated, new files)
3. **Chunk 3** — Integrate into Client ProjectDetails (minimal changes to existing file)
4. **Chunk 4** — Provider Rating Modal component (isolated, new files)
5. **Chunk 5** — Integrate into Provider Progress (minimal changes to existing file)
6. **Chunk 6** — Delivery Review Enhancement (optional, cosmetic)

---

## 8. Testing Checklist

### Chunk 1: Models & Service
- [ ] `RatingService.submitClientRating()` calls `POST /client/requests/:id/rate` with correct payload
- [ ] `RatingService.submitProviderRating()` calls `POST /provider/requests/:id/rate` with correct payload
- [ ] Error handling: API returns error → service propagates error
- [ ] Error handling: network error → service returns observable error

### Chunk 2: Client Rating Modal
- [ ] Star rating UI: clicking stars sets rating value
- [ ] Star rating UI: hover preview works
- [ ] Comment textarea: optional, max length validation
- [ ] Submit button: disabled while saving
- [ ] Submit success: shows success state, emits event
- [ ] Submit error: shows error message
- [ ] Skip/close: closes modal without submitting
- [ ] RTL layout correct

### Chunk 3: Client ProjectDetails Integration
- [ ] Completion banner shows when `status === 'COMPLETED'` and `canRate === true`
- [ ] Banner not shown when rating already submitted
- [ ] Clicking banner CTA opens rating modal
- [ ] Rating submission success: banner hides, toast shows
- [ ] Rating submission error: error message displayed
- [ ] Existing stage review flow still works (no regression)
- [ ] Existing tabs (overview, miles, msgs, files) still work
- [ ] Existing support actions (edit, dispute, cancel) still work

### Chunk 4: Provider Rating Modal
- [ ] Star rating UI for overall + sub-ratings (communication, clarity, professionalism)
- [ ] Submit flow same as client modal
- [ ] RTL layout correct

### Chunk 5: Provider Progress Integration
- [ ] Completion banner shows when project completed and can rate
- [ ] Rating modal opens and submits correctly
- [ ] Existing delivery submission flow still works (no regression)
- [ ] Existing tabs still work
- [ ] Existing delivery/edit filters still work

### Chunk 6: Delivery Review Enhancement (Optional)
- [ ] File preview links work
- [ ] AI quality check displays if data available
- [ ] Escrow release confirmation shows on approve
- [ ] No regression to existing review flow

### Cross-Cutting
- [ ] No checkout/cart functionality broken
- [ ] No marketplace functionality broken
- [ ] No auth/guard functionality broken
- [ ] Build passes (`ng build`)
- [ ] No console errors on page load
- [ ] RTL layout maintained throughout
- [ ] Mobile responsive for all new components

---

## 9. API Contract Assumptions

### POST `/client/requests/:id/rate`

**Request:**
```json
{
  "rating": 5,
  "comment": "مقدم خدمة محترف والتسليم كان في الوقت"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "تم تسجيل تقييمك بنجاح",
  "data": {
    "ratingId": "rat_123",
    "averageRating": 4.8
  }
}
```

**Response (error — already rated):**
```json
{
  "success": false,
  "message": "تم تقييم هذا المشروع مسبقاً"
}
```

### POST `/provider/requests/:id/rate`

**Request:**
```json
{
  "rating": 5,
  "comment": "عميل واضح في متطلباته",
  "communication": 5,
  "clarity": 4,
  "professionalism": 5
}
```

**Response:** Same structure as client rating.

### Workspace/Progress Response Additions (Assumed)

The workspace API response (`GET /client/my-requests/:id/workspace`) likely includes or should include:
```json
{
  "status": "COMPLETED",
  "canRate": true,
  "hasRated": false,
  "ratingInfo": {
    "providerName": "...",
    "projectTitle": "..."
  }
}
```

Similarly for provider progress (`GET /provider/projects/:id/progress`):
```json
{
  "status": "COMPLETED",
  "canRate": true,
  "hasRated": false,
  "ratingInfo": {
    "clientName": "...",
    "projectTitle": "..."
  }
}
```

> **Note:** These workspace/progress response fields need backend confirmation. If `canRate`/`hasRated` are not available, we can infer from `status === 'COMPLETED'` and attempt rating submission (handling "already rated" error gracefully).

---

## 10. Key Decisions & Open Questions

1. **Rating trigger:** Should rating modal auto-open on project completion, or only show a banner? → **Recommendation: Banner with CTA, not auto-open** (less intrusive)

2. **Rating required vs optional:** Can client/provider skip rating? → **Assume optional** with skip button

3. **Sub-ratings for provider rating client:** Does backend expect `communication`, `clarity`, `professionalism` fields? → **Needs backend confirmation**

4. **Rating display:** Should submitted ratings be visible in the workspace? → **Out of scope for this module** (rating display is in marketplace/provider profile)

5. **Legacy `review-project` component:** Should it be removed or repurposed? → **Recommendation: Leave as-is, not routed, low priority cleanup**

6. **Workspace `canRate` field:** Does the backend already return this? → **Needs testing with real API call**

---

## 11. Current Chunk Status (as of Sep 3, 2026)

| Chunk | Description | Build | Browser Test | Status |
|-------|-------------|-------|-------------|--------|
| Chunk 1 | Rating Models & Service Layer | PASS | N/A (no UI) | **Done** |
| Chunk 2 | Client Rating Modal Component | PASS | N/A (standalone component, no route) | **Done** |
| Chunk 3 | Integrate Rating Modal into Client ProjectDetails | PASS | **BLOCKED** — `GET /client/my-requests/:id/workspace` returns 404 for all tested projects | **Implemented, test blocked** |
| Chunk 4 | Provider Rating Modal Component | PASS | N/A (standalone component, no route) | **Done** |
| Chunk 5 | Integrate Rating Modal into Provider Progress | PASS | **BLOCKED** — `GET /provider/projects/active` returns 429 (rate limited), no provider project data available | **Implemented, test blocked** |
| Chunk 6 | Delivery Review Enhancement (Optional) | — | — | **Skipped** — deprioritized, focus on rating integration |

### Chunk 3 Details (Client Rating Integration)
- **Files modified:** `project-details.ts`, `project-details.html`, `project-details.css`
- **What was done:** Imported `ClientRatingModal` and `RatingApiService`, added signals for modal state and submission, added `canRateProvider` logic, rating banner, success message, and modal component to template
- **Build:** PASS
- **Browser test:** BLOCKED — workspace endpoint returns 404 for all tested project IDs. Cannot verify rating banner display or rating submission.

### Chunk 5 Details (Provider Rating Integration)
- **Files modified:** `progress.ts`, `progress.html`, `progress.css`
- **What was done:** Imported `ProviderRatingModal` and `RatingApiService`, added signals for modal state and submission, added `canRateClient` logic, rating banner, success message, and modal component to template
- **Build:** PASS
- **Browser test:** BLOCKED — provider active projects endpoint rate-limited (429). No provider project available to open progress page and verify rating banner or submission.

---

## 12. Backend/Data Blockers

### Blocker 1: Client Workspace 404
- **Endpoint:** `GET /api/client/my-requests/:id/workspace`
- **Issue:** Returns 404 for all tested project IDs
- **Impact:** Cannot test client rating integration (Chunk 3)
- **Needed:** Valid project ID where workspace endpoint returns data with `status === 'COMPLETED'` and `canRate === true`

### Blocker 2: Provider Active Projects 429
- **Endpoint:** `GET /api/provider/projects/active`
- **Issue:** Returns 429 Too Many Requests (rate limited, 15-minute cooldown)
- **Impact:** Cannot test provider rating integration (Chunk 5)
- **Note:** Frontend code verified clean — single API call on page load, no request loop, no auto-retry. Rate limit is from backend side.
- **Needed:** Wait for rate limit to expire, then need valid provider project with `status === 'COMPLETED'` and `canRate === true`

### Blocker 3: No Completed Project Data
- **Issue:** Even when endpoints are accessible, no completed/canRate project data is available for either client or provider
- **Impact:** Cannot verify rating banner display logic or rating submission flow
- **Needed:** Backend should have at least one project with `status === 'COMPLETED'` and `canRate === true` for both client and provider sides

---

## 13. Manual Test Checklist (When Backend is Ready)

### Client Rating (Chunk 3)

**Prerequisites:**
- Valid client account with at least one completed project
- `GET /client/my-requests/:id/workspace` returns data with `status === 'COMPLETED'` and `canRate === true`

**Steps:**
1. Login as client
2. Navigate to `/client-overview/projects/:id` (replace `:id` with valid project ID)
3. Verify workspace loads successfully (stages, deliveries, tabs visible)
4. If project is completed and `canRate === true`:
   - Verify rating banner appears with text "قيّم تجربتك مع مقدم الخدمة"
   - Click the banner CTA button to open rating modal
   - Select star rating (1-5)
   - Optionally write a comment
   - Click submit
   - Verify `POST /api/client/requests/:id/rate` is called with `{ rating, comment }`
   - Verify success message appears: "تم إرسال تقييمك بنجاح"
   - Verify banner disappears after successful submission
5. If project is not completed or `canRate === false`:
   - Verify rating banner does NOT appear
6. Verify existing stage review flow still works (approve/revision)
7. Verify existing tabs (overview, milestones, messages, files) still work
8. Verify existing support actions (edit, dispute, cancel) still work

### Provider Rating (Chunk 5)

**Prerequisites:**
- Valid provider account with at least one completed project
- `GET /provider/projects/active` returns project list (not rate-limited)
- `GET /provider/projects/:id/progress` returns data with `status === 'COMPLETED'` and `canRate === true`

**Steps:**
1. Login as provider
2. Navigate to `/provider-overview/projects/active`
3. Verify active projects list loads
4. Click on a completed project to open progress page
5. If project is completed and `canRate === true`:
   - Verify rating banner appears with text "قيّم تجربتك مع العميل"
   - Click the banner CTA button to open rating modal
   - Select star rating (1-5)
   - Optionally write a comment
   - Click submit
   - Verify `POST /api/provider/requests/:id/rate` is called with `{ rating, comment }`
   - Verify success message appears: "تم إرسال تقييمك بنجاح"
   - Verify banner disappears after successful submission
6. If project is not completed or `canRate === false`:
   - Verify rating banner does NOT appear
7. Verify existing delivery submission flow still works
8. Verify existing tabs (overview, milestones, messages, files, deliveries, edits) still work

---

## 14. Dev-Only Provider Onboarding Bypass (Temporary)

**Status:** UNCOMMITTED — all changes are working-tree only, not staged or committed.

**Purpose:** Allows skipping the lengthy provider onboarding/profile setup flow during local development to test provider pages.

**Files involved:**
- `src/app/core/utils/dev-bypass.util.ts` (NEW, untracked)
- `src/app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts` (modified)
- `src/app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.html` (modified)
- `src/app/pages/dashboard/provider-overview/provider-overview/provider-overview.ts` (modified)
- `src/app/pages/dashboard/provider-overview/provider-overview/provider-overview.html` (modified)
- `src/app/sheards/dashboard/sidebar/sidebar.ts` (modified)

**How it works:**
- `isLocalDev` getter in `ProfileSetupDashboard` checks `!environment.production || hostname is localhost/127.0.0.1`
- Yellow "تخطي مؤقت للتجربة" button appears on profile setup page (top + inside test generating box)
- On click: sets `localStorage[waseet_dev_provider_onboarding_complete] = "true"`, updates `AuthStore` user locally, navigates to `/provider-overview/projects/active`
- Sidebar reads bypass flag and skips API-based incompleteness check
- Provider overview hides profile completion banner when bypass is active
- Red "إلغاء التخطي التجريبي" button clears the flag and reloads

**IMPORTANT:** This is DEV ONLY TEMP BYPASS — remove before production/PR merge. All code is marked with comments. Do NOT commit unless explicitly instructed.
