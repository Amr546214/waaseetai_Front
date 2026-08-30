# Waseet AI — Frontend

The Waseet AI frontend is an Angular 21 application that provides the public marketplace, authentication flows, and role-based dashboards for clients, service providers, marketing brokers, and super administrators.

This document is the operational and architectural reference for the frontend. Routes, commands, and implementation notes are based on the current code under frontend/.

## Contents

- [Requirements and setup](#requirements-and-setup)
- [Available commands](#available-commands)
- [Environments and configuration](#environments-and-configuration)
- [Architecture](#architecture)
- [Directory structure](#directory-structure)
- [Routing](#routing)
- [Authentication and authorization](#authentication-and-authorization)
- [API and state management](#api-and-state-management)
- [Design system and shared components](#design-system-and-shared-components)
- [SSR and hydration](#ssr-and-hydration)
- [Testing and builds](#testing-and-builds)
- [Adding a feature](#adding-a-feature)
- [Troubleshooting](#troubleshooting)
- [Contribution standards](#contribution-standards)

## Requirements and setup

- Node.js compatible with Angular 21.
- npm 10.9.3 or a compatible version.
- Angular CLI 21.1.x.
- The backend running on http://localhost:5009 by default.

    cd frontend
    npm install
    npm start

Open http://localhost:4200/ after the development server starts.

Verify the toolchain:

    node --version
    npm --version
    npx ng version

## Available commands

| Command | Purpose |
|---|---|
| npm start | Start the Angular development server |
| npm run build | Create a production build in dist/frontend |
| npm run watch | Continuously rebuild with the development configuration |
| npm test | Run unit tests through Angular/Vitest |
| npm run serve:ssr:frontend | Serve the generated SSR output after a build |
| npm run ng -- <command> | Pass a command directly to Angular CLI |

No E2E framework is currently configured in package.json. Therefore, ng e2e is not an executable test command until Playwright or Cypress is added and configured.

## Environments and configuration

| File | Purpose | API base URL |
|---|---|---|
| src/environments/environment.ts | Default development configuration | http://localhost:5009/api |
| src/environments/environment.dev.ts | Explicit development configuration | http://localhost:5009/api |
| src/environments/environment.prod.ts | Production configuration | /api |

Important configuration keys are environment.url_api, environment.socketUrl, environment.google_client_id, environment.production, and environment.appVersion.

Production uses url_api = /api and socketUrl = / so the frontend can use the same origin and automatically support wss over HTTPS. Never place real secrets in environment files because they are bundled into the browser application.

### Google OAuth

The Google provider is registered in src/app/app.config.ts. Add every real browser origin to Google Cloud Console. For local development, this normally includes:

    http://localhost:4200
    http://127.0.0.1:4200

The error The given origin is not allowed for the given client ID is a Google Cloud configuration issue, not an Angular error. Google expects the origin only, not a page path such as /auth/login.

## Architecture

    App shell
    ├── Core       Cross-application services, auth, guards, interceptors, and models
    ├── Layouts    Website, authentication, and dashboard shells
    ├── Pages      Feature pages grouped by business domain
    └── Shared UI  Reusable visual and interaction components

Architectural rules:

1. Keep cross-application services and models in core/.
2. Give each feature its own route file and use lazy loading where practical.
3. Public pages must not depend on a user session; private actions should check authentication at action time.
4. Route all HTTP traffic through authInterceptor.
5. Mutate session and identity state through AuthStore instead of writing storage directly in components.

## Directory structure

    frontend/
    ├── angular.json
    ├── package.json
    ├── tsconfig*.json
    ├── public/                         # Public static assets
    ├── src/
    │   ├── index.html
    │   ├── main.ts
    │   ├── styles.css                  # Global styles, fonts, and design tokens
    │   ├── environments/
    │   └── app/
    │       ├── app.config.ts            # Providers, HTTP, Router, and OAuth
    │       ├── app.routes.ts            # Main route tree
    │       ├── app.routes.server.ts     # SSR configuration
    │       ├── core/
    │       │   ├── guards/
    │       │   ├── interceptors/
    │       │   ├── models/
    │       │   ├── services/
    │       │   ├── store/
    │       │   └── utils/
    │       ├── layouts/
    │       │   ├── website-layout/
    │       │   ├── auth-layout/
    │       │   └── dashboard-layout/
    │       ├── pages/
    │       │   ├── website/
    │       │   ├── auth/
    │       │   └── dashboard/
    │       └── sheards/                 # Shared UI — current project name
    └── dist/                            # Build output; do not edit manually

> sheards is the current directory name. It can be renamed to shared in a dedicated migration, but a partial rename will break imports.

## Routing

The main route tree is defined in src/app/app.routes.ts. Public pages use the website layout, authentication pages use the auth layout, and dashboards use the dashboard layout.

### Public pages — no login required

| Route | Purpose |
|---|---|
| / | Home page |
| /marketplace | Marketplace |
| /marketplace/:slug | Category or slug page |
| /marketplace/offer/:id | Offer details |
| /about | About page |
| /blog | Blog |
| /contact | Contact page |
| /provider-profile/:id | Public provider profile |
| /privacy | Privacy policy |
| /terms | Terms and conditions |
| /cookies | Cookie policy |

### Authentication

| Route | Purpose |
|---|---|
| /auth/login | Sign in |
| /auth/register | Create an account |
| /auth/forget-password | Reset password |
| /auth/verify-otp | Verify OTP |

guestGuard prevents authenticated users from opening authentication pages. verificationGuard restricts the OTP page to users in pending verification state.

### Protected dashboards

| Prefix | Role |
|---|---|
| /client-overview | Client |
| /provider-overview | Service provider |
| /marketer-overview | Marketing broker |
| /supper-admin-overview | Super administrator |

Detailed child routes are maintained in:

    src/app/pages/dashboard/clients-overview/client.routes.ts
    src/app/pages/dashboard/provider-overview/provider.routes.ts
    src/app/pages/dashboard/marketer-overview/marketer.routes.ts
    src/app/pages/dashboard/supper-admin-overview/supper-admin.routes.ts

Example route:

    {
      path: 'example',
      loadComponent: () => import('./example/example').then(m => m.Example),
      data: { title: 'Example' }
    }

Use loadComponent for large or independent pages. Add guards only when the route is genuinely protected.

## Authentication and authorization

The session source of truth is src/app/core/store/auth.store.ts. It provides:

- currentUser and token as signals.
- isAuthenticated and isPendingVerification as computed signals.
- isInitialized$ to indicate that session initialization is complete.
- authenticate(token, user) to persist a successful session.
- setPendingVerification(userId) for OTP flows.
- updateUser and updateUserStatus for synchronization.
- logout() to clear the session and navigate away.

### Session storage

The frontend reads the waseet_token cookie and falls back to:

    waseet_token
    access_token
    token
    waseet_user
    waseet_pending_user_id

In production, prefer secure backend-issued cookies (HttpOnly, Secure, and SameSite) and do not treat localStorage as secure secret storage. Never log access tokens to the console or analytics systems.

### Guards

Main guard files:

    src/app/core/guards/auth.guards.ts
    src/app/core/guards/quiz-lock.guard.ts

- authGuard protects dashboard shells and preserves returnUrl.
- clientGuard, providerGuard, marketerGuard, and superAdminGuard enforce role access.
- guestGuard prevents authenticated users from opening login and registration.
- verificationGuard controls the OTP flow.
- quizLockGuard prevents leaving an incomplete assessment.

## API and state management

### HTTP interceptor

The HTTP client is configured in src/app/app.config.ts:

    provideHttpClient(withFetch(), withInterceptors([authInterceptor]))

src/app/core/interceptors/auth.interceptor.ts:

1. Reads the token from AuthStore, then cookies, then localStorage.
2. Adds Authorization: Bearer <token> when a token is available.
3. Enables withCredentials for cookie-based sessions.
4. Prevents unauthenticated protected calls during SSR.
5. Clears the session on 401 only when the failed request carried authentication.
6. Routes account activation and OTP-related 403 responses to verification.

jwt.interceptor.ts is a compatibility alias for authInterceptor. Do not add a second interceptor for the same responsibility.

### API services by domain

| Service | Responsibility |
|---|---|
| auth-api.service.ts | Login, registration, OTP, and session operations |
| marketplace.service.ts | Marketplace, categories, and favorites |
| project-api.service.ts | Projects, requests, attachments, and AI suggestions |
| new-project.service.ts | Project creation and editing |
| provider-api.service.ts | Provider operations |
| provider-profile.service.ts | Provider profiles |
| profile-api.service.ts | Profile data |
| dashboard-api.service.ts | Dashboard summaries |
| client-finance.service.ts | Client wallet and transactions |
| marketer-overview.service.ts | Broker dashboard |
| marketer-profile.service.ts | Broker profile |
| specialty.service.ts | Specialties and categories |
| offers.service.ts | Offers |
| account.service.ts | Linked accounts |
| chat.service.ts | Conversations |
| video-call.service.ts | Video calls |
| notification-engine.service.ts | Notifications |
| gamification.service.ts | Points and gamification |
| anti-cheat.service.ts | Assessment protection |

### Models and response contracts

Shared models live in src/app/core/models/. api.model.ts contains ApiResponse<T>, ApiErrorPayload, and project request payloads.

When adding an endpoint:

1. Define an explicit request and response model.
2. Prefer Observable<ApiResponse<T>> over Observable<any> when the contract is known.
3. Normalize response.data inside a service or adapter.
4. Handle loading, error, empty, and success states in the feature.

Example:

    loadItems(): void {
      this.loading.set(true);
      this.api.getItems().subscribe({
        next: response => this.items.set(response.data ?? []),
        error: error => this.error.set(error?.error?.message ?? 'Unable to load data'),
        complete: () => this.loading.set(false)
      });
    }

### Public pages and 401 responses

Public content must work without a token. An endpoint such as GET /api/marketplace/favorites is private and must not be called while creating public-page components unless authStore.isAuthenticated() is true.

When a guest triggers a private action, navigate to login with returnUrl instead of sending a request that is expected to fail with 401. This keeps public pages free of authentication redirects and console noise.

Use AuthStore, DashboardStore, ThemeService, ChatStateService, and NotificationEngineService for shared state. Use signals for local state and clean long-lived subscriptions with takeUntilDestroyed or equivalent lifecycle cleanup.

The application uses socket.io-client for conversations and real-time updates. Close connections and listeners when a feature is destroyed, and do not open a new connection on every navigation.

## Design system and shared components

### Layouts

- website-layout: Public header, footer, and page shell.
- auth-layout: Authentication shell with shared navigation.
- dashboard-layout: Dashboard shell and sidebar.

### Shared UI

src/app/sheards/ contains navbar, footer, card, phone-input, not-found, robot-avatar, and project-mini-chat, as well as dashboard components such as sidebar, nav-dashboard, and video-call-modal.

Design rules:

- Preserve RTL support for Arabic UI.
- Use design variables from src/styles.css instead of arbitrary new colors.
- Keep component CSS beside its component; reserve global styles for shared tokens and primitives.
- Test mobile and desktop layouts.
- Add aria-label attributes and keyboard behavior to interactive elements.
- Use RouterLink for internal navigation.
- Use ngSkipHydration only when required, and document the reason.

Local fonts are defined in src/styles.css. Public assets are served from public/ and referenced with paths such as /images/....

## SSR and hydration

The application uses provideClientHydration(withEventReplay()).

Therefore:

- Do not access window, document, or localStorage during SSR without isPlatformBrowser.
- Do not issue private API calls during SSR without a request-scoped session.
- Avoid unstable random DOM and timestamps during hydration.
- Use ngSkipHydration carefully when server and browser output intentionally differ.

Run SSR after building:

    npm run build
    npm run serve:ssr:frontend

## Testing and builds

### Build

    npm run build

A successful build generates browser and server bundles. Warnings do not fail the build, but should be reviewed, especially unnecessary optional chaining, unused imports, CommonJS dependencies, and initial bundle size.

### Unit tests

    npm test

Components using Router or HTTP should provide the appropriate test providers, such as provideRouter and provideHttpClientTesting. Unit tests should not rely on real browser globals.

Pre-PR verification:

    npm run build
    git diff --check

### Manual smoke test

1. Open / as a guest and confirm that no /favorites request is sent.
2. Open /marketplace and /marketplace/offer/<id> without signing in.
3. Click favorite as a guest and confirm navigation to login with returnUrl.
4. Sign in and confirm favorites load and the correct dashboard opens.
5. Sign out and open a protected route.
6. Refresh an internal route in production/SSR mode.
7. Test Google OAuth from an origin registered in Google Cloud.

## Adding a feature

1. Decide whether the feature is public or protected and define its authorized roles.
2. Add models under core/models.
3. Add a typed method to the appropriate domain service.
4. Create the page/component with loading, error, empty, and success states.
5. Add a lazy-loaded route with data.title and a guard when required.
6. Add navigation links and verify responsive and RTL behavior.
7. Review SSR behavior and add unit tests for important states.
8. Run the build, git diff --check, and a manual smoke test.

Do not modify AuthStore or authInterceptor from a regular feature. Changes to either affect the entire application and require login, logout, 401, and SSR regression testing.

## Troubleshooting

### The application redirects to /auth/login

- Inspect Network and identify the request returning 401.
- Confirm that a private endpoint is not called from a public page without an auth check.
- Clear stale cookies and localStorage, then reload.
- Confirm that the frontend token is accepted by the backend.

### Can't find /api/api/...

The /api prefix was added twice. Use environment.url_api as the base URL and make the service append only /marketplace or the relevant resource path.

### Google origin is not allowed

Add the exact browser origin to Google Cloud Console, for example http://localhost:4200. Do not add a page path.

### A link does not navigate

Inspect Console and Network, look for a 401 after navigation, and confirm that routerLink and the route exist in the route tree. Perform a hard refresh after changing a build or service worker.

### listen EPERM during build

The execution environment may prevent Angular SSR/build from opening a local listener. Re-run in an environment that allows it. If a real TypeScript or Angular compiler error appears, fix it before accepting the build.

### SSR or hydration mismatch

Search for window, document, or localStorage inside constructors or templates. Move browser-only code to an appropriate lifecycle hook and guard it with isPlatformBrowser.

## Contribution standards

- Use consistent English names for code and clear Arabic translations for user-facing text where required.
- Do not introduce any in new code unless a temporary, documented reason exists.
- Do not duplicate endpoint or authentication logic inside components.
- Never commit secrets or access tokens.
- Do not edit dist/ manually.
- Keep changes small and reviewable.
- Include affected paths and verification commands in pull request descriptions.

## Project references

    src/app/app.config.ts
    src/app/app.routes.ts
    src/app/core/store/auth.store.ts
    src/app/core/interceptors/auth.interceptor.ts
    src/app/core/guards/auth.guards.ts
    src/app/core/models/api.model.ts
    src/app/pages/website/website.routes.ts
    src/app/pages/auth/auth.routes.ts
    src/styles.css
    package.json
