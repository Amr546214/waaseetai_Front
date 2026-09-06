# Phase 1 — Module 4: Withdrawals / Finance / السحوبات
## Chunk 0: Investigation & Implementation Plan

---

## 1. Existing Frontend Components

### Provider Finance (already wired to backend)

| Component | Path | API Endpoint | Status |
|-----------|------|-------------|--------|
| **Provider Wallet** | `provider-overview/finance/wallet/wallet.ts` | `GET /api/provider/finance/wallet` | ✅ Connected, loads wallet summary + transactions + escrows |
| **Provider Transactions** | `provider-overview/finance/transactions/transactions.ts` | `GET /api/provider/finance/transactions` | ✅ Connected, loads summary + events, supports filtering & CSV export |
| **Provider Withdraw** | `provider-overview/finance/withdraw/withdraw.ts` | ❌ No API call | ⚠️ UI-only, mock data, no backend integration |

### Provider Banking Info

| Component | Path | API Endpoint | Status |
|-----------|------|-------------|--------|
| **Provider Profile — Banking Tab** | `provider-overview/profile/data/data.ts` | `PUT /api/profiles/update/:tabName` (tabName=`banking`) | ✅ Connected via profile update flow |

### Client Finance (already wired to backend)

| Component | Path | API Endpoint | Status |
|-----------|------|-------------|--------|
| **Client Finance Service** | `core/services/client-finance.service.ts` | `GET /api/client/finance/wallet`, `GET /api/client/finance/invoices`, `GET /api/client/finance/invoices/:id`, `POST /api/client/finance/deposit/init`, `POST /api/client/finance/deposit/verify` | ✅ Full service |

### Marketer Finance (already wired to backend)

| Component | Path | API Endpoint | Status |
|-----------|------|-------------|--------|
| **Marketer Profile Service** | `core/services/marketer-profile.service.ts` | `PATCH /api/marketer/profile/bank-info`, `POST /api/marketer/profile/requests/:id/withdraw` | ✅ Bank info update + withdraw request |

### Admin Withdrawals

| Component | Path | API Endpoint | Status |
|-----------|------|-------------|--------|
| **Admin Withdrawals** | `supper-admin-overview/sa-withdrawals/sa-withdrawals.ts` | ❌ None | ⚠️ Placeholder page — "قيد التطوير" |

### Admin Finance Service

- **No dedicated admin finance/withdrawal API service exists yet.**
- Pattern to follow: `core/services/dispute-api.service.ts` (DisputeApiService) — uses `environment.url_api` + HttpClient.

---

## 2. Backend Endpoints (Confirmed from Swagger)

### Admin Withdrawals Endpoints

| Method | Path | Auth | Params | Request Body | Response | Notes |
|--------|------|------|--------|-------------|----------|-------|
| **GET** | `/api/admin/withdrawals` | bearerAuth | `status` (query, optional string), `page` (query, optional int, default 1), `limit` (query, optional int, default 20, max 100) | — | `ApiSuccess` + `WithdrawalListResponse` | List all withdrawal requests with pagination |
| **GET** | `/api/admin/withdrawals/:id` | bearerAuth | `id` (path, string) | — | `ApiSuccess` + `WithdrawalResponse` | Get single withdrawal detail |
| **POST** | `/api/admin/withdrawals/:id/approve` | bearerAuth | `id` (path, string) | `ApproveWithdrawalRequest` (optional): `{ adminNote?: string }` — example: `{ "adminNote": "تمت مراجعة البيانات البنكية" }` | `ApiSuccess` + `WithdrawalResponse` | Approve a withdrawal request |
| **POST** | `/api/admin/withdrawals/:id/reject` | bearerAuth | `id` (path, string) | `RejectWithdrawalRequest` (required): `{ rejectionReason: string }` — example: `{ "rejectionReason": "البيانات البنكية غير مكتملة" }` | `ApiSuccess` + `WithdrawalResponse` | Reject a withdrawal request |

### Provider Finance Endpoints

| Method | Path | Auth | Params | Response | Notes |
|--------|------|------|--------|----------|-------|
| **GET** | `/api/provider/finance/wallet` | bearerAuth | — | `ApiSuccess` (wallet summary + transactions + escrows) | Already used by Provider Wallet component |
| **GET** | `/api/provider/finance/transactions` | bearerAuth | — | `ApiSuccess` (summary + events array) | Already used by Provider Transactions component |

### Client Finance Endpoints (already integrated)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| **GET** | `/api/client/finance/wallet` | bearerAuth | Client wallet summary + transactions |
| **GET** | `/api/client/finance/invoices` | bearerAuth | Client invoices list |
| **GET** | `/api/client/finance/invoices/:id` | bearerAuth | Single invoice |
| **POST** | `/api/client/finance/deposit/init` | bearerAuth | Initiate deposit — body: `{ amount, paymentMethod }` |
| **POST** | `/api/client/finance/deposit/verify` | bearerAuth | Verify deposit — body: `{ paymentId, amount?, paymentMethod?, description? }` |

### Marketer Finance Endpoints (already integrated)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| **PATCH** | `/api/marketer/profile/bank-info` | bearerAuth | Update bank info — body: `{ bankName?, accountHolderName?, iban?, swiftCode? }` |
| **POST** | `/api/marketer/profile/requests/:id/withdraw` | bearerAuth | Withdraw request for marketer commission |

---

## 3. Schema Gaps in Swagger

The following schemas are **referenced** in the Swagger spec but **not defined** in the `components.schemas` section:

| Schema Name | Referenced In | Impact |
|-------------|--------------|--------|
| `WithdrawalListResponse` | GET `/api/admin/withdrawals` response | Unknown structure — need to infer from API response or backend code |
| `WithdrawalResponse` | GET `/api/admin/withdrawals/:id`, POST approve/reject responses | Unknown structure — need to infer |
| `ApproveWithdrawalRequest` | POST `/api/admin/withdrawals/:id/approve` request body | Partially known from example: `{ adminNote?: string }` |
| `RejectWithdrawalRequest` | POST `/api/admin/withdrawals/:id/reject` request body | Partially known from example: `{ rejectionReason: string }` |

### Inferred Models (based on Swagger examples + domain knowledge)

```typescript
// Withdrawal item (inferred)
interface Withdrawal {
  id: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  method: string;
  bankInfo?: {
    bankName?: string;
    accountHolderName?: string;
    iban?: string;
    swiftCode?: string;
  };
  adminNote?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  processedAt?: string;
}

// Withdrawal list response (inferred)
interface WithdrawalListResponse {
  withdrawals: Withdrawal[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Approve withdrawal request
interface ApproveWithdrawalRequest {
  adminNote?: string;
}

// Reject withdrawal request
interface RejectWithdrawalRequest {
  rejectionReason: string;
}
```

---

## 4. Missing Endpoints / Backend Gaps

| Gap | Impact | Workaround |
|-----|--------|-----------|
| **No `POST /api/provider/finance/withdraw`** | Provider withdraw page has no backend endpoint to submit withdrawal requests | Provider withdraw UI exists but cannot submit. Need backend endpoint or use admin withdrawals flow. |
| **No `GET /api/provider/finance/withdrawals`** | Provider cannot list their own withdrawal requests/history | No provider-side withdrawal history available. |
| **No `GET /api/client/finance/withdrawals`** | Client cannot list their own withdrawal requests | Not critical for Phase 1 — client deposits are the primary flow. |
| **Swagger schemas undefined** for withdrawal responses | Frontend cannot strongly type API responses | Use inferred models above; verify against actual API responses during testing. |
| **No `GET /api/admin/finance/overview`** | No admin finance dashboard/summary endpoint | Not critical for Phase 1 — admin withdrawals list is the primary need. |

---

## 5. Recommended Implementation Chunks

### Chunk 1: Admin Withdrawals API Service + Models
- Create `core/models/withdrawal.model.ts` with TypeScript interfaces (Withdrawal, WithdrawalListResponse, ApproveWithdrawalRequest, RejectWithdrawalRequest, API response types).
- Create `core/services/withdrawal-api.service.ts` with methods:
  - `getAdminWithdrawals(query?: { status?, page?, limit? }): Observable<WithdrawalListApiResponse>`
  - `getAdminWithdrawal(id: string): Observable<WithdrawalApiResponse>`
  - `approveAdminWithdrawal(id: string, payload?: { adminNote?: string }): Observable<WithdrawalApiResponse>`
  - `rejectAdminWithdrawal(id: string, payload: { rejectionReason: string }): Observable<WithdrawalApiResponse>`
- Follow the pattern from `DisputeApiService`.

### Chunk 2: Admin Withdrawals List Page
- Replace placeholder `sa-withdrawals.html` with full list UI:
  - Status filter tabs (all / pending / approved / rejected / completed).
  - Table/cards with withdrawal details (user, amount, method, status, date).
  - Pagination controls.
  - Loading, error, and empty states.
  - Click to open detail modal.
- Wire to `WithdrawalApiService.getAdminWithdrawals()`.

### Chunk 3: Admin Withdrawal Detail Modal + Approve/Reject Actions
- Detail modal showing full withdrawal info (user, amount, bank info, dates, status).
- Approve button with optional `adminNote` input.
- Reject button with required `rejectionReason` textarea.
- Validation, loading states, success/error messages.
- Refresh list and detail on successful action.
- Follow the same pattern as admin disputes resolve/reject UI.

### Chunk 4: Provider Withdraw — Connect to Backend (if endpoint available)
- Currently the provider withdraw page (`withdraw.ts`) is entirely mock.
- **Blocked by missing `POST /api/provider/finance/withdraw` endpoint.**
- If backend adds the endpoint:
  - Create `providerFinanceWithdraw(amount, method, bankInfo?)` in a new `ProviderFinanceService` or inline.
  - Wire the withdraw form to submit real API call.
  - Replace mock `confirmWithdraw()` with actual API call + success/error handling.
- If endpoint remains unavailable, leave UI as-is with a disabled state or informational message.

### Chunk 5: Provider Withdrawal History (if endpoint available)
- **Blocked by missing `GET /api/provider/finance/withdrawals` endpoint.**
- Add a withdrawal history tab or section to the provider wallet/transactions page.
- Show list of provider's own withdrawal requests with status.

---

## 6. Manual Testing Checklist

### Admin Withdrawals (Chunks 1-3)
- [ ] Navigate to `/admin/withdrawals` — page loads, fetches withdrawal list from API.
- [ ] Verify loading state shows while fetching.
- [ ] Verify error state shows on API failure with Arabic message.
- [ ] Verify empty state shows when no withdrawals exist.
- [ ] Click status filter tabs — list updates with correct filter.
- [ ] Verify pagination works (next/prev page, page count).
- [ ] Click a withdrawal row — detail modal opens with full info.
- [ ] Click Approve — inline form with optional adminNote appears.
- [ ] Submit approve — loading state, success message, list refreshes.
- [ ] Click Reject — inline form with required rejectionReason appears.
- [ ] Try submitting reject without reason — validation error in Arabic.
- [ ] Submit reject with reason — loading state, success message, list refreshes.
- [ ] Verify approve/reject buttons hidden for already-processed withdrawals.
- [ ] Verify duplicate submit prevention (button disabled while loading).

### Provider Withdraw (Chunk 4 — if backend endpoint available)
- [ ] Navigate to `/provider-overview/finance/withdraw` — page loads.
- [ ] Verify balance loads from wallet API.
- [ ] Enter amount, select method, accept terms.
- [ ] Click withdraw — OTP modal or API call triggers.
- [ ] Verify success state on successful withdrawal.
- [ ] Verify error message on API failure.

### Provider Withdrawal History (Chunk 5 — if backend endpoint available)
- [ ] Navigate to provider transactions or wallet page.
- [ ] Verify withdrawal history section loads.
- [ ] Verify status badges show correctly (pending/approved/rejected/completed).

---

## 7. Routes Summary

### Admin Routes (existing)
- `/admin/withdrawals` → `SaWithdrawals` component (currently placeholder)

### Provider Routes (existing)
- `/provider-overview/finance/wallet` → `Wallet` component (✅ connected)
- `/provider-overview/finance/withdraw` → `Withdraw` component (⚠️ mock only)
- `/provider-overview/finance/transactions` → `Transactions` component (✅ connected)

### Client Routes (existing — no changes needed for Phase 1)
- Client finance handled by `ClientFinanceService` — deposit/init, deposit/verify, wallet, invoices.

---

## 8. Dependencies & Patterns

- **API Service Pattern**: Follow `DisputeApiService` at `core/services/dispute-api.service.ts`.
- **Models Pattern**: Follow `core/models/dispute.model.ts`.
- **Component Pattern**: Follow `SaDisputes` at `supper-admin-overview/sa-disputes/` for admin list + detail modal + approve/reject actions.
- **Environment**: All services use `environment.url_api` as base URL.
- **Auth**: All admin endpoints require `bearerAuth` (JWT).
- **RTL/Arabic UI**: All text in Arabic, follow existing dashboard styling conventions.
