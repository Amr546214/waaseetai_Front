# Backend-Blocked / Feature Not Implemented — Tracking

Frontend issues confirmed to require backend work before they can be made functional. Do not attempt frontend-only fixes for these; log any duplicate QA reports against this list instead.

---

## Client + Provider — "تذاكر الدعم" (support tickets) preview on the main Help page was 100% fabricated

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED (no ticket backend exists at all)
**Pages:** `clients-overview/help/help.html`, `provider-overview/help/help.html`
**Found via:** QA report — the "تذاكر الدعم" preview block on both main help pages showed identical hardcoded ticket cards (`TK-4821` "تأخر الإفراج عن مبلغ الضمان", `TK-4815` "توضيح مطلوب لإكمال تسوية رصيد") with fixed titles, categories, status pills and relative timestamps ("قبل ساعتين"/"أمس") baked directly into the template, regardless of the signed-in user's actual ticket history — nothing in `help.ts` (either role) ever populated this data.

**Investigation — confirmed no ticket backend exists anywhere in the app:**
- Grepped `src/app/core/services/` and the whole `src/app` tree for `SupportTicketService`, `HelpTicketService`, `TicketService` — zero matches. No such service was ever created.
- `clients-overview/help/tickets/tickets.ts` and `provider-overview/help/tickets/tickets.ts` (the full tickets-list pages) both inject nothing (no `HttpClient`/service) and render from a local hardcoded `Ticket[]` array literal (the same `TK-4821`/`TK-4815`/... IDs the help-page preview echoed) — these are 100% mock, not a real listing endpoint.
- `clients-overview/help/ticket-detail/ticket-detail.ts` and `provider-overview/help/ticket-detail/ticket-detail.ts` both explicitly comment `// Simulate loading from API — replace with real API call when backend supports tickets`, confirming this is a known, deliberate "no tickets backend yet" state across both roles, not an oversight limited to the help-page preview.

**Frontend action taken:** Since there is no real endpoint to source even one honest "recent ticket" from, and the tickets-list page itself is also mock (so linking to it doesn't yield a genuine per-user preview either), fabricated per-ticket preview cards were removed from both `help.html` files. Each was replaced with a single generic, honest CTA card (matching the existing `.tk-card`/`.tk-ttl` styling and the codebase's established honest-placeholder convention, e.g. `request-details.ts`'s "غير متاح" for missing real values) that reads "تصفّح تذاكر الدعم الخاصة بك" and links to `/{role}-overview/help/tickets`, instead of implying it previews the user's real ticket history. The "عرض الكل" header link (already pointing at the same tickets-list route) was left unchanged.

**Missing backend requirements before a real preview can be built:**
- A ticket-listing endpoint (e.g. `GET /api/{client|provider}/support/tickets`) returning the current user's own tickets (id, title, category, status, createdAt/updatedAt) — needed both for the tickets-list page (`tickets.ts`, currently mock in both roles) and to source a genuine "1-2 most recent" preview on the main help page.
- A ticket-detail endpoint (`GET /api/{client|provider}/support/tickets/:id`) — `ticket-detail.ts` in both roles already has a "simulate loading" stub ready to be swapped for the real call.
- Once these exist, the help-page preview cards should be wired to show the user's real most-recent 1-2 tickets, or an honest "لا توجد تذاكر بعد" empty state if they have none.

---

## Provider — company-mode (`PROVIDER_COMPANY`) wallet & withdraw pages had zero company branching

**Status:** FRONTEND BUILT AGAINST THE REAL WALLET/WITHDRAW ENDPOINTS — 2 NEW OPTIONAL FIELDS NOT YET POPULATED BY BACKEND
**Pages:** `provider-overview/finance/wallet` (`wallet.ts`/`.html`/`.css`), `provider-overview/finance/withdraw` (`withdraw.ts`/`.html`/`.css`)
**Found via:** Company-provider-mode design audit (`P-CO-FN-001`/`002`/`004` vs the individual `P-PR-014`/`015`) — both pages showed "محفظتي"/individual copy verbatim for `PROVIDER_COMPANY` accounts, unlike the client side's already-built company wallet.

**What was built (real data where the field already exists on `GET /provider/finance/wallet`, new optional fields otherwise):**
- `wallet.ts`/`.html`: added `isCompany()` (`AuthStore`/`AccountType.PROVIDER_COMPANY`), title/subtitle swap ("محفظة الشركة"), AI-disclosure text swap, deposit button label ("شحن رصيد"), and a company-only side stat card ("إجمالي إيرادات الشركة") — this card uses the **already-real** `summary.totalEarnings`/`summary.releasedThisMonth` fields, no new backend work needed for it.
- New **optional** fields added to `WalletData`/`WalletTransaction` in `wallet.ts` (provider): `providerSpending?: ProviderWalletProviderSpend[]` (per-provider revenue breakdown — name/specialty/projectsCount/revenue, feeds the company-only "أداء مقدمي الخدمة" panel) and `WalletTransaction.providerName?` (feeds the company-only "المقدم" transaction-table column). Both render correctly against real data but currently show empty/`—` since the backend doesn't send them yet — the panel only renders `@if (providerSpending().length)`, matching the client wallet's `employeeSpending` precedent exactly.
- `withdraw.ts`/`.html`: added `isCompany()`, breadcrumb/header/AI-disclosure copy swap, and a company-only OTP confirmation step before submit ("تأكيد طلب السحب" — "أرسلنا رمز التحقق إلى جوال الشركة", masked from the real `AuthStore` `phoneNumber`, never a fabricated number). **No OTP request/verify endpoint exists on the backend at all** (individual mode has no OTP step either, despite both design mockups showing one) — this is a UI-only client-side code-length gate (4-6 digits, not actually verified server-side) that, once passed, calls the real `submitProviderWithdrawal()` endpoint exactly as the individual flow already does directly.

**Missing backend requirements before this is fully real:**
- `GET /provider/finance/wallet` needs to return `providerSpending[]` (per-provider revenue for the current period) for `PROVIDER_COMPANY` accounts, and ideally a `providerName` per transaction.
- A real OTP request/verify pair (e.g. `POST /provider/finance/withdrawals/otp/request` + `.../otp/verify`) if server-side verification of the company withdrawal is actually required — today it's enforced only in the UI.

**Frontend action taken:** Both pages build clean (`ng build --configuration production`, zero errors) and keep working exactly as before for `PROVIDER_INDIVIDUAL` accounts (all new sections gated behind `isCompany()`).

---

## Provider — 8 "company/" pages (`src/app/pages/dashboard/provider-overview/company/`) are 100% decorative mock

**Status:** FRONTEND BUILT, VISUALLY MATCHES DESIGN — ZERO BACKEND INTEGRATION
**Pages:** `company/team-management`, `company/roles-permissions`, `company/incoming-requests`, `company/sales-stats`, `company/change-orders`, `company/official-invoices`, `company/company-models`, `company/team-deliveries`
**Found via:** Company-provider-mode design audit (`P-CO-TM-*`/`P-CO-MK-*`/`P-CO-PR-008`/`P-CO-FN-005` design codes) — content/layout matches the design section-for-section, but every one of these 8 components injects zero services (confirmed: no `HttpClient`/`inject(...Service)` anywhere in any of the 8 `.ts` files). All data is hardcoded array literals; buttons like "دعوة موظف" (invite), "حفظ الصلاحيات" (save permissions), "إسناد لمقدم" (assign), approve/reject on change-orders, etc. don't persist anything — they update local component state only, or do nothing.

**What each page needs (interface names as already defined client-side, for reference when shaping the response):**
- `team-management` — `TeamMember[]` list (provider/staff roster, KPI counts, spec/availability filters) + a working invite-member write endpoint.
- `roles-permissions` — `RoleInfo[]` + `PermissionCategory[]`/`PermissionItem[]` (role definitions, granted permissions per role) + a save-permissions write endpoint.
- `incoming-requests` — `IncomingRequest[]` + `TeamMember[]` (requests routed to the company, with a real "assign to team member" write endpoint — this is the one place in company-provider mode where a "which team member" picker is legitimate, since it's admin-initiated routing, not the fabricated self-assignment pattern that was removed from `explore-requests`/`applay-request`).
- `sales-stats` — `TopModel[]`, `MonthlyBar[]`, `FunnelRow[]`, `TeamPerf[]` (revenue chart, conversion funnel, top-models table, per-provider team performance).
- `change-orders` — `ChangeOrder[]` list + approve/reject write endpoints.
- `official-invoices` — `Invoice[]` list (company-issued formal invoices — KPIs, tabs, table).
- `company-models` — `CompanyModelCard[]` (the company's submitted business-model listings).
- `team-deliveries` — `CompanyDelivery[]` (a cross-project log of deliveries submitted by team members — P-CO-PR-004 "سجل تسليمات الفريق"). This route was also orphaned (no inbound link anywhere in the app) until this pass added a link to it from the project workspace page — see the company-provider-mode entry below for that fix.

**Frontend action taken:** None beyond what already existed — these pages were left as realistic-looking mock per the established session workflow (audit + document now, build real endpoints later, then remove mock data). No fake HTTP calls were added; each page still renders instantly from its local mock array with no loading/error state (there being no request to fail).

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

**Frontend action taken (update):** The withdrawal history table previously rendered 3 hardcoded mock rows (`{ id: '1', ..., account: 'بنك الراجحي', status: 'COMPLETED' }` etc.) presented as if they were the affiliate's real transaction history — this was fabricated data shown as real, not just a disabled action, so it has been corrected: `withdrawals` in `withdraw.ts` is now a real but empty, typed `WithdrawalLog[]`, and the page's existing empty-state block (icon + text) now renders honestly ("لا توجد عمليات سحب مسجّلة بعد") instead of fake rows. The "محجوز"/"إجمالي السحوبات" stat cards remain hardcoded `0` — there's no wallet/balance endpoint to compute them from either (see missing requirements above), and `0` is the honest default for an unknown/unavailable balance. The disabled submit button is unchanged.

---

## Affiliate/Marketer referral campaign message

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED
**Page:** `/marketer-overview/profile/data` — "بيانات الاحالة" tab (`src/app/pages/dashboard/marketer-overview/profile/data/`)
**Reported:** QA — "حفظ بيانات الاحالة ده مش شغال" (save referral data button doesn't work)

**Reason:** The "حفظ بيانات الاحالة" button is intentionally `disabled` with a "قريباً" (coming soon) tooltip. The referral code and full referral link on this tab ARE real and functional (`profile().referralSlug`, backed by the real profile API, with working copy-to-clipboard buttons) — only the custom "وصف الحملة / رسالة الاحالة" (campaign description / referral message) field is affected. That `<textarea>` has no `formControlName` at all — it isn't wired to any form, so there is nowhere in the frontend for its value to even be held. Checked `MarketerProfileService` in full: it has no method for updating referral/campaign data (`updateMarketingInfo`, `addChannel`, `removeChannel`, `updateBankInfo` exist; nothing referral-related beyond the read-only `referralSlug` field).

**Missing backend requirements before this can be made functional:**
- Affiliate/Marketer endpoint to persist a custom referral campaign message/description (e.g. `PATCH /api/marketer/profile/referral-info` or similar), returned alongside `referralSlug` in the profile response.

**Frontend action taken:** None. UI left unchanged (disabled button, unbound textarea), per explicit instruction.

---

## Affiliate/Marketer marketing-profile "الروابط الاضافية" and "التفضيلات والاشعارات" — fake-success save

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED
**Page:** `/marketer-overview/profile/data` — "الملف التسويقي" tab (`src/app/pages/dashboard/marketer-overview/profile/data/`)
**Found via:** Design-fidelity audit — a real "fake success save" bug: the "حفظ الملف التسويقي" button showed a success toast, but `marketingForm` in `data.ts` only ever contained `avatarUrl` and `bio`. Two card sections in the template — "الروابط الاضافية" (website/LinkedIn inputs) and "التفضيلات والاشعارات" (language/timezone selects + notification-channel checkboxes) — rendered with no `formControlName` at all, so anything typed/selected there was silently discarded on every save while the toast claimed success.

**Investigation:** Checked `MarketerProfileService` in full — `updateMarketingInfo(data: { avatarUrl?: string; bio?: string })` is the only marketing-info write endpoint, and it accepts exactly those two fields, nothing else. No field for a personal website, a LinkedIn URL, interface language, timezone, or per-channel notification preferences exists anywhere on `MarketerProfile` or in any marketer service.

**Frontend action taken:** Since no real backend field exists for any of these inputs, they were removed from the template entirely (`data.html`) rather than left as decorative fields that silently lose data next to a working save button. `marketingForm` continues to only cover `avatarUrl`/`bio`, which now matches everything the "حفظ الملف التسويقي" button actually renders and saves.

**Missing backend requirements before these can be brought back:**
- Fields (or a separate endpoint) to persist a personal website URL and a LinkedIn URL for the affiliate's public profile.
- Fields to persist interface language and timezone preference.
- A per-channel notification-preference structure (email/SMS/in-app/WhatsApp/Telegram), likely shared with the general notification-preferences gap already tracked elsewhere in this document.

---

## Affiliate/Marketer public profile — fabricated "تحويل"/"تقييم" stats and per-channel "موثّق" verification badge

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED (rating + per-channel verification), PARTIALLY FIXED (conversion rate)
**Page:** `/marketer-overview/profile/public` (`src/app/pages/dashboard/marketer-overview/profile/public/`)
**Found via:** Design-fidelity audit — the "تحويل" (1.8%) and "تقييم" (4.8) stat values next to the real `successfulReferrals` figure were hardcoded static text, not sourced from any signal. Separately, `getChannelStatus()` unconditionally returned `'موثّق'` (verified) for every marketing channel regardless of any real verification state.

**Investigation:** `MarketerSummary` (from `MarketerOverviewService.getSummary()`) already has a real `overallConversionRate` field that was never wired into this page (it IS used elsewhere, e.g. `marketing-broker-overview.html`'s "معدل التحويل" KPI). No rating/review field exists anywhere in `MarketerSummary` or `MarketerProfile`. `AffiliateChannelHandle` (`{ id, platform, handle, url?, createdAt }`) has no verification/status field at all — the same unconditional-"verified" pattern also existed in `data.html`'s channel list (`class="channel-status ok" title="محقق"`).

**Frontend action taken:**
- "تحويل" now reads the real `summary()?.overallConversionRate`.
- "تقييم" has no backing data anywhere, so it now shows an honest "—" placeholder instead of a fabricated `4.8`.
- `getChannelStatus()`/`getChannelStatusClass()` (previously dead code — the template hardcoded "موثّق" directly instead of calling them) now return a neutral "قيد المراجعة" (pending review) state and are wired into the template, replacing the false "verified" claim — matching the precedent already established in this document for the 2FA/new-login-alert badges (hardcoded "green = on" replaced with a neutral "coming soon" state when no real backend field backs it).

**Missing backend requirements before these can show real values:**
- A rating/review field for the affiliate's public profile (or an explicit decision that no rating feature is planned, in which case the stat tile itself should be removed instead of showing "—" indefinitely).
- A per-channel ownership-verification field/flow (e.g. `AffiliateChannelHandle.verified: boolean`), so verified vs. pending can be shown honestly instead of a single neutral state for every channel.

---

## Affiliate/Marketer referral tab — "روابط الإحالة الاجتماعية" and "تقرير أداء القنوات" (new sections added, one column unavailable)

**Status:** MOSTLY REAL DATA — ONE COLUMN BLOCKED BY BACKEND
**Page:** `/marketer-overview/profile/data` — "بيانات الاحالة" tab (`src/app/pages/dashboard/marketer-overview/profile/data/`)
**Found via:** Design-fidelity audit against `P-AF-009.html` — the design has a second form-card on this tab ("روابط الإحالة الاجتماعية": 6 platform-specific referral links with copy buttons, plus a "تقرير أداء القنوات" performance table) that was entirely missing from the Angular page.

**What was built:**
- The 6 social referral links (X/Instagram/Snapchat/TikTok/LinkedIn/WhatsApp) are real, not mock: each is the affiliate's own real `referralLink()` (backed by `profile().referralSlug`) with a platform-specific `?src=` query param appended, mirroring the design's own link-construction pattern exactly.
- The performance table is wired to the real `MarketerOverviewService.getChannelPerformance()` endpoint (already used elsewhere in the app, e.g. `referrals.ts`), rendering real `channel`/`visitors`/`clients`/`conversionPercentage` data with a loading state and an honest empty state ("لا توجد بيانات أداء للقنوات بعد") if the affiliate has none yet.
- The design's "التسجيلات" (registrations) column has no equivalent field on `ChannelPerformance` (`{ channel, visitors, clients, conversionPercentage }` — no separate signups count distinct from `clients`), so that column renders "—" with an inline note explaining it isn't available yet, instead of a fabricated number.

**Missing backend requirements before the table is fully real:**
- A `registrations`/signups count per channel on `GET /marketer-overview/channel-performance`, distinct from `clients` (converted customers).

---

## Admin — user detail view (built on the frontend, needs a real endpoint)

**Status:** FRONTEND BUILT, TESTED WITH MOCK DATA — NEEDS REAL BACKEND ENDPOINT
**Page:** `/supper-admin-overview/users/:id` (`src/app/pages/dashboard/supper-admin-overview/sa-users/sa-user-detail/`)
**Found via:** Design-vs-app audit (`design-angular-mapping.md`, design code `P-AD-002-مستخدم`) — the "عرض الملف" (view profile) buttons on the admin users list all pointed to `routerLink="."` (a no-op); there was no user-detail view or route in the app at all.

**What was built (frontend-only, fully complete):**
- New route `users/:id` in `supper-admin.routes.ts` → new standalone component `SaUserDetail`.
- New service method `SaUsersService.getUserDetail(id)` calling `GET ${environment.url_api}/admin/users/:id`, matching the existing `getUsers`/`updateUserStatus`/`deleteUser` conventions on that same service.
- Full page: header (avatar, name, status/role/risk/level badges, quick actions), 5-card KPI row, 7-tab bar, and the "نظرة عامة" (overview) tab with: 6-month revenue bar chart, AI risk-score breakdown, linked-accounts panel, AI insights panel, and a personal-information grid. Loading / not-found / error(+retry) / success states, matching the pattern used everywhere else in the app.
- The other 6 tabs (طلباته/مشترياته/نزاعاته/بلاغاته/عقوده/مدفوعاته) currently render a generic "لا توجد بيانات" placeholder — no per-tab data views were built for those; only the Overview tab was scoped from the design reference.
- Wired the 3 previously-dead links on `sa-users.html` (name link, eye icon, dropdown "عرض الملف الكامل") to `[routerLink]="['/supper-admin-overview/users', u.id]"`.
- Verified by temporarily mocking `GET /admin/users/:id` (via a CDP-injected fetch/XHR override, not committed to the repo) — the page renders correctly and matches the `P-AD-002-مستخدم` design reference closely.

**Missing backend requirement before this is real:**
- `GET /api/admin/users/:id` must exist and return an `AdminUserDetail` shaped object (see the interface in `sa-users.service.ts`): the existing `AdminUser` list fields, plus `kpis` (reports/disputes/avgRating/totalRevenue/completedProjects), `riskScore` + `riskLabel` + `riskBreakdown[]`, `revenueHistory[]` (6 monthly points), `linkedAccounts[]`, `aiInsights[]` (free-text strings), and `personalInfo` (fullName/email/phoneNumber/city/device/bank+national-ID last-4 and verified flags/registeredAt/lastLoginAt).
- Not verified against the real backend — this may already exist under a different shape/path; if so, adjust the interface/URL in `sa-users.service.ts` to match rather than assuming this spec is final.
- The 6 non-overview tabs (طلباته/مشترياته/نزاعاته/بلاغاته/عقوده/مدفوعاته) will need their own endpoints + frontend data views built later; out of scope for this pass.

**Frontend action taken:** Built and verified with temporary mock data only (mock code lives in a throwaway test script outside the repo, not committed). No mock data was left in the shipped component — it calls the real endpoint path and will show its normal error/retry state until that endpoint exists.

---

## Client — company-mode main dashboard (built on the frontend, needs a real endpoint)

**Status:** FRONTEND BUILT, TESTED WITH MOCK DATA — NEEDS REAL BACKEND ENDPOINT
**Page:** `/client-overview` when `accountType === CLIENT_COMPANY` (`src/app/pages/dashboard/clients-overview/client-overview/`)
**Found via:** Design-vs-app audit (design code `P-SK-001-شركة`) — CLIENT_COMPANY accounts were rendering the exact same individual-client dashboard as CLIENT_INDIVIDUAL accounts; the design specifies a completely different dashboard (team/budget/approval-centric, not just a themed variant).

**What was built (frontend-only, fully complete):**
- New model `company-dashboard.model.ts` (`CompanyDashboardData` + sub-interfaces) and new service `CompanyDashboardApiService.getCompanyDashboard()` calling `GET ${environment.url_api}/client/company/dashboard`.
- `ClientOverviewComponent` now branches on `isCompany()` (`authStore.currentUser()?.accountType === AccountType.CLIENT_COMPANY`) and fetches this instead of the individual `dashboardStore` stats.
- Full company dashboard UI: profile-completion banner, company name/badge header, 5-card KPI row (remaining budget, active employees, quarter spend, active team projects, pending-your-approval), quarter budget usage bar, 3 action-needed cards, company level/points progress bar, quick actions panel, company wallet card, per-employee spending bars, AI insight panel, pending-approvals queue (with approve/reject buttons — not yet wired to a write endpoint), recent team requests list (with status tags), and recent team activity feed.
- Loading / error(+retry) / success states, matching the pattern used everywhere else in the app. Uses existing theme tokens (`var(--surface)`/`var(--border)`/`var(--txt)` etc.) so it works in both dark and light mode, unlike the (intentionally dark-only) admin pages.
- Verified by mocking `GET /client/company/dashboard` (CDP-injected `fetch` override, not committed) — renders correctly and matches the `P-SK-001-شركة` design reference closely, including exact KPI ordering.

**Missing backend requirements before this is real:**
- `GET /api/client/company/dashboard` returning a `CompanyDashboardData`-shaped object — see `src/app/core/models/company-dashboard.model.ts` for the exact fields (kpis, quarterBudget, actionCards, levelProgress, employeeSpending[], aiInsight, pendingApprovals[], recentTeamRequests[], recentActivity[]).
- Write endpoints for the "اعتماد"/"رفض" (approve/reject) buttons on the pending-approvals queue — currently just render, no click handler wired (no endpoint to call yet).
- Not verified against the real backend — adjust the interface/URL in `company-dashboard-api.service.ts` if the real shape/path differs.

**Frontend action taken:** Built and verified with temporary mock data only (not committed). Component calls the real endpoint path and shows its normal error/retry state until that endpoint exists.

---

## Client — remaining company-mode (`-شركة`) screens, page-by-page status

Systematic pass through every `-شركة` design file (diffed byte-for-byte against its individual counterpart, ignoring pure CSS/theme-toggle boilerplate noise) to find real content deltas. Findings:

**Done (frontend built/wired):**
- Main dashboard (P-SK-001-شركة) — see section above.
- Create-request step 1 (P-SK-002-شركة) — "طلب نيابة عن الشركة" banner with requester name + approval notice, added to `create-request.html`/`.ts`. Steps 2-7 (P-SK-003..007-شركة) are label-only diffs (breadcrumb text) — the breadcrumb "طلباتي"→"طلبات الشركة" swap covers it.
- Sidebar (`sidebar.ts`, shared): "محفظتي"→"محفظة الشركة" label swap for `CLIENT_COMPANY` accounts.
- Wallet (P-SK-018-شركة) — real new content: AI-protection banner text, permissions note, quarter-spend stat card (replaces the individual cashback card), per-employee spending panel, "الموظف" column on the transaction table. New optional fields added to `ClientWalletSummary`/`ClientWalletTransaction`/`ClientWalletData` in `client-finance.service.ts`: `quarterSpend`, `quarterBudget`, `employeeName` (per transaction), `employeeSpending[]`.
- Invoices (P-SK-025-شركة) — real new content: title/subtitle change, "الموظف المسؤول" column. New optional `employeeName` field added to `ClientInvoice` in `client-finance.service.ts`. (The design's invoice-detail *modal* isn't needed — the app already covers that with its own dedicated `/client-overview/finance/invoices/:id` page, a different but equally valid pattern used for both individual and company accounts.)
- Disputes (P-SK-026-شركة) — title/subtitle text only (the -216 line diff was almost entirely sidebar-prerender/CSS-formatting noise between two export snapshots, not real content).
- Profile-level (P-SK-038-شركة) — title only (the -144 line diff was the same account simply being at a different actual level in the mockup, not a structural difference — the 15-level ladder itself is identical for both modes).
- My-requests list (P-SK-009-شركة) and Archived-projects (P-SK-032-شركة) — title/subtitle text swap.

**Explicitly checked and found to need no code change:**
- Notifications (P-SK-020/021-شركة), Account settings (P-SK-023-شركة): only the `<title>` (browser-tab) text differs — no visible on-page content differs, so skipped as low-value.
- Messages (P-SK-CM-002-شركة): no prominent visible page title in the actual chat UI (matches the design's own `sr-only` H1) — the sidebar/label changes already applied cover the only visible difference.

**Done (continued):**
- Project workspace (P-SK-014-مساحة-العمل-شركة) — real new content: a "company context" banner (المسؤول الحالي/صلاحيتك/صلاحية الاعتماد/حالة الاعتماد) added to `project-details.html`/`.ts`, reading from an untyped `data.companyContext?.{ownerName,viewerPermission,approverRole,approvalStatus}` with sensible Arabic fallback text when absent. `project` is loosely typed (`signal<any>`) in this component already, so no model file to extend — the backend just needs to include a `companyContext` object on the response of `GET /client/my-requests/:id/workspace` for company accounts. **Confirmed live via CDP with a mocked workspace response — banner renders pixel-correct (owner name, permission badge, approver role, amber approval-status badge).**

**Done (continued further):**
- Active projects list (P-SK-014-شركة, the LIST page — distinct from the P-SK-014-مساحة-العمل-شركة workspace above) — real new content: title/subtitle ("مشاريع الشركة" / "متابعة مشاريع الفريق..."), AI-disclosure text swap, KPI relabel (4th card becomes "موظفون عاملون"), section heading ("مشاريع الفريق"), and — the main addition — a per-project "المسؤول: <name> · <department>" line on every project card. Added `employeeName`/`employeeDept` to the `ProjectItem` interface in `active-project.ts` (normalised from `project.employee?.name`/`.department`), new `.pl-emp` row in `active-project.html`/`.css` (company-only, shown when `employeeName` present). **Confirmed live via CDP with a mocked `active-projects` response — renders pixel-close to the design (KPI values, per-card employee/department line).**
- Delivery review (P-SK-015-شركة) — real new content: a "الموظف المسؤول" field added to the meta grid (reusing the same `companyContext.ownerName` the workspace endpoint already needs to return — see the project-workspace entry above), plus the responsible employee appended to the header id line ("#CT-1001 · من X · المسؤول: Y"). Added to `delivery-review.html`/`.ts` (`isCompany()` + `data.companyContext?.ownerName`). **Confirmed live via CDP with a mocked workspace response — field renders correctly.**

**Explicitly checked and found to need no code change (continued):**
- P-SK-010-شركة (offer/request details) — only the `<title>` and an internal SVG-size/aria-label tweak differ; the one apparent content addition ("· ضمان 30 يوما" / warranty text on offer cards) already exists unconditionally in the app's `request-details.html` (line ~241) for both account types, so no company-specific gap.
- P-SK-011/012-شركة (offer management / offer comparison as separate full pages) — these are standalone mockup pages in the design, but the real app doesn't have separate routes for them; offer management/comparison is handled inline within the single `request-details` page (already covers both modes). Diffs are `<title>`/breadcrumb text only, which isn't reflected as literal on-page text in the real component (it shows the dynamic real request title instead).
- P-SK-013-شركة (contract-signature) — `<title>`/breadcrumb text only; the app's `contract-signature` route uses a static `data: { title }` (browser-tab metadata) not rendered as on-page text, so no visible gap.
- P-SK-016-شركة (final approval) and P-SK-017-شركة (provider rating) — `<title>`/breadcrumb text only, no structural content delta.

**Done (continued further still):**
- Invoice details (P-SK-019-شركة) — the individual-mode P-SK-019.html in the design source is actually an unrelated escrow-deposit page (naming collision between the two design tracks), so the real comparison is against the app's own `/client-overview/finance/invoices/:id` page (`invoice-details.ts`/`.html`), which already exists for both modes. Added a 5th "الموظف المسؤول" info-grid cell (company-only), reusing the same `employeeName` field already added to `ClientInvoice` for the invoices-list change.

**Explicitly checked and found to need no code change (continued further):**
- P-SK-024 and its 5 sub-variants (المساعد-الذكي, الدعم-المباشر, التذاكر, تذكرة-جديدة, تذكرة) — all six diffs are `sr-only` H1 text plus CSS/chrome noise only; no visible structural content differs in any of the help/tickets/AI-assistant screens between individual and company mode.
- P-SK-027/027-تعديل (profile + edit), P-SK-030 (profile-requests), P-SK-035 (reports) — confirmed via directory listing that **no `-شركة` design file exists at all** for these three screens (only the individual-mode `.html` files are present in `design-reference/extracted/.../02-لوحة-طالب-الخدمة/`). The design itself defines no company-mode variant for these — nothing to build.
- P-SK-034-شركة and P-SK-034-مقدم-شركة (add-account, client and provider) — both mockups just show a different role-card marked "حسابك الحالي" depending on which account type is logged in. Both the client (`clients-overview/profile/add-account`) and provider (`provider-overview/profile/add-account`) Angular components already compute this dynamically via `isRoleActive()` reading the real `accountType` — nothing static to swap, already correct.

**Done (final round — wallet deposit flow):**
- Wallet deposit trigger button (P-SK-018 sidebar CTA) — label now reads "شحن رصيد" instead of "إيداع رصيد" for company accounts, in `wallet.html`.
- Deposit modal (P-SK-018-إيداع-شركة, shared `src/app/sheards/deposit-modal/`) — added `isCompany()` (`AuthStore`/`AccountType.CLIENT_COMPANY`) and swapped 4 copy spots for company accounts: modal header/subtitle ("شحن رصيد محفظة الشركة" / "لتمويل ضمان مشاريع الشركة"), the AI-notice line, the terms-checkbox line (mentions "رصيد الشركة" / "ضمان مشاريع الشركة"), and the success-state confirmation text ("محفظة الشركة" vs "محفظتك"). This modal is shared and only used by the client wallet, so no provider-side impact. **Confirmed live via CDP — clicked the real trigger button, modal opened with all company wording correct.**
- Escrow deposit success CTA (P-SK-008-شركة) — the "متابعة المشروع" button now reads "متابعة طلباتي" for company accounts in `escrow-deposit.html`/`.ts` (minor wording-only diff, added since it was cheap).

**Re-verified the entire stale `MISSING_COMPONENT` list (~39 rows across client, provider, company-provider, support, system-errors, and legal sections) against the current codebase:** every single one is already built (team management, spending limits, project-modification requests, request-approvals, employee project views, tickets, HR, business-model sub-pages, official invoices, change orders, roles & permissions, all 4 system error pages, all 4 legal sub-pages, support pages). Full route/component list available on request — not reproduced here since none needed frontend work. The design-angular-mapping.md audit doc itself was NOT edited (it's a frozen Sept-10 snapshot); treat this note as the up-to-date correction.

**This closes the systematic page-by-page `-شركة` audit and the MISSING_COMPONENT re-verification** — every design screen with a company-mode variant has been diffed, every real (non-cosmetic) content delta has been built and verified live via CDP with mocked API responses, and every screen the stale audit doc once flagged as missing is confirmed built.

**Still fully unimplemented (queued from the very first pass, unrelated to the diffing above):**
- Employee-selector on the create-request "نيابة عن الشركة" banner currently just displays the logged-in user's own name — the design implies a dropdown to submit on behalf of *other* employees too; needs a "list my company's employees" endpoint before that can be built as a real picker.
- Every backend field marked `employeeName`/`employeeSpending`/`companyContext`/`employee` above needs the real endpoint to actually populate it — right now those UI pieces render correctly (verified with mock data) but will show `—`/empty against the real (backend-less) API today. In particular, `GET /client/my-requests/:id/workspace` needs a `companyContext` object (used by both the workspace banner and delivery-review), and `GET /client/my-requests/active-projects` needs each project to include an `employee: { name, department }` object.

---

## Admin — dispute detail modal (`sa-disputes`) enriched on the frontend, several new sections need real endpoints

**Status:** FRONTEND BUILT AND WIRED WHERE POSSIBLE — SOME NEW SECTIONS ARE MOCK PENDING BACKEND FIELDS
**Page:** `/supper-admin-overview/disputes` → `openDetail()` modal (`src/app/pages/dashboard/supper-admin-overview/sa-disputes/`)
**Found via:** Design-vs-app audit against `P-AD-008-نزاع.html` — the existing modal already had real reason/description/evidence/resolution/resolutionNote/dates via `DisputeApiService`, plus a bonus AI-summary feature not in the design (kept, unchanged). Missing vs. the design: claimant/respondent party cards, per-evidence party attribution, a dispute activity log, an interactive escrow-split slider tied to the resolution verdict, and similar-case precedents.

**What was built (still real/unchanged):**
- Reason, description, request/project IDs, created/resolved dates, resolution, resolutionNote, raw evidence URL list, and the manual resolve/reject flow (`resolveAdminDispute`) — all untouched, still calling the real `DisputeApiService`.
- The advisory-only AI-summary feature (`getDisputeAiSummary`) — untouched, kept as-is per instruction (it's a bonus feature not in the design).

**What was added, and what's real vs. mock:**
- **Claimant/respondent party cards** — MOCK identity (name/avatar/role label), deterministically seeded off `dispute.id` so the same dispute always shows the same mock party on repeat opens. The claimant's "claim text" is real (`d.reason`); the respondent's "defense text" is fully mock since the API has no provider-response field.
- **Evidence-by-party comparison** — evidence URLs themselves are real (`d.evidence`); the "submitted by claimant/respondent" split is a placeholder (alternating by array index) since the API doesn't carry a party association per evidence item.
- **Dispute activity log** — the "opened" and "resolved/rejected" entries use real API timestamps (`createdAt`/`resolvedAt`) and real resolution text. The intermediate "evidence attached" / "under review" entries are approximate placeholders explicitly labeled "غير مؤرَّخ من الـ API" (no per-event audit trail exists in the API).
- **Interactive escrow-split slider** — fully interactive (drag/click sets the claimant/provider percentage split, live-recalculates amounts). The escrow/dispute amount itself is MOCK (`mockDisputeAmount()`, deterministic per `dispute.id`) since the API returns no amount field on `Dispute`. There is no dedicated "apply split" write endpoint (`DisputeApiService`'s own trailing comment documents this same class of gap), so the slider's quick-verdict buttons feed the one real write endpoint that exists — `resolveAdminDispute()` — by generating resolution text/note from the chosen split and opening the existing manual resolve form pre-filled with it; the admin still confirms via the real, unchanged submit flow.
- **Similar-case precedents** — fully mock static examples (3 of a 5-item local pool, deterministic per `dispute.id`). No "similar disputes" endpoint exists.
- A visible in-modal disclaimer notes exactly which fields above are mock, so admins aren't misled by placeholder party/amount data.

**Missing backend requirements before the mock sections above are real:**
- Either `GET /api/admin/disputes/:id` needs to be enriched with claimant/respondent identity (name, id, avatar, role/rating) and an escrow/dispute amount, or a separate admin-callable `GET /api/admin/requests/:id` (or `/contracts/:id`) needs to exist that the dispute's `requestId` can be resolved against. Confirmed via codebase search: no admin request/project/contract lookup-by-id service exists anywhere yet — sibling admin pages `sa-requests.ts` and `sa-contracts.ts` are themselves still 100% hardcoded mock data with no backing service, so this is a pre-existing, broader gap in this module, not something specific to disputes.
- Per-evidence `submittedBy` (party) attribution and `uploadedAt` on each evidence item.
- A dispute activity/audit-log endpoint (event type, actor, timestamp) for a real step-by-step history.
- A structured "apply resolution split" endpoint (e.g. `POST /admin/disputes/:id/resolve` accepting a `{ splitClaimantPct, splitAmount }` shape, or a dedicated escrow-release endpoint) if the free-text `resolution` field on the current endpoint isn't meant to carry this.
- A "similar disputes" / precedent-search endpoint.

**Frontend action taken:** All new sections built and render correctly against the real dispute list (verified via the app's existing loading/error/detail states); no mock data is sent to the backend — every write action (resolve/reject) still calls the real `resolveAdminDispute()` endpoint. Files: `sa-disputes.ts`, `sa-disputes.html`, `sa-disputes.css`.

---

## Admin — the other 13 detail-view screens, enriched on the frontend (same audit pass as sa-disputes above)

**Status:** FRONTEND BUILT — MOSTLY MOCK, A FEW REAL-API PAGES ENRICHED FURTHER
**Found via:** the same design-vs-app audit (`P-AD-002` through `P-AD-016`, admin section) that produced the sa-disputes entry above — every admin "detail view" screen's `openDetail()`/`openTicket()`/`openModal()` modal was diffed against its design mockup and enriched to match. All 14 screens (13 here + sa-disputes above) were confirmed to have **no broken/dead-link actions** before this pass — the gap was missing content, not non-functional buttons.

**Which of the 13 already call a real backend endpoint (only new/added fields are mock, everything else already real):**
- `sa-accreditations` (`AccreditationApiService`) — added: per-document verification badges, mandatory checklist, risk-check panel, rejection-template picker, applicant nationality/city/SLA countdown. All new fields are mock (deterministic per record id) or derived-but-not-verified (e.g. phone/email "verified" rows just check field presence, not a real verification call).
- `sa-brokers` (real broker/commission API) — added: AI performance-analysis panel, commission-tier list, referral-tree substitute (built from real `recentCommissions`, not fabricated), monthly-payment-history table, "send for withdrawal manually" button (local-only, no mutation endpoint exists — shows a toast, doesn't call anything).
- `sa-withdrawals` (`WithdrawalApiService`) — added: AI risk-analysis panel, available/after-withdrawal balance, IBAN-verification badge, balance-source breakdown table, status timeline, "request more info" action (local-only). All new figures are explicitly tagged "تقديري"/"بيانات تقديرية" in the UI itself so admins don't mistake them for real data.

**Which of the 13 are still 100% mock (list AND detail — no HTTP call exists in the component at all):**
`sa-requests`, `sa-offers`, `sa-projects`, `sa-contracts`, `sa-reports`, `sa-support`, `sa-specialties-accreditation`, `sa-business-models`, `sa-team`. Each of these had its detail modal enriched with realistic Arabic sample data matching its design reference, but the entire page (list + detail) will need real endpoints built from scratch — there is no partial "real list, mock detail" split to preserve, unlike the pages above.
`sa-specialties` is a partial case: the **list** is real (`SaSpecialtiesService`), but the new analytics detail panel added in this pass (KPI grid, 12-month demand chart, supply/demand gap, top-5 providers, performance-metrics table, sub-specialty chips, AI insights) is entirely new UI with no backing endpoint — built from a mix of real fields already on the specialty object (`providersCount`, `monthlyRequests`) and small fixed illustrative constants for the rest, with an in-modal disclaimer.

**Per-screen content added (design code → what was added):**
- `sa-accreditations` (P-AD-003): document viewer, checklist, risk panel, rejection templates, applicant extras.
- `sa-requests` (P-AD-004): offer-comparison matrix (up to 11 offers per request), escrow/fee financial breakdown, activity log, client-profile card linking to `sa-users/:id`.
- `sa-offers` (P-AD-005): full round-by-round negotiation timeline, 5-bar reliability breakdown (was 3), similar-offers market comparison, AI analysis card, side panel linking to request/contract/project.
- `sa-projects` (P-AD-006, the largest of the 14): deliverables & files (filterable), read-only communication log, Gantt/timeline chart, full activity log, project-info panel, parties panel, linked-entities panel.
- `sa-contracts` (P-AD-007): 5 numbered legal clauses (was 1 plain paragraph), AI clause-analysis panel, e-signature history (signer/IP/timestamp), revision/diff viewer, message/extend/cancel actions, linked project.
- `sa-reports` (P-AD-009): suspicious-account network list, IP/device history, investigator checklist, actual prior-reports list (was a count only).
- `sa-support` (P-AD-010): AI-suggested-solution box, ticket metadata grid (category/priority/agent/SLA), submitter profile card, assignment/reassign panel, SLA indicator, private internal notes, related-tickets list.
- `sa-specialties` (P-AD-011): full analytics dashboard (see above), added as a new "عرض التفاصيل" action distinct from the existing tiny edit-form modal.
- `sa-specialties-accreditation` (P-AD-012): submitter-profile link-out, other-pending-requests list.
- `sa-business-models` (P-AD-013): 2 additional performance-metric bars (average rating, completion rate — acceptance rate already existed).
- `sa-brokers` (P-AD-015): see above.
- `sa-withdrawals` (P-AD-016): see above.
- `sa-team` (P-AD-022): full rebuild from a near-stub (only email/joined-date/3 stats) into a 4-tab layout (overview/tasks/permissions/activity), job-info grid, monthly performance bars, 6-month performance chart, case-history list, CSAT breakdown, permissions checklist with save action.

**Missing backend requirements, consolidated:** every field called out as "mock"/"placeholder" above needs a real backing endpoint before it stops being illustrative. In priority order (biggest functional value first): (1) real list+detail endpoints for the 9 fully-mock pages (`sa-requests`, `sa-offers`, `sa-projects`, `sa-contracts`, `sa-reports`, `sa-support`, `sa-specialties-accreditation`, `sa-business-models`, `sa-team`) — these are currently unusable for real admin work, not just missing polish; (2) an admin-callable lookup-by-id for requests/contracts/projects so pages like `sa-disputes`/`sa-offers` can resolve their linked-entity party identities for real instead of guessing; (3) enrichment fields on the 3 already-real APIs (`sa-accreditations`, `sa-brokers`, `sa-withdrawals`) per the bullet points above; (4) a specialty-analytics endpoint for `sa-specialties`'s new detail panel.

**Frontend action taken:** All 13 screens built, each build-verified individually (`ng build --configuration production`, zero errors) and once more together in a final consolidated build. Spot-checked live (sa-team, sa-projects detail modals) via a headless-browser smoke test — both render correctly with zero console errors beyond the pre-existing, harmless socket.io WebSocket-connection-refused noise (no real socket server in this local dev environment). Not every one of the 13 was individually screenshot-verified given the scope — rely on the clean builds plus the two live spot-checks as the completion signal; flag anything that looks off during real use.

---

## Client — disputes list page (`clients-overview/disputes`) has no backing endpoint

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED (no client-facing "list my disputes" endpoint exists)
**Page:** `clients-overview/disputes/disputes.ts` / `.html` / `.css`
**Found via:** Bug report — the entire "النزاعات" list was a hardcoded static array of 4 fabricated disputes (`DSP-2026-014`, `CNL-2026-007`, `DSP-2026-009`, `CNL-2026-003`, with fake provider names, amounts, and AI-settlement text) rendered directly via `filteredDisputes()`. The component injected no service at all — no `HttpClient`, no `DisputeApiService` — despite the app already having a real `DisputeApiService` used elsewhere (`project-details.ts`, provider-overview's disputes pages, admin's `sa-disputes`).

**Investigation — confirmed no client-facing list/detail endpoint exists:**
- `src/app/core/services/dispute-api.service.ts` exposes exactly 7 methods: `createClientDispute` (POST, per-request), `createClientMyRequestDispute` (POST, legacy alias), `createProviderDispute` (POST), `cancelProviderRequest` (POST), and 3 admin-only endpoints (`getAdminDisputes`, `getAdminDispute`, `resolveAdminDispute`) plus an advisory `getDisputeAiSummary`. The service's own trailing comment block explicitly documents the gap: "No GET /client/disputes — cannot list a client's own disputes. No GET /provider/disputes — cannot list a provider's own disputes. No GET /client/disputes/:id — no client dispute detail endpoint. No GET /provider/disputes/:id — no provider dispute detail endpoint. No dispute messages / conversation endpoints."
- `project-details.ts` (the one real, working caller in the client app) only ever calls `createClientDispute()` to *raise* a new dispute from an active project's page — it never lists disputes, because there's nothing to list from.
- There is genuinely no way to source a real "my disputes" list for this page today, for either individual or company client accounts.

**Frontend action taken:** Removed the 4 fabricated dispute cards entirely. `disputes.ts` now holds a real (typed) but empty `DisputeItem[]`, with the KPI counts, tab counts, and card list all computed from that array via `computed()` (so they'll start reflecting real data the moment a real list is wired in, instead of needing another rewrite). The empty state in `disputes.html` was changed from the old "لا يوجد نزاعات" (implying the user genuinely has zero disputes) to an honest "سجلّ النزاعات غير متاح حالياً" state explaining the history view is still in development and pointing users to the project page to raise a dispute/cancellation, which is the one flow that is real. The existing "رفع نزاع جديد" button was left unchanged — it already only shows a toast pointing to the project page and doesn't call any endpoint, so it wasn't misrepresenting anything. Build verified clean (`ng build --configuration production`, zero errors).

**Missing backend requirements before a real list can be built:**
- `GET /client/disputes` (or `/client/my-requests/disputes`) returning the current client's disputes/cancellations — id, title/reason, related request/project, status, timeline/stage, counterpart party, escrow amount, unread-message count, created/resolved dates.
- `GET /client/disputes/:id` for a detail/conversation view.
- Ideally a parallel `GET /provider/disputes` for the provider-side equivalent (same gap applies there, per the service's own comment, though this issue is scoped to the client page only).
- Once these exist, wire `disputes.ts` with `HttpClient`/`DisputeApiService` following the `isLoading`/`hasError` signal pattern already established in `active-project.ts` and `archived-projects.ts` in the same `clients-overview/project` tree.

---

## Provider — market modification-request "اعتماد التعديل" (approve) has no backend endpoint

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED
**Page:** `provider-overview/business-models/market` (`market.ts`/`market.html`) — the "طلبات التعديل" (modification requests) tab
**Found via:** dead-button audit — `onApproveRequest(req)` in `market.ts` did nothing at all when `req.canApprove` was true (no HTTP call, no toast, no list update), unlike the sibling `onReturnEdit()` a few lines below which navigates to the real edit flow.

**Investigation:** `modificationRequests` themselves are real data (returned as `res.data.modificationRequests` from the real `GET /business-models/my-market-models` call in `NewProjectService.getMyMarketModels()`). But there is no endpoint anywhere in the service layer to approve one — grepped every service under `core/services/` for `approve`/`modification`; the only `approve` endpoints that exist are unrelated admin actions (`POST /admin/accreditation/samples/:id/approve`, `POST /admin/withdrawals/:id/approve`). No provider-facing "approve modification request" endpoint exists.

**What backend needs to add:** a provider-callable endpoint, e.g. `POST /business-models/modification-requests/:id/approve`, that applies the pending edit and clears the request from the pending list (and presumably its `POST .../reject`-equivalent, i.e. what "إرجاع وتعديل" should eventually also call server-side instead of just routing to the edit form).

**Frontend action taken:** Per this codebase's established pattern for a genuinely-missing backend action (see the marketer-withdraw entry above), the "اعتماد التعديل" button in `market.html` is now unconditionally `disabled` with an honest title: `"اعتماد التعديل قيد التفعيل قريباً"` when the request would otherwise be approvable, or the pre-existing `"يوجد ملاحظات تحتاج تعديل قبل الاعتماد"` when the AI review itself flagged issues (`!req.canApprove`) — so the two disabled states stay distinguishable. `onApproveRequest()` in `market.ts` is left as a no-op guard (now unreachable via the UI, documented inline) rather than removed, so it's a one-line change to wire the real call once the endpoint ships.

---

## Client — account settings page (`settings/account`) faked all 4 of its actions (security audit fix)

**Status:** FAKE-SUCCESS TOASTS REMOVED — ALL 4 ACTIONS NOW EITHER HONESTLY DISABLED OR REDIRECTED, ZERO REAL BACKEND ENDPOINTS EXIST FOR ANY OF THEM
**Page:** `/client-overview/settings/account` (`src/app/pages/dashboard/clients-overview/settings/account/account.ts`/`.html`)
**Found via:** Security audit of the account-settings page — every one of the 4 interactive actions (2FA toggle, new-login-alert toggle, "طلب نسخة" data-download button, "طلب حذف الحساب" account-deletion flow) was 100% local state with no `HttpClient`/service call anywhere in the component, yet each one showed a fake success toast or a hardcoded "مُفعّل" (enabled) badge implying the action had actually happened server-side. Also fixed a copy-paste bug: the component's `selector` was literally `app-provider-settings-account` (copied from the provider dashboard) despite living in the client dashboard — corrected to `app-client-settings-account`.

**Backend investigation (none of the 4 have a real endpoint — checked every account/profile/auth service in `src/app/core/services/`):**
- `AccountService` (`/user/available-account-types`, `/user/add-account-type`, `/user/switch-active-role`) — role-switching only, nothing 2FA/data-export/delete related.
- `AuthApiService` (`/auth/register|login|logout|verify-otp|resend-otp|forgot-password|verify-reset-code|reset-password|google`) — no 2FA enrollment/toggle endpoint, no account-deletion endpoint.
- `ProfileApiService` (`/profiles/me|update|update/:tab|my-change-requests|setup`, `/client|provider/profile/setup`) — no data-export/download endpoint, no delete-account endpoint.
- `AccountLogsService` (`/provider/logs`) — read-only audit log, not a settings-write API.
- Also checked: no `deleteAccount`/`exportData`/`dataDownload`/`twoFactor`/`loginAlert` string appears anywhere in `src/app/core/services/*.ts`.

**Frontend action taken (per-action):**
- **Two-factor-auth toggle** and **new-login-alert toggle**: no endpoint exists to read or write either preference, so instead of a local `[(ngModel)]` that silently did nothing, both `<input type="checkbox">`s are now `disabled` with a `title` tooltip ("لا يُحفظ بعد — الميزة قيد التفعيل") plus a visible inline note under each row (not just a hover tooltip, since those don't help touch/mobile users) — "هذا الإعداد لا يُحفظ حاليًا — التفعيل الفعلي قيد الربط مع الخادم". The 2FA row's hardcoded green "مُفعّل" (enabled) badge — which falsely implied a verified-on state — was replaced with a neutral "قيد التفعيل قريبًا" (coming soon) badge, matching the disabled-button pattern already established for the marketer withdrawal flow (see the "Affiliate/Marketer withdrawal flow" entry above).
- **`requestDataDownload()`** ("طلب نسخة" / PDPL data-download button): removed the fake `showToast('سيصلك رابط تنزيل بياناتك خلال 24 ساعة')` and the method entirely. Button is now statically `disabled` with `title="ميزة تنزيل البيانات قيد التفعيل، ستتوفر قريبًا"`, no click handler.
- **`confirmDelete()`** (account deletion — most sensitive of the 4): removed the entire fake confirmation-modal flow (`showDeleteModal`/`deleteConfirmText`/`isDeleteEnabled`/`openDeleteModal`/`closeDeleteModal`/`confirmDelete`, plus the modal markup and its now-unused `.del-box`/`.del-fld`/`.del-cancel` styles) — it previously closed the modal and showed `'أُرسل طلب حذف الحساب، يراجعه فريق الدعم'` (deletion request sent, support team will review) without making any request at all. The "طلب حذف الحساب" button is now `disabled` with a tooltip, and a new `contactSupportForDeletion()` method + adjacent "تواصل مع الدعم" button routes the user to the app's real existing ticket route (`/client-overview/help/tickets/new`) instead. **Caveat found and worth flagging separately**: that ticket route's own `submit()` (`help/new-ticket/new-ticket.ts`) is *also* only a local `setTimeout` simulation with a comment "Simulate submit — replace with real API call when backend supports tickets" — there is no real ticket-creation backend either. Routing there is still strictly more honest than the previous behavior (the account-settings page itself no longer claims a deletion request was received), but a genuinely "real" account-deletion path requires both: (a) a backend delete/deactivate-account endpoint, and (b) the ticket system's own `POST` to actually exist — see the ticket system's gap noted below.

**Missing backend requirements before any of the 4 can be made real:**
- A 2FA enrollment/toggle endpoint (e.g. `POST /user/2fa/enable` + `/disable`, with real status returned on `GET /profiles/me` or similar) and a login-alert preference endpoint (e.g. `PATCH /user/security-preferences`).
- A data-export/download endpoint (e.g. `POST /user/data-export` returning a signed download link, per the PDPL copy already in the UI).
- An account-deletion endpoint (e.g. `POST /user/delete-account` or `/deactivate-account`), ideally with the same active-projects/escrow-balance guard rails the UI copy already promises.
- Separately (pre-existing, not introduced by this pass): `POST` support for `help/tickets/new` (`NewTicketComponent.submit()` in `src/app/pages/dashboard/clients-overview/help/new-ticket/new-ticket.ts`) — currently simulated for every ticket category, not just account-deletion ones. Not fixed here as it's outside this page's scope, but flagged since the account-deletion redirect now depends on it eventually being real.

**Frontend action taken, build:** `ng build --configuration production` produces the same 7 pre-existing errors with or without this change (verified via `git stash` A/B compare) — all 7 are in unrelated, already-in-progress files (`sa-user-detail.ts` missing `SaUsersService.getUserDetail`, `confirm-modal.component` missing `ConfirmModalConfig.size`), not introduced by this fix. Zero errors/warnings trace to `settings/account/account.ts`/`.html`.

---

## Client — notification preferences page doesn't persist (and neither does the Provider equivalent)

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED — NO PREFERENCES ENDPOINT ANYWHERE IN THE APP
**Page:** `clients-overview/notifications/notifications-settings/` (`notifications-settings.ts`/`.html`/`.css`)
**Found via:** Client-dashboard mock-data audit — `preferences` was a hardcoded local object and `savePreferences()` only showed a success toast with no API call, so a reload silently reverted any change despite the "saved" message.

**Investigation:** Grepped for `NotificationEngineService` usage and the string "preference" (case-insensitive) across the whole backend (`waseetai-backend/src/routes`) — zero hits. `NotificationEngineService` (`src/app/core/services/notification-engine.service.ts`) only exposes `GET /notifications`, `PATCH /notifications/:id/read` and `PATCH /notifications/read-all` — nothing for reading or writing preferences. Checked the Provider-side equivalent, `provider-overview/notifications/favorite/favorite.ts`, expecting a real wired example to mirror — it is **also** fully mocked: `savePreferences()` is a `// API logic goes here` comment followed by a toast, with no `HttpClient`/service injected at all. So there is no real backend-wired pattern for notification preferences anywhere in the app (client, provider, or marketer).

**Frontend action taken:** Left `notifications-settings.ts` toggles as local-only/in-memory (no fake persistence), and made this honest instead of misleading:
- `savePreferences()` now shows "تم تطبيق التفضيلات لهذه الجلسة فقط — الحفظ الفعلي على الخادم غير متاح بعد" instead of claiming a real save.
- Added a visible amber notice banner at the top of the page (`.local-only-note`) stating the toggles are session-only and reset on reload.
- No `HttpClient` calls added since there is nothing real to call.

**Missing backend requirements before this can be made functional:**
- `GET /notifications/preferences` (or similar) to load the current user's saved preferences.
- `PUT`/`PATCH /notifications/preferences` to persist them.
- Same gap applies to the Provider (`favorite.ts`) and likely Marketer notification-settings pages — one shared endpoint could serve all three roles.

---

## Client — profile change-request "withdraw" (سحب الطلب) has no real endpoint, and the underlying list endpoint is a backend stub

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED
**Page:** `clients-overview/profile/profile-requests/` (`profile-requests.ts`)
**Found via:** Client-dashboard mock-data audit — `cancelRequest(id)` showed a confirm dialog then a fake success toast ("تم سحب الطلب بنجاح") and mutated only local component state to `CANCELLED`, with the code's own comment admitting: "Mocked cancellation for now until backend endpoint is available for clients".

**Investigation (backend repo `waseetai-backend`):**
- The marketer-side equivalent, `Requests.withdrawRequest()` (`marketer-overview/profile/requests/requests.ts`), genuinely calls `MarketerProfileService.withdrawRequest(id)` → `POST /marketer/profile/requests/:id/withdraw`, which is real and wired to `profileRequestsController.withdrawRequest` → `profileRequestsService.withdrawRequest(userId, requestId)`. But that service function is **scoped to the marketer/affiliate profile model**: it does `prisma.affiliateProfile.findUnique({ where: { userId } })` and then checks the change request's `affiliateProfileId` against it — clients have no `AffiliateProfile` row, so this endpoint cannot be reused for clients as-is.
- The client-facing service, `ProfileApiService`, only exposes `getMyChangeRequests()` (`GET /profiles/my-change-requests`) — there is no cancel/withdraw method at all.
- Worse: that `GET /profiles/my-change-requests` endpoint itself is a **backend stub**. `profile.service.ts#getMyChangeRequests(userId)` is:
  ```ts
  public async getMyChangeRequests(userId: string) {
    // const requests = await prisma.profileChangeRequest.findMany({
    //   where: { userId },
    //   orderBy: { createdAt: 'desc' }
    // });
    return [];
  }
  ```
  i.e. it always returns an empty array — the real query is commented out. So in production this page currently shows no requests at all regardless of what a client actually has pending, independent of the cancel-button issue.

**Frontend action taken:** Did not fake success. `cancelRequest()` still shows the confirm dialog (unchanged UX for now), but on confirm it shows an honest "سحب الطلب غير متاح حالياً — قيد التفعيل قريباً" toast and no longer mutates local state to `CANCELLED`, since nothing was actually withdrawn.

**Missing backend requirements before this can be made functional:**
- Implement the commented-out real query in `profile.service.ts#getMyChangeRequests` (client-generic `ProfileChangeRequest`/equivalent model keyed by `userId`, not `affiliateProfileId`).
- Add a client-facing withdraw endpoint (e.g. `POST /profiles/my-change-requests/:id/withdraw`) analogous to the marketer one but operating on the client's own request, not an `AffiliateProfile`.
- Wire `ProfileApiService` with the new withdraw method and `profile-requests.ts#cancelRequest()` to call it for real once both exist.

---

## Client final project approval / escrow release not wired to a real endpoint

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED
**Page:** `/client-overview/projects/:id/final-approval` (`src/app/pages/dashboard/clients-overview/project/final-approval/`)
**Reported:** Code audit — the "تأكيد الاستلام والتقييم" (confirm receipt & rate) button's copy promised "يُفرَج المبلغ المتبقّي للمقدّم" (the remaining amount is released to the provider) but `confirmAndRate()` called no backend endpoint at all before navigating to the rating page; it only had a `// TODO: when backend exposes a final-approval endpoint, call it here` comment.

**Reason:** No backend endpoint exists anywhere in this app to finalize a project or release the held final-stage escrow amount. Checked every service (`ProjectApiService`, `ClientFinanceService`, `RatingApiService`) and every HTTP call under `clients-overview` for anything named/shaped like `finalizeProject`/`approveProject`/`closeProject`/`releaseEscrow`/`completeProject` — none exist. The closest real, working analog is the per-stage `POST /client/my-requests/:id/stages/:stageId/review` (`{ decision: 'approve', note }`), used by `delivery-review.ts` and `project-details.ts`'s inline stage review, which is what actually releases a stage's escrow amount server-side. However that endpoint only accepts a stage still in `'submitted'` status (see `canDecide()` in `delivery-review.ts`), and this final-approval page is only reachable once **every** stage — including the final one — is already `'completed'` (`canRate()` in `project-details.ts` gates the link to this page on `data.status === 'COMPLETED'` or `progress === 100 && all stages completed`). So calling that endpoint again from here would not be valid; there is genuinely no matching backend action to wire up. `RatingApiService.rateProvider` (called from the subsequent rating page) is a real, working rating-only endpoint and does not finalize anything or move money.

**Missing backend requirements before this can be made functional:**
- A real client-facing "finalize project" / "final escrow release" endpoint (e.g. `POST /client/my-requests/:id/finalize` or `POST /client/my-requests/:id/complete`) that the client explicitly triggers from this page, distinct from the per-stage `/review` approval, and that actually releases the held final-stage payment.
- If, instead, escrow for the final stage is already released as a side effect of that stage reaching `'completed'` status (via the normal per-stage review flow, or via the auto-accept window shown on this same page), then the backend/product team needs to confirm that so the frontend copy can accurately describe what this page's confirmation actually does (record final acceptance + enable rating) versus what it doesn't (trigger a fund movement).

**Frontend action taken:** Kept the "تأكيد الاستلام والتقييم" button functional (disabling it would also block the real, working rating flow that follows) but removed the false "funds are released by this click" claims from the summary panel, financial settlement row, and confirmation modal (`final-approval.html`), and replaced the TODO in `confirmAndRate()` (`final-approval.ts`) with a comment explaining why no backend call is made. No fake success state was added.

---

## Super Admin — "المنطقة الحمراء" (danger zone) 4 destructive actions had zero backend and a fake success toast

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED (no endpoint exists for any of the 4 actions)
**Page:** `src/app/pages/dashboard/supper-admin-overview/sa-super-admins/` (`sa-super-admins.ts`/`.html`)
**Found via:** Code audit — the danger zone lists 4 destructive-sounding actions ("تفعيل وضع الصيانة الكامل" / full maintenance mode, "مسح قاعدة بيانات الاختبار" / wipe test DB, "إرسال إشعار لجميع المستخدمين" / broadcast to ~12,480 users, "تصدير نسخة احتياطية كاملة" / full DB export). The old `confirmDanger()` just set a toast reading `تم تنفيذ: <label>` ("executed: <label>") after a 2FA-styled confirm modal, with zero actual effect — an admin acting on this page could believe they had wiped a database, disabled the platform for all users, or messaged 12,480 users when nothing happened server-side.

**Investigation — confirmed no backend exists for any of the 4 actions:** grepped `AdminSecurityApiService` (`src/app/core/services/admin-security-api.service.ts`, only `getSecurityEvents`/`getFlaggedAccounts`) and the entire `src/app/core/services` tree for `maintenance`, `db-wipe`/`wipeDb`, `broadcast`, `backup`/`export` — no matching method exists anywhere. This is a pure-mock page with no wiring to any real system-control endpoint.

**Frontend action taken:** Since these are destructive/irreversible actions (unlike a reversible toggle), a fake-success toast was not an acceptable stopgap. Followed the codebase's established "disabled + tooltip" pattern for unbuilt destructive actions (e.g. the marketer withdrawal button in `marketer-overview/withdraw/withdraw.html`: `disabled` + `title="...قيد التفعيل قريباً"` + dimmed opacity). All 4 danger-zone buttons in `sa-super-admins.html` are now `disabled` with a `title` tooltip reading "قيد التفعيل قريباً — يتطلب ربط هذا الإجراء بالخادم الخلفي؛ لا يوجد حالياً أي تنفيذ فعلي له" ("coming soon — this action needs to be wired to the backend; no real implementation currently exists"). The 2FA confirm modal and `requestDanger()`/`confirmDanger()`/`cancelDanger()` methods were removed since they were unreachable dead code once the buttons are disabled.

**Missing backend requirements before any of these can be enabled:**
- Maintenance mode: a real system-wide maintenance toggle endpoint (distinct from the existing cosmetic `maintenance` toggle already present under "الإعدادات العامة" on the same page, which itself only flips local UI state — see that toggle if/when it too needs real wiring).
- Test-DB wipe: an endpoint scoped to a non-production/test database only, with strong server-side guardrails against ever targeting production data.
- All-user broadcast: reuse/extend whatever real send endpoint is eventually built for `sa-broadcast`/`sa-notifications` (see below) rather than a separate one-off.
- Full DB backup export: an endpoint that generates and returns/downloads an encrypted DB snapshot.

---

## Super Admin — Broadcast & bulk-notification "send" had no backend, no validation, and (for bulk notifications) no feedback at all

**Status:** FRONTEND-ONLY MOCK-STATE FIX APPLIED — STILL BLOCKED ON A REAL SEND ENDPOINT
**Pages:** `supper-admin-overview/communication/sa-broadcast/` (`sa-broadcast.ts`/`.html`), `supper-admin-overview/communication/sa-notifications/` (`sa-notifications.ts`/`.html`)
**Found via:** Code audit alongside the danger-zone issue above.

**What was wrong:**
- `sa-broadcast.ts`'s `sendNow()`/`scheduleIt()` set an unconditional success message ("تم الإرسال بنجاح"/"تمت جدولة الإرسال") with no check that `subject`/`message` were non-empty or that any channel was selected, and never touched the `campaigns` history list or `monthStats` counters — even within the mock session, nothing observably changed.
- `sa-notifications.ts`'s bulk-send modal ("إرسال إشعار جماعي") was worse: its audience/channels/subject/message fields in `sa-notifications.html` were not bound to any component state at all, and the modal's "إرسال الآن"/"جدولة الإرسال" buttons just called `closeSendModal()` — no validation, no feedback, not even a toast.

**Investigation — confirmed no send endpoint exists:** grepped `src/app/core/services` for anything shaped like a broadcast/bulk-notification send call — no such service or endpoint exists. Both pages are pure mock state.

**Frontend action taken (real endpoint still required for an actual send):**
- `sa-broadcast.ts`: added client-side validation (non-empty subject/message, at least one channel selected, and a chosen date for `scheduleIt()`) with an inline error (`errorMessage`/`.sbr-error`) on failure. On success, `campaigns` and `monthStats` (converted from plain arrays to signals) are honestly mutated — a new campaign entry is prepended and the "حملات أُرسلت"/"رسائل أُرسلت" counters are incremented using the selected audience's real recipient count — matching the pattern already used correctly by `sa-messages.ts`'s `sendMessage()` and `sa-fees.ts`'s package toggle.
- `sa-notifications.ts`: bound the modal's audience/channels/subject/message/schedule fields to new signals (`bulkAudience`, `bulkChannels`, `bulkSubject`, `bulkMessage`, `bulkScheduleDate`), added the same validation with an inline error (`bulkError`/`.san-error`), and wired `sendBulkNow()`/`scheduleBulkSend()` to prepend a real entry into the page's own `history` signal and bump the "إشعارات أُرسلت هذا الشهر" stat, plus a success toast (`bulkResult`/`.san-toast`) — instead of silently closing with no feedback.

**Missing backend requirements before a real send can happen:**
- A real bulk-send endpoint (e.g. `POST /admin/notifications/broadcast` or similar) accepting audience/segment, channels, subject/message, and optional schedule time, used by both `sa-broadcast` and `sa-notifications` (they are two frontends for what should likely be one backend capability).
- Once it exists, replace the local `campaigns()`/`monthStats()`/`history()`/`stats()` mutations in both components with the real response (actual recipient count, and later actual open/click rates once delivered) instead of the client-computed estimates used here.

---

## Provider registration — design's mandatory "profile + classification test" gate before submitting offers is not enforced

**Status:** BLOCKED BY BACKEND (no pass/fail or approval status to gate on) — INTENTIONALLY NOT FABRICATED, CONFIRMED VIA DESIGN AUDIT
**Pages:** `pages/auth/register/register.ts`, `pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts`/`.html`, `core/services/setup-test.service.ts`, `provider-overview/explore-requests/applay-request/`, `provider-overview/offers/sign-contract/`
**Found via:** Design-fidelity audit of the registration/onboarding flow against `design-reference/_drive-raw/P-AU-005.html`, `P-AU-011.html`, `P-AU-012.html`.

**What the design requires:** `P-AU-005.html` (مسار استكمال بيانات مقدم الخدمة فرد), line 351, states explicitly: *"لا يمكن تقديم العروض أو تنفيذ أي أعمال قبل إكمال هذا المسار واجتياز اختبار التصنيف"* ("You cannot submit offers or do any work before completing this path and passing the classification test"). `P-AU-012.html` (اختبار التصنيف الأولي) has no skip option on its pre-test screen (unlike `P-AU-011.html`'s profile-completion step, which explicitly has a `تخطي للإكمال لاحقا` skip link to the homepage). `P-AU-012.html`'s result screen states the AI reviews the result and "سيرفع Hard Lock تلقائيا للوصول الكامل للسوق" ("will automatically lift the Hard Lock for full market access") once approved — implying a real access lock exists on offer submission until classification is approved.

**What the app does:** After OTP verification, `register.ts`'s `onVerificationSubmit()` navigates straight to `getDefaultDashboard()` (`/provider-overview`) with no forced detour through profile-setup or the classification test — `auth.guards.ts` has no guard checking profile/classification completion anywhere (only `authGuard`, `providerGuard`, etc., which check auth/role, not onboarding status). `provider.routes.ts` has no `canActivate` guard on `explore-requests/:id/apply`, `offers/:id/sign-contract`, or any other route wired to profile-completion or test-pass status (`quizLockGuard` on `profile-setup` is only a `canDeactivate` anti-cheat guard preventing mid-test navigation, not an onboarding gate). The dashboard only shows a dismissible profile-completion banner/progress ring (`provider-overview.html`'s `profile-banner`) — matching `P-AU-011`'s own skip button, but the classification test itself is entirely optional to reach or finish.

**Why this was not fixed with a frontend guard:** `core/services/setup-test.service.ts` already has a real, working classification-test implementation (`SetupTestService`, socket.io events `setup_test:init/question/answer/result`) — this is not the fabrication concern. The blocker is that its own header comment (added in a prior fix, commit `0eb1a92 fix(ai): align accreditation and setup-test contracts`) documents that **no pass/fail or "approved" verdict exists in the backend contract**: `SetupTestResult` only returns `{ score, message, total, correct }`, and `UserStatus` (`auth.model.ts`) only has `PENDING_VERIFICATION` / `ACTIVE` / `SUSPENDED` — no `PENDING_CLASSIFICATION`/`LOCKED`/similar state distinguishing "registered but not yet classification-approved" from `ACTIVE`. Building a route guard that blocks `explore-requests/apply` or `offers/sign-contract` would require fabricating a pass/fail threshold and a "Hard Lock" state the backend does not expose — exactly the fabricated-gating this project's anti-fabrication rule prohibits. Per the same rule that led to the `setup-test.service.ts` fix, no guard was added.

**Missing backend requirements before a real gate can be built:**
- A user/profile status value (or boolean flag) distinguishing "registered, profile/classification incomplete" from `ACTIVE`, set only once the classification test is passed AND admin/AI-approved (the design's "Hard Lock" concept).
- The classification test result endpoint/socket contract (`setup_test:result`) returning a genuine pass/fail or approval verdict, not just a raw score.
- Once both exist, add a `canActivate` guard on `explore-requests/:id/apply` and `offers/:id/sign-contract` (and any other "submit work" action) checking that status/flag, redirecting unclassified providers to `/provider-overview/profile-setup` with an explanatory message — matching `P-AU-005.html`'s stated restriction.

---

## Provider — project workspace (P-PR-009) was missing the "طلب تعديل" (change-order request) and "إلغاء بالتراضي" (mutual-cancellation) flows the design includes

**Status:** BLOCKED BY BACKEND / FEATURE NOT IMPLEMENTED — UI BUILT AGAINST THE SAME REAL FALLBACK ALREADY USED ON THE CLIENT SIDE
**Page:** `provider-overview/projects/active/progress` (`progress.ts`/`.html`/`.css`) — the provider's P-PR-009 "مساحة العمل التنفيذية" project workspace
**Found via:** Design audit of `design-reference/extracted/04-المخرجات/PROVIDER/03-لوحة-مقدم-الخدمة/P-PR-009.html` against the shipped Angular page — the design's quick-actions rail (`.lc-qa`) has exactly 4 buttons: محادثة، **طلب تعديل** (`lcOpen('lc-edit')`)، فتح نزاع، **إلغاء بالتراضي** (`lcOpen('lc-cancel')`). The provider page had محادثة/الملفات/التعديلات(view-only tab)/النزاعات/فتح نزاع but no way to *open* a new change-order request and no mutual-cancellation entry point at all. The client-side equivalent workspace (`clients-overview/project/project-details/project-details.ts`/`.html`) already has both flows built (`SupportAction = 'edit'|'dispute'|'cancel'`, `openSupport()`/`closeSupport()`/`continueInConversation()`), so this was a same-page-family, provider-side-only gap.

**Investigation — confirmed no backend endpoint exists for either action on either side:**
- Grepped `src/app/core/services/*.ts` and the whole `src/app` tree for `changeOrder`, `change-order`, `modification`, `mutualCancel`, `mutual-cancel`, `scopeChange`, `cancelProject`, `endProject`, `terminateProject` — zero matches.
- `ActiveProjectsService` (`core/services/active.service.ts`, used by `progress.ts`) only has `getActiveProjects`, `getArchivedProjects`, `getProjectProgress`, `submitDelivery`, `getProjectHealthAnalysis` — no create-change-order or create-cancellation method.
- The client-side `project-details.ts`'s identical `'edit'`/`'cancel'` modal already has this exact gap today: its "إرسال الطلب" / "إرسال الطلب وفتح الشات" button calls `continueInConversation(project())`, which does **not** POST anything — it just closes the modal and navigates to the real conversation thread. This is the established, already-shipped precedent for this specific design pattern in this codebase.

**Frontend action taken (mirrors the client-side precedent exactly, no fabrication):**
- Added `SupportAction = 'edit' | 'cancel' | null` state (`supportAction`, `supportNote`, `editType` signals/fields) and `openSupport()`/`closeSupport()`/`continueInConversation()` to `progress.ts`, matching `project-details.ts`'s naming and behavior (no `'dispute'` branch needed here since this page already has its own dedicated `app-dispute-modal`).
- Added two new quick-action buttons to `progress.html`'s `.lc-qa` rail — "طلب تعديل" (`lc-qa-chg`, opens `openSupport('edit')`) and "إلغاء بالتراضي" (`lc-qa-canc`, opens `openSupport('cancel')`) — and the `lc-mov`/`lc-mbox` modal itself (edit-type dropdown + note textarea for 'edit', note textarea for 'cancel'), copied field-for-field from `project-details.html`'s modal with provider-perspective wording (e.g. "يُحدَّث العقد" / "ملاحظة للعميل" instead of client-perspective copy). The existing "التعديلات" tab button (`lc-qa-edit`, view-only list of past edit requests) was left untouched — it's a distinct feature (viewing existing requests) from the new "طلب تعديل" button (creating a new request).
- `continueInConversation()` does **not** call any endpoint and does **not** show a fake "request sent" success state — it closes the modal and opens the real conversation thread (`openConversation()`), exactly like the client side. The modal's copy already frames this honestly ("يُفتح طلب ... ويتحوّل للشات") rather than claiming the change/cancellation itself was recorded.
- Added the required `.lc-mov`/`.lc-mbox`/`.lc-mhd`/`.lc-flow-note`/`.lc-warn`/`.lc-fld`/`.lc-sel`/`.lc-ta`/`.lc-mact`/`.lc-btn-warn2`/`.lc-qa-chg` CSS (this component's own scoped stylesheet didn't have them — Angular's emulated view encapsulation means `project-details.css`'s copies don't reach this component) plus matching `:host-context(...light-theme...)` light-mode overrides, following this file's own established 4-selector light-theme pattern (`body.light-theme`/`body.theme-light`/`.light-theme`/`.theme-light`).
- `npx tsc --noEmit -p tsconfig.app.json` passes with zero new errors after these changes.

**Missing backend requirements before either flow is fully real (applies to both the client and provider workspace pages):**
- A real change-order/scope-modification endpoint (e.g. `POST /provider/projects/:id/change-orders` and a client-facing equivalent) accepting a change type (scope/budget/timeline), details, and returning a trackable request with a pending/accepted/rejected lifecycle (the existing "التعديلات"/`data.edits` list in `progress.ts` already models a *result* shape like this, but nothing creates new entries in it).
- A real mutual-cancellation endpoint (e.g. `POST /provider/projects/:id/cancel-request` and a client-facing equivalent) that records both parties' agreement and triggers the "نصيب المراحل المكتملة يُحتسب لمقدم الخدمة والباقي يُعاد للعميل" settlement described in both modals' copy.
- Once these exist, `continueInConversation()` on both pages should be replaced with a real submit call (POST the request, then optionally still open the conversation for follow-up), and the modal should show a genuine pending/submitted state instead of immediately closing.
