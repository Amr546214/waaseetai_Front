# Phase 1 Execution Tracker — Critical Business Flows (P0)

> Tracks Phase 1 items from `IMPLEMENTATION_GAP_ANALYSIS.md` § "Suggested Implementation Priority Order".
> References: `CHECKOUT_IMPLEMENTATION_PLAN.md`, `ANGULAR_ROUTE_MAP.md`.
> No source files modified. Updated as work progresses.

---

## 1. Phase 1 Overview

Phase 1 covers the six P0 critical gaps identified in the gap analysis. These are the minimum flows needed for the platform to function end-to-end: a user can buy a service, receive delivery, approve it, rate the provider; the provider can submit final delivery; the admin can resolve disputes and process withdrawals; and new users can upload documents during onboarding.

**Phase 1 Items (6):**

| # | Item | Design Pages | Status |
|---|------|-------------|--------|
| 1 | Cart / Checkout | P-BF-001 → P-BF-007 | Pending |
| 2 | Client delivery review / final approval / rating | P-SK-015, P-SK-016, P-SK-017 | Pending |
| 3 | Provider final delivery | P-PR-012, P-PR-013-تقييم | Pending |
| 4 | Admin disputes management | P-AD-008 | Pending |
| 5 | Admin withdrawals processing | P-AD-016 | Pending |
| 6 | Onboarding document upload | P-AU-010 | Pending |

**Phase 1 total estimated effort:** ~15–18 days (7.5 days for Cart/Checkout alone, ~1–2 days each for the remaining 5 items).

---

## 2. Phase 1 Items Detail

### 2.1 Cart / Checkout

| Field | Value |
|-------|-------|
| **Design Page IDs** | P-BF-001 (Cart), P-BF-002 (Order Review), P-BF-003 (Payment), P-BF-004 (Payment Confirmation/OTP), P-BF-005 (Order Success), P-BF-006 (Payment Failure), P-BF-007 (Custom Service Request) |
| **Current Angular Status** | All 7 routes MISSING. No cart, no checkout, no payment flow. Existing `OfferComponent` has `requestService('order')` which POSTs to `/marketplace/models/:id/request` and redirects to `/client-overview/messages`. No payment, no OTP, no order success/failure. |
| **Priority** | P0 Critical |
| **Estimated Effort** | ~7.5 days (with mocked backend) |
| **Angular Files to Inspect** | `src/app/pages/website/website.routes.ts` — route array to add 7 new routes |
| | `src/app/pages/website/marketplace/offer/offer.ts` — `requestService()` method (lines 141–161), `openNegotiation()` (line 137) |
| | `src/app/pages/website/marketplace/offer/offer.html` — sidebar order card (lines 484–545), negotiation modal (lines 499–533) |
| | `src/app/core/services/marketplace.service.ts` — `requestService()` (line 101), `MarketplaceModel` interface (lines 6–43) |
| | `src/app/core/store/auth.store.ts` — signal patterns, `isAuthenticated()` computed, `authenticate()`, `currentUser()` |
| | `src/app/core/services/client-finance.service.ts` — wallet/deposit patterns to reuse for payment |
| | `src/app/core/guards/auth.guards.ts` — `authGuard` to protect checkout routes |
| | `src/app/core/models/api.model.ts` — `ClientRequestPayload` interface for custom request form |
| | `src/app/core/models/auth.model.ts` — `User` interface for billing info |
| | `src/app/core/services/new-project.service.ts` — may overlap with custom service request (P-BF-007) |
| | `src/app/environments/environment.ts` — `url_api` base URL |
| **Testing Requirements** | Full E2E flow: browse marketplace → add to cart → review → payment → OTP → success. Failure path: wrong OTP → failure page → retry. Empty cart state. Guest user redirect to login with returnUrl. Coupon application (mocked). Cart persistence across page reloads (localStorage). Stepper correct on each page. Responsive layout. |
| **Status** | Pending |
| **Plan Document** | `CHECKOUT_IMPLEMENTATION_PLAN.md` (detailed 14-step plan) |

### 2.2 Client Delivery Review / Final Approval / Rating

| Field | Value |
|-------|-------|
| **Design Page IDs** | P-SK-015 (Delivery Review), P-SK-016 (Final Approval & Close), P-SK-017 (Rate Provider) |
| **Current Angular Status** | All 3 routes MISSING. `ProjectDetails` component exists at `client-overview/projects/:id` but has no delivery review, final approval, or rating sub-routes. The project workspace shows project tracking but no delivery acceptance flow. |
| **Priority** | P0 Critical |
| **Estimated Effort** | ~2 days |
| **Angular Files to Inspect** | `src/app/pages/dashboard/clients-overview/project/project-details/project-details.ts` — existing project workspace |
| | `src/app/pages/dashboard/clients-overview/client.routes.ts` — route definitions (add sub-routes under `projects/:id`) |
| | `src/app/pages/dashboard/clients-overview/project/active-project/active-project.ts` — active projects list |
| | `src/app/pages/dashboard/clients-overview/project/archived-projects/archived-projects.ts` — archived projects (post-approval) |
| | `src/app/core/services/project-api.service.ts` — project API service |
| | `src/app/core/services/provider-api.service.ts` — provider API (for rating submission) |
| **Testing Requirements** | Client can view delivered work, request revisions, approve final delivery, close project, submit star rating + text review. Verify project moves from active to archived after approval. Verify rating appears on provider profile. |
| **Status** | Pending |

### 2.3 Provider Final Delivery

| Field | Value |
|-------|-------|
| **Design Page IDs** | P-PR-012 (Final Delivery & Close), P-PR-013-تقييم (Rate Client) |
| **Current Angular Status** | All routes MISSING. `Progress` component exists at `provider-overview/projects/active/progress/:id` for project execution but has no final delivery submission or client rating flow. |
| **Priority** | P0 Critical |
| **Estimated Effort** | ~1.5 days |
| **Angular Files to Inspect** | `src/app/pages/dashboard/provider-overview/projects/active/progress/progress.ts` — project execution workspace |
| | `src/app/pages/dashboard/provider-overview/provider.routes.ts` — route definitions |
| | `src/app/pages/dashboard/provider-overview/projects/active/active.ts` — active projects list |
| | `src/app/core/services/project-api.service.ts` — project API service |
| | `src/app/core/services/provider-api.service.ts` — provider API service |
| **Testing Requirements** | Provider can upload final deliverables, submit for client review, mark project as delivered, rate client after project closure. Verify project status transitions correctly. |
| **Status** | Pending |

### 2.4 Admin Disputes Management

| Field | Value |
|-------|-------|
| **Design Page IDs** | P-AD-008 (Disputes Management) |
| **Current Angular Status** | PLACEHOLDER. `SaDisputes` component exists at `supper-admin-overview/disputes` but is an empty scaffold (`imports: []`, shows "قيد التطوير"). No dispute list, detail view, resolution flow, or API integration. |
| **Priority** | P0 Critical |
| **Estimated Effort** | ~2 days |
| **Angular Files to Inspect** | `src/app/pages/dashboard/supper-admin-overview/sa-disputes/sa-disputes.ts` — placeholder component to implement |
| | `src/app/pages/dashboard/supper-admin-overview/supper-admin.routes.ts` — route definitions |
| | `src/app/pages/dashboard/clients-overview/disputes/disputes.ts` — client-side disputes (reference for data model) |
| | `src/app/pages/dashboard/provider-overview/disputes/disputes.ts` — provider-side disputes (reference) |
| | `src/app/core/services/marketplace.service.ts` — API patterns |
| **Testing Requirements** | Admin can view all disputes, filter by status (open/escalated/resolved), view dispute details with messages from both parties, resolve dispute (refund/split/reject), add admin notes. Verify dispute status updates propagate to client and provider dashboards. |
| **Status** | Pending |

### 2.5 Admin Withdrawals Processing

| Field | Value |
|-------|-------|
| **Design Page IDs** | P-AD-016 (Withdrawal Requests) |
| **Current Angular Status** | PLACEHOLDER. `SaWithdrawals` component exists at `supper-admin-overview/withdrawals` but is an empty scaffold. No withdrawal list, approval/rejection flow, or API integration. |
| **Priority** | P0 Critical |
| **Estimated Effort** | ~1.5 days |
| **Angular Files to Inspect** | `src/app/pages/dashboard/supper-admin-overview/sa-withdrawals/sa-withdrawals.ts` — placeholder component |
| | `src/app/pages/dashboard/supper-admin-overview/supper-admin.routes.ts` — route definitions |
| | `src/app/pages/dashboard/provider-overview/finance/withdraw/withdraw.ts` — provider withdraw flow (reference for data model) |
| | `src/app/pages/dashboard/marketer-overview/withdraw/withdraw.ts` — marketer withdraw flow (reference) |
| | `src/app/core/services/client-finance.service.ts` — finance API patterns |
| **Testing Requirements** | Admin can view all withdrawal requests, filter by status/type, view withdrawal details (amount, bank info, user), approve or reject with notes. Verify status updates propagate to provider/marketer wallets. |
| **Status** | Pending |

### 2.6 Onboarding Document Upload

| Field | Value |
|-------|-------|
| **Design Page IDs** | P-AU-010 (Upload Official Documents) |
| **Current Angular Status** | MISSING ROUTE. No document upload step exists in the auth/registration flow. The `Register` component at `auth/register` does not include file upload. `ProfileSetupDashboard` exists in dashboards but is separate from the onboarding flow. |
| **Priority** | P0 Critical |
| **Estimated Effort** | ~1.5 days |
| **Angular Files to Inspect** | `src/app/pages/auth/register/register.ts` — current registration component |
| | `src/app/pages/auth/auth.routes.ts` — auth route definitions |
| | `src/app/pages/dashboard/clients-overview/profile/profile-setup/profile-setup.ts` — existing profile setup (reference) |
| | `src/app/pages/dashboard/provider-overview/profile/profile-setup/profile-setup.ts` — provider profile setup (reference) |
| | `src/app/core/services/auth-api.service.ts` — auth API service |
| | `src/app/core/store/auth.store.ts` — auth state management |
| | `src/app/core/models/auth.model.ts` — user model |
| **Testing Requirements** | User can upload ID document (individual) or commercial registration (company) during onboarding. File validation (type, size). Preview uploaded file. Submit and verify backend stores document. Redirect to next step after upload. Error handling for failed uploads. |
| **Status** | Pending |

---

## 3. Cart / Checkout — Detailed Chunk Breakdown

The Cart / Checkout item (§2.1) is broken into 13 chunks following `CHECKOUT_IMPLEMENTATION_PLAN.md` §10 (Step-by-step implementation order).

### Chunk 0: Analysis

| Field | Value |
|-------|-------|
| **Goal** | Analyze existing codebase, design pages, and create implementation plan |
| **Inputs** | `IMPLEMENTATION_GAP_ANALYSIS.md`, `ANGULAR_ROUTE_MAP.md`, design pages P-BF-001 → P-BF-007 |
| **Outputs** | `CHECKOUT_IMPLEMENTATION_PLAN.md` |
| **Tasks** | Compare design pages vs Angular routes. Identify gaps. Map design elements to Angular components. Define routes, services, models, state management. |
| **Status** | Done |

> **⚠️ Runtime Blocker — Offer Page Testing (Updated 2026-09-01)**
>
> **Marketplace model blocker — Partially Resolved:**
> A published marketplace service now exists and appears in the marketplace.
> A real model is available from `GET /api/marketplace/models`.
> Future marketplace-to-cart wiring should use real marketplace model data, not mock service data.
>
> **Remaining blocker — Checkout backend endpoints unconfirmed:**
> Checkout/cart/payment backend endpoints are still unconfirmed, so `CheckoutService` may remain mocked until real endpoints are confirmed.
>
> **Status:** Cart / Checkout Chunk 0 remains **Done**. Chunk 1 remains **Done**. Offer page runtime testing is unblocked for marketplace data, but checkout flow testing remains blocked pending backend endpoints.

### Chunk 1: Models + CartService

| Field | Value |
|-------|-------|
| **Goal** | Create checkout model interfaces and cart state service |
| **Files to Create** | `src/app/core/models/checkout.model.ts` — all interfaces (CartItem, Order, PaymentMethod, CouponData, etc.) |
| | `src/app/core/services/cart.service.ts` — signal-based cart state with localStorage persistence |
| **Key Decisions** | Use Angular signals (consistent with AuthStore). localStorage key `waseet_cart`. Guest users: localStorage only. Authenticated users: sync to backend later. |
| **Signals** | `_items`, `_coupon` (writable); `items`, `coupon` (readonly); `itemCount`, `subtotal`, `discount`, `total` (computed) |
| **Methods** | `addToCart()`, `removeFromCart()`, `clearCart()`, `saveForLater()`, `loadCart()`, `applyCoupon()` (mocked), `removeCoupon()` |
| **Testing** | Add items, verify computed totals. Remove item, verify recompute. Clear cart. Coupon mock: `WASEET10` = 10% off. Persist to localStorage, reload, verify restore. |
| **Status** | Done — `npx ng build` passed (exit 0), no errors from new files |

### Chunk 2: CheckoutService

| Field | Value |
|-------|-------|
| **Goal** | Create checkout API layer with mocked endpoints |
| **Files to Create** | `src/app/core/services/checkout.service.ts` |
| **Methods** | `createOrder()` — mocked: generate UUID order number |
| | `initiatePayment()` — mocked: return fake payment reference + masked phone |
| | `confirmPayment(otp)` — mocked: `123456` = success, else = failure |
| | `resendOtp()` — mocked: no-op success |
| | `getOrder()` — mocked: return in-memory order |
| | `reset()` — clear checkout state |
| **Signals** | `_currentOrder`, `_paymentMethod`, `_paymentReference`, `_maskedPhone`, `_isProcessing`, `_error` |
| **Testing** | Create order from cart items. Initiate payment → verify OTP sent response. Confirm with `123456` → success. Confirm with wrong code → failure. |
| **Notes** | Marketplace service mock data is no longer needed — a real published model exists via `GET /api/marketplace/models`. CheckoutService works from real CartService items. Checkout/payment backend endpoints are still unconfirmed, so all checkout/payment methods are frontend-only mocked. |
| **Status** | Done — `npx ng build` passed (exit 0), no errors from new file |

### Chunk 3: Shared Components

| Field | Value |
|-------|-------|
| **Goal** | Create reusable stepper and order summary components |
| **Files to Create** | `src/app/pages/website/checkout/shared/checkout-stepper/checkout-stepper.ts` + `.html` + `.css` |
| | `src/app/pages/website/checkout/shared/order-summary/order-summary.ts` + `.html` + `.css` |
| **Stepper** | 4-step indicator: السلة → المراجعة → الدفع → التأكيد. Input: `step` number (1–4). |
| **Order Summary** | Sidebar card: items list, subtotal, coupon discount, total, checkout button. Reads from `CartService` signals. Output: button click event. |
| **Testing** | Stepper highlights correct step. Order summary updates when cart changes. Button label changes per page (إتمام الشراء / متابعة للدفع / ادفع الآن). |
| **Notes** | Components placed under `checkout/components/` (not `checkout/shared/` per plan, but functionally identical). Stepper uses `@Input() step` with active/completed states, RTL layout, responsive breakpoints. Order summary injects `CartService`, reads signals for items/subtotal/discount/total/coupon, supports `compact` mode for payment page mini-summary, shows empty state when cart is empty. No backend calls. No routes added. No existing files modified. |
| **Status** | Done — `npx ng build` passed (exit 0), no errors from new files |

### Chunk 4: Routes

| Field | Value |
|-------|-------|
| **Goal** | Add 7 checkout routes to website routes array |
| **File to Modify** | `src/app/pages/website/website.routes.ts` — insert after `marketplace/offer/:id` route (line 20), before `about` route (line 21) |
| **Routes** | `/cart` → CartComponent, `/checkout/review` → CheckoutReviewComponent, `/checkout/payment` → CheckoutPaymentComponent, `/checkout/confirm` → CheckoutConfirmComponent, `/checkout/success` → CheckoutSuccessComponent, `/checkout/failure` → CheckoutFailureComponent, `/custom-request` → CustomRequestComponent |
| **Guard** | `/cart` public (guest cart via localStorage). All other routes: `canActivate: [authGuard]` |
| **Load Pattern** | `loadComponent` (consistent with existing routes) |
| **Testing** | Navigate to each route. Verify authGuard redirects unauthenticated users to `/auth/login` with `returnUrl`. Verify authenticated users can access all routes. |
| **Notes** | 7 standalone page shells created (cart, review, payment, confirm, success, failure, custom-request). Each has minimal HTML with title + placeholder text. Cart/review/payment use `CheckoutStepper` + `OrderSummary`. Confirm uses stepper only. Success/failure/custom-request are plain shells. Routes added to `website.routes.ts` with `loadComponent` pattern. `/cart` is public, all others use `authGuard`. Full UI implementation starts in Chunk 5. |
| **Status** | Done — `npx ng build` passed (exit 0), all routes load placeholder pages |

### Chunk 5: Cart Page (P-BF-001)

| Field | Value |
|-------|-------|
| **Goal** | Implement cart page with item list, AI recommendations, coupon, order summary |
| **Files to Create** | `src/app/pages/website/checkout/cart/cart.ts` + `.html` + `.css` |
| **Design Reference** | P-BF-001 |
| **Key Elements** | Breadcrumb, stepper (step 1), AI banner, cart item cards (thumb, title, provider, package, price, remove/save), "مسح السلة" button, AI recommended section (3 cards via `marketplaceService.getAiRecommendations()`), coupon input + apply, order summary sidebar, "إتمام الشراء" → `/checkout/review`, trust badges, empty cart state |
| **Testing** | Cart with items: verify list, totals, remove button, save for later. Empty cart: verify empty state CTA. Coupon: apply `WASEET10`, verify discount. Checkout button navigates to review. |
| **Notes** | `/cart` real UI implemented. Reads from `CartService` signals only. Cart items show thumb, title, provider (with verified badge), package, delivery days, AI score, level, price, remove + save-for-later buttons. Coupon input with apply/remove and success/error messages. Clear cart with confirm dialog. Empty cart state with icon, message, CTA to `/marketplace`, and AI recommendations. AI recommendations fetched from real `MarketplaceService.getAiRecommendations()` API — no mock data. Trust badges (secure payment, quality guarantee, fast delivery). Order summary sidebar + checkout button (disabled when empty). Responsive layout (mobile: sidebar moves to top, grid collapses). Marketplace offer button wiring deferred to Chunk 11. |
| **Status** | Done — `npx ng build` passed (exit 0), empty cart state verified, populated cart verified via localStorage injection |

### Chunk 6: Review Page (P-BF-002)

| Field | Value |
|-------|-------|
| **Goal** | Implement order review with deliverables, milestones, billing info |
| **Files to Create** | `src/app/pages/website/checkout/review/review.ts` + `.html` + `.css` |
| **Design Reference** | P-BF-002 |
| **Key Elements** | Stepper (step 2), AI review banner (static), order items with deliverables + milestone plans, billing info card (from `AuthStore.currentUser()`), "تعديل السلة" → `/cart`, notes card, order summary sidebar, "متابعة للدفع" → `/checkout/payment` |
| **Testing** | Verify all cart items displayed with stages. Billing info from auth store. Back to cart works. Continue to payment works. |
| **Notes** | `/checkout/review` real UI implemented. Reads cart items from `CartService` signals only. Shows AI review banner (static text), order items with thumb, title, provider (with verified badge), package, delivery days, AI score, level, price. Billing info card reads from `AuthStore.currentUser()` — shows name, email, phone, account type with fallback "—" if missing. Terms/escrow info card with static bullet points. Order summary sidebar. "تعديل السلة" links to `/cart`. "متابعة للدفع" calls `checkoutService.createOrder()` and navigates to `/checkout/payment` on success, shows error on failure. Empty cart state with CTAs to `/marketplace` and `/cart`. Responsive layout. Payment UI starts in Chunk 7. |
| **Status** | Done — `npx ng build` passed (exit 0). Design file P-BF-002.html not found in workspace, design comparison marked PARTIAL. |

### Chunk 7: Payment Page (P-BF-003)

| Field | Value |
|-------|-------|
| **Goal** | Implement payment method selection and card form |
| **Files to Create** | `src/app/pages/website/checkout/payment/payment.ts` + `.html` + `.css` |
| **Design Reference** | P-BF-003 |
| **Key Elements** | Stepper (step 3), payment method radio group (Card, Wallet, STC Pay, Apple Pay), card form (number, expiry, CVV, name) with formatting, wallet balance display (mocked: 2,000 ريال), STC Pay/Apple Pay → "قريباً" toast, terms checkbox (required), "ادفع الآن" → `checkoutService.initiatePayment()` → `/checkout/confirm`, order mini-summary, security badges |
| **Testing** | Select each payment method. Card form formatting. Terms checkbox disables pay button. Pay button calls service and navigates to confirm. STC Pay/Apple Pay show toast. |
| **Notes** | `/checkout/payment` real UI implemented. 4 payment methods: Card (available), Wallet (available), STC Pay (disabled — "قريباً" toast), Apple Pay (disabled — "قريباً" toast). Selectable radio cards with active state. Secure payment/escrow info card with bullet points. Compact OrderSummary sidebar. "رجوع للمراجعة" links to `/checkout/review`. "ادفع الآن" disabled if no method selected or processing; calls `checkoutService.initiatePayment(method)` — creates order first if `currentOrder` is null, then navigates to `/checkout/confirm` on success, shows error on failure. Empty cart state with CTAs. Responsive layout. OTP confirmation starts in Chunk 8. |
| **Status** | Done — `npx ng build` passed (exit 0). Design file P-BF-003.html not found in workspace, design comparison marked PARTIAL. |

### Chunk 8: OTP Confirm Page (P-BF-004)

| Field | Value |
|-------|-------|
| **Goal** | Implement 6-digit OTP input with countdown and verification |
| **Files to Create** | `src/app/pages/website/checkout/confirm/confirm.ts` + `.html` + `.css` |
| **Design Reference** | P-BF-004 |
| **Key Elements** | Stepper (step 4), order mini bar, OTP icon + title, masked phone display, 6-digit OTP inputs with auto-advance, countdown timer (2 min), resend button (disabled during countdown), "تأكيد الدفع" → `checkoutService.confirmPayment(otp)` → success/failure redirect, security badges |
| **Testing** | OTP auto-advance between inputs. Countdown timer decrements. Resend enabled after countdown. `123456` → success page. Wrong code → failure page. |
| **Status** | Pending |

### Chunk 9: Success / Failure Pages (P-BF-005 + P-BF-006)

| Field | Value |
|-------|-------|
| **Goal** | Implement order success and payment failure pages |
| **Files to Create** | `src/app/pages/website/checkout/success/success.ts` + `.html` + `.css` |
| | `src/app/pages/website/checkout/failure/failure.ts` + `.html` + `.css` |
| **Design Reference** | P-BF-005 (Success), P-BF-006 (Failure) |
| **Success Elements** | Success icon animation, order number card, payment summary, "what next" 3-step cards, AI note banner, CTA: "اذهب لمشاريعي" → `/client-overview/projects`, "متابعة التسوق" → `/marketplace` |
| **Failure Elements** | Failure icon, error message + code, common failure reasons list, retry → `/checkout/payment`, change payment → `/checkout/payment`, back to cart → `/cart`, support link → `/contact` |
| **Testing** | Success: verify order number from service. Failure: verify error from service. All navigation buttons work. |
| **Status** | Pending |

### Chunk 10: Custom Request Page (P-BF-007)

| Field | Value |
|-------|-------|
| **Goal** | Implement custom service request form |
| **Files to Create** | `src/app/pages/website/checkout/custom-request/custom-request.ts` + `.html` + `.css` |
| **Design Reference** | P-BF-007 |
| **Key Elements** | Page hero, AI matching banner, form section 1 (title, category, type, description), form section 2 (budget chips, deadline, provider count), form section 3 (attachments, special requirements), submit button, success state with timeline |
| **Backend** | Check if `new-project.service.ts` can be reused. May POST to `/client/requests` or new endpoint. |
| **Testing** | Form validation. Budget chip selection. Submit creates request. Success state shows expected timeline (24–48 hours). |
| **Status** | Pending |

### Chunk 11: Wire Marketplace Entry Points

| Field | Value |
|-------|-------|
| **Goal** | Connect marketplace offer page to cart flow |
| **Files to Modify** | `src/app/pages/website/marketplace/offer/offer.ts` — inject `CartService`, add `addToCart()` method, change "اطلب الآن" to add to cart + navigate to `/cart` |
| | `src/app/pages/website/marketplace/offer/offer.html` — add "أضف للسلة" button alongside "اطلب الآن", keep "طلب تفاوض" as-is |
| | `src/app/pages/website/marketplace/marketplace.ts` — add quick-add to cart on marketplace cards |
| | `src/app/pages/website/marketplace/marketplace.html` — add cart icon button on cards |
| | `src/app/pages/website/marketplace/slug/slug.ts` — add quick-add on category cards |
| | `src/app/pages/website/marketplace/slug/slug.html` — add cart icon button on cards |
| | Site header component — add cart icon with `cartService.itemCount()` badge, link to `/cart` |
| **Testing** | Click "اطلب الآن" on offer page → adds to cart → navigates to `/cart`. Click "أضف للسلة" → adds to cart → toast notification. Cart badge updates in header. Quick-add on marketplace cards works. "طلب تفاوض" still works as before (unchanged). |
| **Status** | Pending |

### Chunk 12: Full Runtime Testing

| Field | Value |
|-------|-------|
| **Goal** | End-to-end testing of the entire checkout flow |
| **Test Scenarios** | 1. Browse marketplace → add item to cart → review → pay → OTP `123456` → success page |
| | 2. Browse marketplace → add item → pay → wrong OTP → failure page → retry → correct OTP → success |
| | 3. Add multiple items → verify totals → remove one → verify recompute |
| | 4. Empty cart → verify empty state → continue shopping |
| | 5. Guest user → click "اطلب الآن" → redirect to login → login → return to offer → add to cart |
| | 6. Apply coupon `WASEET10` → verify 10% discount in review and payment |
| | 7. Cart persistence → add item → reload page → verify item still in cart |
| | 8. Stepper correct on all 4 pages |
| | 9. Responsive: mobile and tablet layouts |
| | 10. Custom request form → submit → success state |
| **Status** | Pending |

---

## 4. Chunk Status Summary

| Chunk | Description | Status |
|-------|-------------|--------|
| 0 | Analysis | Done |
| 1 | Models + CartService | Done |
| 2 | CheckoutService | Done |
| 3 | Shared components | Done |
| 4 | Routes | Done |
| 5 | Cart page (P-BF-001) | Done |
| 6 | Review page (P-BF-002) | Done |
| 7 | Payment page (P-BF-003) | Done |
| 8 | OTP confirm page (P-BF-004) | Pending |
| 9 | Success / Failure pages (P-BF-005 + P-BF-006) | Pending |
| 10 | Custom Request (P-BF-007) | Pending |
| 11 | Wire Marketplace entry points | Pending |
| 12 | Full runtime testing | Pending |

---

## 5. Questions for Mohammed Rami

These questions need answers before or during implementation. They affect architecture decisions and backend integration.

### Q1: Should `/cart` be public while checkout steps are guarded?

**Context:** The design (P-BF-001) shows a cart page that could work for guest users. Adding items to cart before login is a common e-commerce pattern. However, the checkout steps (review, payment, OTP) require authentication.

**Options:**

- **A)** `/cart` is public (no guard), checkout steps (`/checkout/*`) are guarded. Guest users can browse and add to cart, but must login at checkout. Cart persists in localStorage.
- **B)** All routes including `/cart` are guarded. User must be logged in to see the cart.

**Recommendation:** Option A — better UX, higher conversion. Cart works for guests, login prompted at checkout step.

---

### Q2: Does `marketplaceModelId` mean service/offer, not AI model?

**Context:** The `MarketplaceModel` interface in `marketplace.service.ts` represents a published service/offer by a provider. The term "model" is confusing because it could mean AI model. In the cart, we store `modelId` which is actually a marketplace service/offer ID.

**Question:** Should we rename `modelId` to `serviceId` or `offerId` in the cart/checkout interfaces for clarity? Or keep `modelId` for backend consistency?

**Recommendation:** Keep `modelId` in API payloads for backend compatibility, but use `serviceId` or `offerId` in UI-facing code and comments.

---

### Q3: Should "تواصل مع" use negotiation instead of order?

**Context:** The offer page sidebar has three buttons:
1. "اطلب الآن" — currently calls `requestService('order')`
2. "تواصل مع {provider}" — currently also calls `requestService('order')` (same as order)
3. "طلب تفاوض" — calls `requestService('negotiation')`

The "تواصل مع" (Contact provider) button calling `requestService('order')` seems incorrect — it should likely open a chat or use negotiation mode, not create an order.

**Question:** Should "تواصل مع" be changed to open a chat conversation (not an order), or should it use `requestService('negotiation')`?

**Recommendation:** "تواصل مع" should open a direct chat, not trigger an order. It should be a separate action from "اطلب الآن".

---

### Q4: Should negotiation tags be sent in the payload?

**Context:** The negotiation modal in `offer.html` (lines 508–514) has tag buttons (السعر, المدة, الخطة, أخرى) but these are static HTML with no signal binding. The `requestService()` payload only sends `{ mode, message }`. The tags are not captured or sent.

**Question:** Should we wire the negotiation tags (السعر/المدة/الخطة/أخرى) to a signal and include them in the `requestService` payload as `tags: string[]`?

**Recommendation:** Yes — wire tags to a signal and send as `negotiationTopics: string[]` in the payload. The backend can use this to categorize the negotiation.

---

### Q5: Are checkout backend endpoints ready or should we mock first?

**Context:** The `CHECKOUT_IMPLEMENTATION_PLAN.md` lists 12 backend endpoints needed for the checkout flow (§9). The existing `marketplaceService.requestService()` endpoint (`POST /marketplace/models/:id/request`) creates a conversation, not a payable order.

**Question:** Are any of these backend endpoints ready?
- `POST /checkout/order` — create order from cart
- `POST /checkout/payment/init` — initiate payment + send OTP
- `POST /checkout/payment/confirm` — verify OTP
- `POST /checkout/coupon/validate` — validate coupon
- `GET /checkout/order/:id` — fetch order details

**Options:**

- **A)** Endpoints are ready → implement with real HTTP calls immediately.
- **B)** Endpoints are NOT ready → mock all calls in `CheckoutService`, design for easy swap later.
- **C)** Some endpoints ready → tell us which ones, we mock the rest.

**Recommendation:** Start with option B (mock first), swap to real APIs when backend confirms readiness. This unblocks frontend development immediately.

---

## 6. Progress Log

| Date | Item | Action | Notes |
|------|------|--------|-------|
| 2026-08-31 | Cart/Checkout Chunk 0 | Created `CHECKOUT_IMPLEMENTATION_PLAN.md` | Analysis complete, plan documented |
| 2026-09-01 | Cart/Checkout | Analyzed offer.ts, offer.html, marketplace.service.ts, auth.store.ts | Confirmed current flow, identified modification points |
| 2026-09-01 | Phase 1 Tracker | Created `PHASE_1_EXECUTION_TRACKER.md` | This file |
