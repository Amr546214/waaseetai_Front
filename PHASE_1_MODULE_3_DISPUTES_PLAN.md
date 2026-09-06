# Phase 1 — Module 3: Disputes / النزاعات

## Investigation & Implementation Plan (Chunk 0)

---

## 1. Existing Code Found

### 1.1 Client Disputes Page (MOCK DATA)

**Component:** `src/app/pages/dashboard/clients-overview/disputes/disputes.ts`
- Standalone component with hardcoded mock dispute data (4 fake disputes)
- No API calls — all data is inline array
- Tabs: all, open, closed, mine, against, pending, review
- "رفع نزاع جديد" button only shows a toast: "سيُتاح رفع النزاع من صفحة متابعة المشروع مباشرة"
- No create dispute form/modal
- No dispute detail view
- `filteredDisputes` computed signal filters mock data by tab

**Template:** `src/app/pages/dashboard/clients-overview/disputes/disputes.html`
- Full disputes list UI with KPIs, tabs, timeline, AI decision display
- "تصعيد للإدارة" button shows toast only
- "متابعة النقاش" / "عرض النقاش" buttons — no click handler wired to navigation
- Empty state: "لا توجد نزاعات أو طلبات إلغاء. تُرفع النزاعات من صفحة متابعة المشروع عند الحاجة."

### 1.2 Provider Disputes Page (MOCK DATA — identical to client)

**Component:** `src/app/pages/dashboard/provider-overview/disputes/disputes.ts`
- Exact same mock data and logic as client disputes page (copy-paste)
- Same hardcoded disputes, same tabs, same toast-only buttons
- No API calls

**Template:** `src/app/pages/dashboard/provider-overview/disputes/disputes.html`
- Identical to client disputes template

### 1.3 Admin Disputes Page (PLACEHOLDER)

**Component:** `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.ts`
- Empty component, no logic, no data
- Template shows "هذه الصفحة قيد التطوير حالياً" (under development placeholder)

### 1.4 Client ProjectDetails — Support Action (STUB)

**Component:** `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts`
- `SupportAction` type defined: `'edit' | 'dispute' | 'cancel' | null`
- `supportAction` signal exists
- `openSupport(action)` and `closeSupport()` methods exist
- `supportNote` string property exists
- **BUT:** No template usage — `openSupport` is never called from HTML, no support modal in template
- No API call for creating a dispute — methods are stubs only
- No submit handler for dispute/cancel/edit

### 1.5 Project Status Model

**File:** `src/app/core/models/dashboard.model.ts`
- `ProjectStatus` type includes `'DISPUTED'` — used for display only
- Client overview template shows "متنازع عليه" for DISPUTED status
- `my-request.ts` maps `'DISPUTED'` to `'dispute'` tab filter

### 1.6 Sidebar Navigation

**File:** `src/app/sheards/dashboard/sidebar/sidebar.ts`
- Client sidebar: "النزاعات" → `/client-overview/disputes`
- Provider sidebar: "النزاعات" → `/provider-overview/disputes`
- Admin sidebar: "النزاعات" → `/supper-admin-overview/disputes` (inside "النزاعات والشكاوى" accordion)
- Admin sidebar also has: "البلاغات" → `/supper-admin-overview/reports`, "الدعم الفني" → `/supper-admin-overview/support`

### 1.7 Services

| Service | File | Dispute Methods | Status |
|---------|------|----------------|--------|
| `ActiveProjectsService` | `src/app/core/services/active.service.ts` | None | No dispute methods |
| `ProjectApiService` | `src/app/core/services/project-api.service.ts` | None | No dispute methods |
| `ProviderApiService` | `src/app/core/services/provider-api.service.ts` | None | No dispute methods |
| `HttpClient` (direct) | `project-details.ts` | None | Used for workspace/review only |

**No dispute service exists anywhere in the codebase.**

### 1.8 Models

| Model | File | Dispute Fields | Status |
|-------|------|---------------|--------|
| `ProjectStatus` | `dashboard.model.ts` | `'DISPUTED'` enum value | Display only |
| `WorkspaceData` | (inline in project-details.ts) | None | No dispute fields |
| `ProgressData` | (inline in progress.ts) | None | No dispute fields |

**No Dispute model, DisputeStatus, CreateDisputePayload, or DisputeMessage types exist.**

---

## 2. Existing Routes

### Client Routes (`src/app/pages/dashboard/clients-overview/client.routes.ts`)

| Path | Component | Purpose | Status |
|------|-----------|---------|--------|
| `disputes` | `Disputes` | Disputes list page | **Mock data only** |

### Provider Routes (`src/app/pages/dashboard/provider-overview/provider.routes.ts`)

| Path | Component | Purpose | Status |
|------|-----------|---------|--------|
| `disputes` | `Disputes` | Disputes list page | **Mock data only (copy of client)** |

### Admin Routes (`src/app/pages/dashboard/supper-admin-overview/supper-admin.routes.ts`)

| Path | Component | Purpose | Status |
|------|-----------|---------|--------|
| `disputes` | `SaDisputes` | Admin disputes management | **Placeholder — "قيد التطوير"** |
| `reports` | `SaReports` | Reports/complaints | Unknown status |
| `support` | `SaSupport` | Support tickets | Unknown status |

### Missing Routes

- **No route for dispute detail page** (client, provider, or admin)
- **No route for creating a dispute** (no modal or standalone page)
- **No route for dispute conversation/messages**
- **No route for admin dispute review/decision**

---

## 3. Backend Endpoints

### 3.1 Confirmed Endpoints (Used in Existing Code)

None — no dispute-related API calls exist in the frontend.

### 3.2 Expected Endpoints (Not Yet Confirmed)

Based on app patterns and the existing API base (`https://api.waseetai.com/api`):

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `/client/disputes` | GET | List client's disputes | **Unconfirmed** |
| `/client/requests/:id/disputes` | POST | Create dispute for a request | **Unconfirmed** |
| `/client/disputes/:id` | GET | Get dispute details | **Unconfirmed** |
| `/provider/disputes` | GET | List provider's disputes | **Unconfirmed** |
| `/provider/disputes/:id` | GET | Get dispute details | **Unconfirmed** |
| `/admin/disputes` | GET | List all disputes for admin | **Unconfirmed** |
| `/admin/disputes/:id` | PATCH | Update dispute status / make decision | **Unconfirmed** |
| `/admin/disputes/:id/messages` | POST | Admin posts message in dispute | **Unconfirmed** |

### 3.3 Missing Endpoints (Needs Backend Confirmation)

> **Superseded by section 3.4 below** — Swagger investigation completed.

---

## 3.4 Confirmed Swagger Endpoints

**Source:** `https://api.waseetai.com/api/docs/` (extracted from `swagger-ui-init.js` on this session)

**Base URL:** `https://api.waseetai.com`

### Endpoints Table

| Role | Method | Endpoint | Purpose | Request Body | Response | Notes |
|------|--------|----------|---------|--------------|----------|-------|
| Client | POST | `/api/client/requests/:id/disputes` | Create dispute for a request | `CreateDisputeRequest` (required) | `ApiSuccess` | **Primary create endpoint.** Auth: Bearer required |
| Client | POST | `/api/client/my-requests/:id/disputes` | Create dispute (alias/duplicate route) | `GenericObject` (not required) | `ApiSuccess` | Duplicate/alias of the above. Prefer `/client/requests/:id/disputes` since it has a typed schema |
| Provider | POST | `/api/provider/requests/:id/disputes` | Provider creates dispute for a request | `CreateDisputeRequest` (required) | `ApiSuccess` | Auth: Bearer required |
| Provider | POST | `/api/provider/requests/:id/cancel` | Provider cancels a request | `GenericObject` (not required) | `ApiSuccess` | Related to "إلغاء بالتراضي" flow |
| Provider | POST | `/api/provider/profile/requests/:id/cancel` | Provider cancels (profile alias) | `GenericObject` (not required) | `ApiSuccess` | Duplicate/alias route |
| Admin | GET | `/api/admin/disputes` | List all disputes | — (query: `status`, `page`, `limit`) | `DisputeListResponse` | Paginated |
| Admin | GET | `/api/admin/disputes/:id` | Get dispute details | — | `DisputeResponse` | |
| Admin | POST | `/api/admin/disputes/:id/resolve` | Resolve or reject dispute | `ResolveDisputeRequest` (required) | `ApiSuccess` | Actions: `resolve` / `reject`. Example resolution: `REFUND_CLIENT` |

### Confirmed Schemas

**`CreateDisputeRequest`** (used for both client and provider POST):

```json
{
  "required": ["reason", "description"],
  "properties": {
    "reason": { "type": "string", "minLength": 2, "maxLength": 120 },
    "description": { "type": "string", "minLength": 10, "maxLength": 10000 },
    "evidence": {
      "type": "array",
      "maxItems": 10,
      "items": { "type": "string", "format": "uri" }
    }
  }
}
```

- `reason` is a **free-text string** (2-120 chars) — **not an enum**
- `description` is required (10-10000 chars)
- `evidence` is an optional array of URIs (up to 10 URLs) — client uploads files elsewhere (e.g., Cloudinary) and passes URLs

**`DisputeResponse`** (returned by admin list/detail):

```json
{
  "id": "string",
  "requestId": "string | null",
  "projectId": "string | null",
  "status": "OPEN | UNDER_REVIEW | RESOLVED | REJECTED",
  "reason": "string",
  "description": "string",
  "evidence": ["uri"],
  "resolution": "string | null",
  "resolutionNote": "string | null",
  "createdAt": "date-time",
  "resolvedAt": "date-time | null"
}
```

- **Status enum (confirmed):** `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `REJECTED`
- No `CANCELLED` or `ESCALATED` status
- No `type` field (no distinction between "dispute" and "cancel-by-agreement" at API level)
- No `initiatedBy` field — cannot tell from response if client or provider created it
- No `messages` field — **no dispute conversation/messaging endpoint exists**

**`DisputeListResponse`**:

```json
{
  "items": [DisputeResponse],
  "pagination": Pagination
}
```

**`ResolveDisputeRequest`**:

```json
{
  "required": ["action", "resolution"],
  "properties": {
    "action": { "enum": ["resolve", "reject"] },
    "resolution": "string",
    "resolutionNote": "string"
  }
}
```

Example: `{"action": "resolve", "resolution": "REFUND_CLIENT", "resolutionNote": "..."}`

- `resolution` is a **free-text string** — not an enum, but example uses `REFUND_CLIENT`
- No documented enum of valid resolution values (e.g., `REFUND_CLIENT`, `PAY_PROVIDER`, `SPLIT`, etc.)

### Auth Requirements

- All dispute endpoints require **Bearer token** authentication
- Role enforcement is implicit via URL path (`/client/...`, `/provider/...`, `/admin/...`)

### Missing / Not Provided by Backend

| Missing Endpoint | Impact |
|------------------|--------|
| `GET /client/disputes` or `GET /client/requests/:id/disputes` | **Cannot list a client's disputes**. Client disputes page cannot show real data |
| `GET /provider/disputes` or `GET /provider/requests/:id/disputes` | **Cannot list a provider's disputes**. Provider disputes page cannot show real data |
| `GET /client/disputes/:id` | **No client dispute detail endpoint** |
| `GET /provider/disputes/:id` | **No provider dispute detail endpoint** |
| Dispute messages/conversation (`POST /disputes/:id/messages`) | **No conversation thread** — Swagger has no message endpoints for disputes |
| Dispute attachment upload | **No dedicated dispute upload endpoint** — client must upload elsewhere (Cloudinary?) and pass URIs |
| Escrow freeze on dispute creation | **Not documented** — unclear if `POST /disputes` freezes escrow |
| Provider view/respond to disputes raised against them | **No provider read endpoint** |

---

### Original Backend Questions (Superseded)

Original questions before Swagger investigation:

- **Dispute creation endpoint** — CONFIRMED: `POST /client/requests/:id/disputes` and `POST /provider/requests/:id/disputes`
- **Dispute list endpoint** — CONFIRMED for admin only: `GET /admin/disputes`. **Missing for client and provider**
- **Dispute detail endpoint** — CONFIRMED for admin only: `GET /admin/disputes/:id`. **Missing for client and provider**
- **Provider dispute access** — CONFIRMED: providers CAN create disputes via `POST /provider/requests/:id/disputes`
- **Admin dispute management** — CONFIRMED: `GET /admin/disputes`, `GET /admin/disputes/:id`, `POST /admin/disputes/:id/resolve`. **No admin message endpoint**
- **Dispute messages/conversation** — **NOT SUPPORTED** by current backend
- **Dispute status enum** — CONFIRMED: `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `REJECTED`
- **Dispute reason enum** — **NO ENUM** — reason is a free-text string (2-120 chars)
- **Attachments** — CONFIRMED: `evidence` array of URIs (max 10). No dedicated upload endpoint — client uploads elsewhere first

---

## 4. Proposed Models

```typescript
// src/app/core/models/dispute.model.ts

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'ESCALATED' | 'RESOLVED' | 'CLOSED';
export type DisputeType = 'DISPUTE' | 'CANCEL_BY_AGREEMENT';
export type DisputeReason = 'QUALITY_ISSUE' | 'DELAY' | 'SCOPE_CHANGE' | 'PAYMENT_ISSUE' | 'OTHER';

export interface Dispute {
  id: string;
  type: DisputeType;
  status: DisputeStatus;
  reason: DisputeReason;
  description: string;
  requestId: string;
  projectTitle?: string;
  initiatedBy: 'CLIENT' | 'PROVIDER';
  initiatedByName: string;
  againstName: string;
  amount?: number;
  attachments?: string[];
  messages?: DisputeMessage[];
  aiSuggestion?: string;
  aiSuggestionStatus?: 'pending' | 'ready' | 'approved';
  adminDecision?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface DisputeMessage {
  id: string;
  disputeId: string;
  authorRole: 'CLIENT' | 'PROVIDER' | 'ADMIN' | 'AI';
  authorName: string;
  content: string;
  createdAt: string;
}

export interface CreateDisputePayload {
  type: DisputeType;
  reason: DisputeReason;
  description: string;
  requestId: string;
  attachments?: string[];
}

export interface DisputeListResponse {
  success: boolean;
  data: Dispute[];
  message?: string;
}

export interface DisputeDetailResponse {
  success: boolean;
  data: Dispute;
  message?: string;
}

export interface CreateDisputeResponse {
  success: boolean;
  data: { id: string };
  message?: string;
}
```

> **Note:** These models are proposed. Field names and types need backend confirmation before implementation.

---

## 5. Proposed UI Pages / Components

### 5.1 Create Dispute Modal (Client)

**Purpose:** Modal in ProjectDetails for client to open a dispute.

**UI Elements:**
- Dispute type selector: نزاع / إلغاء بالتراضي
- Reason dropdown: جودة التسليم، تأخير، تغيير النطاق، مشكلة دفع، أخرى
- Description textarea (min 20 chars)
- Optional file attachment URLs
- Submit button with loading state
- Cancel button

**Trigger:** "فتح نزاع" button in ProjectDetails workspace (support actions area)

### 5.2 Dispute Detail Page (Client + Provider shared)

**Purpose:** View dispute details, timeline, AI suggestion, messages, and respond.

**UI Elements:**
- Dispute header: type, status badge, ID
- Timeline: رُفع الطلب → قرار الذكاء → مراجعة الإدارة → الإقفال
- AI suggestion box
- Messages/conversation thread
- Reply input (if dispute is open)
- Escalate button (if applicable)
- Amount in escrow display

### 5.3 Disputes List Page (Replace Mock)

**Purpose:** Replace existing mock data with real API data.

**Changes:**
- Fetch from `GET /client/disputes` or `GET /provider/disputes`
- Loading/error states
- Filter tabs work with real data
- Click dispute card → navigate to dispute detail
- "رفع نزاع جديد" button navigates to project workspace (not toast)

### 5.4 Admin Disputes Management Page (Replace Placeholder)

**Purpose:** Admin can view all disputes, filter, review, and make decisions.

**UI Elements:**
- Disputes table/list with filters (status, type, date, amount)
- Dispute detail view with full conversation
- Admin decision form: approve AI suggestion, override, or manual decision
- Status update actions: escalate, resolve, close
- Admin message input

### 5.5 Provider Dispute Response

**Purpose:** Provider can view disputes raised against them and respond.

**Changes:**
- Replace mock data with real API
- Provider can post messages in dispute conversation
- Provider cannot create disputes (only client initiates, unless backend says otherwise)

---

## 6. Proposed Implementation Chunks

### Chunk 1 — Dispute Models + API Service

**Files to create:**
- `src/app/core/models/dispute.model.ts` (NEW)
- `src/app/core/services/dispute-api.service.ts` (NEW)

**Details:**
- Define all dispute interfaces and types
- Service methods: `getDisputes()`, `getDisputeDetail(id)`, `createDispute(payload)`, `postDisputeMessage(id, content)`, `adminUpdateDispute(id, decision)`

**Dependencies:** None — pure foundation layer

### Chunk 2 — Create Dispute Modal Component

**Files to create:**
- `src/app/pages/dashboard/clients-overview/project/dispute-modal/dispute-modal.ts`
- `src/app/pages/dashboard/clients-overview/project/dispute-modal/dispute-modal.html`
- `src/app/pages/dashboard/clients-overview/project/dispute-modal/dispute-modal.css`

**Details:**
- Standalone component with dispute type, reason, description, attachments
- Input: project/request ID, project title
- Output: dispute created event
- Integrates with `DisputeApiService`

### Chunk 3 — Integrate Dispute CTA in Client ProjectDetails

**Files to modify:**
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts`
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.html`
- `src/app/pages/dashboard/clients-overview/project/project-details/project-details.css`

**Changes:**
- Wire `openSupport('dispute')` to open the new `DisputeModal`
- Add "فتح نزاع" button in workspace UI (support actions area)
- Handle dispute creation success: show toast, optionally navigate to dispute detail
- Also wire `openSupport('cancel')` for cancel-by-agreement if backend supports it

### Chunk 4 — Disputes List Page (Replace Mock with API)

**Files to modify:**
- `src/app/pages/dashboard/clients-overview/disputes/disputes.ts`
- `src/app/pages/dashboard/clients-overview/disputes/disputes.html`
- `src/app/pages/dashboard/provider-overview/disputes/disputes.ts`
- `src/app/pages/dashboard/provider-overview/disputes/disputes.html`

**Changes:**
- Replace hardcoded mock data with API calls
- Add loading/error states
- Wire dispute card click to navigate to dispute detail
- "رفع نزاع جديد" button → navigate to project workspace
- Filter tabs work with real data

### Chunk 5 — Dispute Detail Page (Client + Provider)

**Files to create:**
- `src/app/pages/dashboard/clients-overview/disputes/detail/dispute-detail.ts`
- `src/app/pages/dashboard/clients-overview/disputes/detail/dispute-detail.html`
- `src/app/pages/dashboard/clients-overview/disputes/detail/dispute-detail.css`
- `src/app/pages/dashboard/provider-overview/disputes/detail/dispute-detail.ts` (or shared component)
- `src/app/pages/dashboard/provider-overview/disputes/detail/dispute-detail.html`
- `src/app/pages/dashboard/provider-overview/disputes/detail/dispute-detail.css`

**Route additions:**
- `client.routes.ts`: `disputes/:id` → `DisputeDetail`
- `provider.routes.ts`: `disputes/:id` → `DisputeDetail`

**Changes:**
- Load dispute by ID from API
- Display timeline, AI suggestion, messages
- Allow posting messages (if dispute is open)
- Escalate button (if applicable)

### Chunk 6 — Admin Disputes Management (Replace Placeholder)

**Files to modify:**
- `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.ts`
- `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.html`
- `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.css`

**Changes:**
- Replace placeholder with disputes list from admin API
- Admin can view all disputes, filter by status/type
- Admin dispute detail view with decision form
- Status update: escalate, resolve, close
- Admin message input

### Chunk 7 — Runtime Testing

**Prerequisites:**
- Backend dispute endpoints confirmed and working
- Valid project/request with active contract for creating dispute
- Admin account for admin management testing

---

## 7. Files Likely to Modify (Summary)

| File | Action | Chunk |
|------|--------|-------|
| `src/app/core/models/dispute.model.ts` | CREATE | 1 |
| `src/app/core/services/dispute-api.service.ts` | CREATE | 1 |
| `src/app/pages/dashboard/clients-overview/project/dispute-modal/dispute-modal.ts` | CREATE | 2 |
| `src/app/pages/dashboard/clients-overview/project/dispute-modal/dispute-modal.html` | CREATE | 2 |
| `src/app/pages/dashboard/clients-overview/project/dispute-modal/dispute-modal.css` | CREATE | 2 |
| `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts` | MODIFY | 3 |
| `src/app/pages/dashboard/clients-overview/project/project-details/project-details.html` | MODIFY | 3 |
| `src/app/pages/dashboard/clients-overview/project/project-details/project-details.css` | MODIFY | 3 |
| `src/app/pages/dashboard/clients-overview/disputes/disputes.ts` | MODIFY | 4 |
| `src/app/pages/dashboard/clients-overview/disputes/disputes.html` | MODIFY | 4 |
| `src/app/pages/dashboard/provider-overview/disputes/disputes.ts` | MODIFY | 4 |
| `src/app/pages/dashboard/provider-overview/disputes/disputes.html` | MODIFY | 4 |
| `src/app/pages/dashboard/clients-overview/disputes/detail/dispute-detail.ts` | CREATE | 5 |
| `src/app/pages/dashboard/clients-overview/disputes/detail/dispute-detail.html` | CREATE | 5 |
| `src/app/pages/dashboard/clients-overview/disputes/detail/dispute-detail.css` | CREATE | 5 |
| `src/app/pages/dashboard/provider-overview/disputes/detail/dispute-detail.ts` | CREATE | 5 |
| `src/app/pages/dashboard/provider-overview/disputes/detail/dispute-detail.html` | CREATE | 5 |
| `src/app/pages/dashboard/provider-overview/disputes/detail/dispute-detail.css` | CREATE | 5 |
| `src/app/pages/dashboard/clients-overview/client.routes.ts` | MODIFY | 5 |
| `src/app/pages/dashboard/provider-overview/provider.routes.ts` | MODIFY | 5 |
| `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.ts` | MODIFY | 6 |
| `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.html` | MODIFY | 6 |
| `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.css` | CREATE | 6 |

**Files NOT to touch:**
- Checkout/cart components and services
- Rating components and services (Module 2 — blocked, not modifying)
- Auth/guard files
- Marketplace components
- Unrelated dashboard pages

---

## 8. Safe Implementation Order

1. **Chunk 1** — Models & Service (no UI impact, safe foundation)
2. **Chunk 2** — Create Dispute Modal component (isolated, new files)
3. **Chunk 3** — Integrate dispute CTA in Client ProjectDetails (minimal changes, wires existing stub)
4. **Chunk 4** — Replace disputes list mock with API (modifies existing pages)
5. **Chunk 5** — Dispute detail page (new routes, new components)
6. **Chunk 6** — Admin disputes management (replaces placeholder)
7. **Chunk 7** — Runtime testing (when backend ready)

> **Important:** Chunks 1-3 can proceed without backend if we use the same pattern as Module 2 (implement frontend, test when backend ready). Chunks 4-6 require backend endpoints to be confirmed.

---

## 9. Testing Checklist

### Chunk 1: Models & Service
- [ ] `DisputeApiService.getDisputes()` calls correct endpoint
- [ ] `DisputeApiService.createDispute()` calls correct endpoint with correct payload
- [ ] `DisputeApiService.getDisputeDetail()` calls correct endpoint
- [ ] Error handling: API returns error → service propagates error

### Chunk 2: Create Dispute Modal
- [ ] Dispute type selector works (نزاع / إلغاء بالتراضي)
- [ ] Reason dropdown populates correctly
- [ ] Description textarea validates min length
- [ ] Submit button: disabled while saving
- [ ] Submit success: emits event, closes modal
- [ ] Submit error: shows error message
- [ ] Cancel/close: closes modal without submitting
- [ ] RTL layout correct

### Chunk 3: Client ProjectDetails Integration
- [ ] "فتح نزاع" button visible in workspace
- [ ] Clicking button opens dispute modal
- [ ] Dispute creation success: toast shows, modal closes
- [ ] Existing stage review flow still works (no regression)
- [ ] Existing tabs still work
- [ ] Existing rating flow still works (no regression)

### Chunk 4: Disputes List (API)
- [ ] Page loads and fetches disputes from API
- [ ] Loading state shows while fetching
- [ ] Error state shows on API failure with retry button
- [ ] Filter tabs work with real data
- [ ] Clicking dispute card navigates to detail page
- [ ] "رفع نزاع جديد" navigates to project workspace
- [ ] Empty state shows when no disputes

### Chunk 5: Dispute Detail Page
- [ ] Page loads dispute by ID from API
- [ ] Timeline displays correctly
- [ ] AI suggestion box shows when available
- [ ] Messages/conversation thread displays
- [ ] Reply input works (if dispute is open)
- [ ] Escalate button works (if applicable)
- [ ] Back navigation to disputes list

### Chunk 6: Admin Disputes Management
- [ ] Admin can view all disputes
- [ ] Admin can filter by status/type
- [ ] Admin can view dispute detail with full conversation
- [ ] Admin can post messages
- [ ] Admin can update dispute status (resolve, close, escalate)
- [ ] Admin can approve/override AI suggestion

### Cross-Cutting
- [ ] No checkout/cart functionality broken
- [ ] No rating functionality broken (Module 2)
- [ ] No auth/guard functionality broken
- [ ] Build passes (`ng build`)
- [ ] No console errors on page load
- [ ] RTL layout maintained throughout
- [ ] Mobile responsive for all new components

---

## 10. Backend Questions

1. **Dispute creation endpoint:** Is it `POST /client/requests/:id/disputes` or `POST /client/disputes` with `requestId` in body?
2. **Dispute list endpoint:** Is it `GET /client/disputes` or `GET /disputes?role=client`?
3. **Provider dispute creation:** Can providers create disputes, or only clients? The mock UI shows "رفع نزاع جديد" for both.
4. **Dispute statuses:** What enum values does the backend use? (OPEN, UNDER_REVIEW, ESCALATED, RESOLVED, CLOSED?)
5. **Dispute reasons:** What are the valid reason values? Are they enum or free text?
6. **Dispute types:** Is there a distinction between "نزاع" (dispute) and "إلغاء بالتراضي" (cancel by agreement)?
7. **AI suggestion:** Does the backend automatically generate AI suggestions? What field names are used?
8. **Dispute messages:** Is there a separate messages endpoint or are messages embedded in the dispute detail response?
9. **Attachments:** Can disputes include file attachments? What upload endpoint is used?
10. **Admin actions:** What actions can admin take? (close, refund, escalate, override AI, post message)
11. **Escrow interaction:** Does creating a dispute freeze escrow? Does closing a dispute release/refund escrow?
12. **Provider access:** Can providers see all disputes involving them? What endpoint?
13. **Pagination:** Are dispute lists paginated?

---

## 11. What Dispute Flow Already Exists

### Summary:
- **Routes exist** for client, provider, and admin disputes pages
- **Client and provider disputes pages** are fully designed UI with mock data — no API calls
- **Admin disputes page** is a placeholder ("قيد التطوير")
- **ProjectDetails** has stub code for `SupportAction` type and `openSupport()`/`closeSupport()` methods, but these are **not wired to the template**
- **No dispute service** exists — no API methods for creating, listing, or managing disputes
- **No dispute models** exist — only `DISPUTED` status in `ProjectStatus` type
- **No dispute detail page** exists — no route, no component
- **No create dispute form/modal** exists — only a toast message saying "سيُتاح رفع النزاع من صفحة متابعة المشروع مباشرة"

### What's Missing:
1. Dispute API service (no backend calls exist)
2. Dispute models/types
3. Create dispute modal/form
4. Dispute CTA wired in ProjectDetails template
5. Dispute detail page (view + respond)
6. Admin dispute management (placeholder only)
7. Real API data replacing mock data in list pages

---

## 12. Safe to Proceed

**YES** — safe to proceed with Chunk 1 (models + service) and Chunk 2 (create dispute modal) as these are new isolated files with no risk of regression.

**Conditional:** Chunks 3-6 require backend endpoint confirmation before implementation to avoid building against wrong API contracts.

**Recommended approach:** Start with Chunk 1, then Chunk 2. Pause before Chunk 3 to confirm backend endpoints.

---

## 13. Revised Plan Based on Confirmed Swagger

### 13.1 Revised Models (Match Swagger Exactly)

```typescript
// src/app/core/models/dispute.model.ts

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'REJECTED';
export type DisputeResolveAction = 'resolve' | 'reject';

export interface CreateDisputePayload {
  reason: string;        // 2-120 chars, free-text
  description: string;   // 10-10000 chars
  evidence?: string[];   // optional array of URIs, max 10
}

export interface Dispute {
  id: string;
  requestId: string | null;
  projectId: string | null;
  status: DisputeStatus;
  reason: string;
  description: string;
  evidence: string[];
  resolution: string | null;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DisputeListResponse {
  items: Dispute[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ResolveDisputePayload {
  action: DisputeResolveAction;
  resolution: string;
  resolutionNote?: string;
}
```

> **Removed from original proposal:** `DisputeType`, `DisputeReason` enum, `DisputeMessage`, `initiatedBy`, `messages`, `aiSuggestion` — none of these exist in the backend.

### 13.2 Revised Chunk 1 (Swagger-Aligned)

**Files to create:**

- `src/app/core/models/dispute.model.ts`
- `src/app/core/services/dispute-api.service.ts`

**Service methods (aligned with confirmed endpoints):**

```typescript
class DisputeApiService {
  // Client
  createClientDispute(requestId: string, payload: CreateDisputePayload):
    Observable<ApiSuccess>;
    // POST /api/client/requests/:id/disputes

  // Provider
  createProviderDispute(requestId: string, payload: CreateDisputePayload):
    Observable<ApiSuccess>;
    // POST /api/provider/requests/:id/disputes

  cancelProviderRequest(requestId: string, body?: any):
    Observable<ApiSuccess>;
    // POST /api/provider/requests/:id/cancel

  // Admin
  listAdminDisputes(params?: { status?: DisputeStatus; page?: number; limit?: number }):
    Observable<{ success: boolean; data: DisputeListResponse }>;
    // GET /api/admin/disputes

  getAdminDispute(id: string):
    Observable<{ success: boolean; data: Dispute }>;
    // GET /api/admin/disputes/:id

  resolveAdminDispute(id: string, payload: ResolveDisputePayload):
    Observable<ApiSuccess>;
    // POST /api/admin/disputes/:id/resolve
}
```

### 13.3 Revised Chunk Order Based on Swagger

| Chunk | Scope | Feasible with current backend? |
|-------|-------|-------------------------------|
| 1 | Dispute models + API service | **YES** — all endpoints confirmed |
| 2 | Create dispute modal (shared client/provider) | **YES** — uses `POST /client/requests/:id/disputes` |
| 3 | Wire "فتح نزاع" CTA in client `ProjectDetails` | **YES** — calls confirmed create endpoint |
| 4a | Wire "فتح نزاع" CTA in provider `progress.ts` | **YES** — calls confirmed create endpoint |
| 4b | Replace client/provider disputes list mock with API | **NO** — no `GET /client/disputes` or `GET /provider/disputes` exists. **Blocked** |
| 5 | Client/provider dispute detail page | **NO** — no `GET /:role/disputes/:id` exists. **Blocked** |
| 6 | Admin disputes management (list + detail + resolve) | **YES** — all admin endpoints confirmed |
| 7 | Runtime testing | Depends on backend readiness |

### 13.4 Feasibility Summary

**Can implement now (Swagger-confirmed):**

- Chunk 1: Models + service
- Chunk 2: Create dispute modal
- Chunk 3: Wire client create dispute CTA
- Chunk 4a: Wire provider create dispute CTA
- Chunk 6: Admin disputes management (list, detail, resolve)

**Blocked pending backend endpoints:**

- Chunk 4b: Client and provider disputes LIST pages — no `GET` endpoint for their own disputes
- Chunk 5: Client and provider dispute DETAIL pages — no `GET` endpoint
- Dispute conversation/messages — no message endpoints exist
- Provider view of disputes raised against them — no read endpoint

### 13.5 Updated Backend Questions

1. **Client dispute list** — Is there a `GET /client/disputes` or `GET /client/requests/:id/disputes` planned? Currently only `POST` exists.
2. **Provider dispute list** — Same question for provider role.
3. **Dispute detail (non-admin)** — Will `GET /client/disputes/:id` and `GET /provider/disputes/:id` be added?
4. **Dispute conversation** — Is a messages/chat feature planned for disputes? Currently no message endpoints.
5. **Resolution values** — What are the valid values for `resolution` in `ResolveDisputeRequest`? Example shows `REFUND_CLIENT` — is there `PAY_PROVIDER`, `SPLIT_REFUND`, etc.?
6. **Escrow on dispute** — Does `POST /disputes` automatically freeze escrow? Does `POST /disputes/:id/resolve` release/refund escrow based on `resolution` value?
7. **Evidence upload endpoint** — Where should the frontend upload evidence files? Is `/api/client/my-requests/upload` or `/api/chat/upload` reusable, or is a dispute-specific upload endpoint planned?
8. **Cancel vs Dispute** — What is the semantic difference between `POST /provider/requests/:id/cancel` and `POST /provider/requests/:id/disputes`? Which should be used for "إلغاء بالتراضي"?
9. **Duplicate routes** — Is `/api/client/my-requests/:id/disputes` deprecated in favor of `/api/client/requests/:id/disputes`?

### 13.6 Revised Recommended Chunk 1

**Scope:** Create `dispute.model.ts` and `dispute-api.service.ts` with all 6 confirmed endpoints (2 client, 2 provider, 3 admin — the client/provider create + provider cancel + admin list/detail/resolve).

**Files:**

- `src/app/core/models/dispute.model.ts` (NEW)
- `src/app/core/services/dispute-api.service.ts` (NEW)

**Depends on:** None. Pure foundation, zero regression risk.

**Verification:** `ng build` passes; unit test not required for pure interface files.

### 13.7 Safe to Proceed: **YES**

- Chunks 1, 2, 3, 4a, 6 can proceed with confirmed Swagger endpoints
- Chunk 4b and Chunk 5 must be **deferred** or replaced with a placeholder "Disputes list is coming soon" until backend adds `GET` endpoints for client/provider disputes
- Admin management (Chunk 6) is fully feasible today

**Recommended immediate next step:** Implement Chunk 1 (models + service).
