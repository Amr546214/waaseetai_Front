# Backend-Blocked / Feature Not Implemented — Tracking

Frontend issues confirmed to require backend work before they can be made functional. Do not attempt frontend-only fixes for these; log any duplicate QA reports against this list instead.

---

## Affiliate/Marketer withdrawal flow

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED
**Page:** `/marketer-overview/withdraw` (`src/app/pages/dashboard/marketer-overview/withdraw/`)
**Reported:** QA sheet — "زر تاكيد طلب السحب مش شغال" (confirm withdrawal button doesn't work)

**Reason:** The Affiliate/Marketer withdrawal flow has no real backend endpoint yet. The "تأكيد طلب السحب" button is intentionally `disabled` with a "قيد التفعيل قريباً" (coming soon) tooltip, and the withdrawal history shown on the page is mock data (see the component's own comment: "Mock data for withdrawals since the backend endpoint is not yet implemented"). This is deliberate and safer than exposing a non-functional action — confirmed by comparing against the Provider role's withdraw flow, which IS fully wired to a real backend via `WithdrawalApiService` (`/api/provider/finance/wallet`, `/api/provider/finance/withdrawals` GET/POST). No equivalent `/api/affiliate/...` or `/api/marketer/...` routes exist in that service.

**Missing backend requirements before this can be made functional:**
- Affiliate/Marketer wallet/balance endpoint (equivalent to `GET /api/provider/finance/wallet`)
- Affiliate/Marketer withdrawal history endpoint (equivalent to `GET /api/provider/finance/withdrawals`)
- Affiliate/Marketer create-withdrawal-request endpoint (equivalent to `POST /api/provider/finance/withdrawals`)
- Real commission/referral write-side integration must exist first — withdrawals aren't meaningful until actual commission balances are tracked server-side for this role.

**Frontend action taken:** None. UI left unchanged (disabled button + mock history), per explicit instruction.

---

## Affiliate/Marketer referral campaign message

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED
**Page:** `/marketer-overview/profile/data` — "بيانات الاحالة" tab (`src/app/pages/dashboard/marketer-overview/profile/data/`)
**Reported:** QA — "حفظ بيانات الاحالة ده مش شغال" (save referral data button doesn't work)

**Reason:** The "حفظ بيانات الاحالة" button is intentionally `disabled` with a "قريباً" (coming soon) tooltip. The referral code and full referral link on this tab ARE real and functional (`profile().referralSlug`, backed by the real profile API, with working copy-to-clipboard buttons) — only the custom "وصف الحملة / رسالة الاحالة" (campaign description / referral message) field is affected. That `<textarea>` has no `formControlName` at all — it isn't wired to any form, so there is nowhere in the frontend for its value to even be held. Checked `MarketerProfileService` in full: it has no method for updating referral/campaign data (`updateMarketingInfo`, `addChannel`, `removeChannel`, `updateBankInfo` exist; nothing referral-related beyond the read-only `referralSlug` field).

**Missing backend requirements before this can be made functional:**
- Affiliate/Marketer endpoint to persist a custom referral campaign message/description (e.g. `PATCH /api/marketer/profile/referral-info` or similar), returned alongside `referralSlug` in the profile response.

**Frontend action taken:** None. UI left unchanged (disabled button, unbound textarea), per explicit instruction.
