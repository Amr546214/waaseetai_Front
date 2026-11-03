# Site-control design and original identity guide

This frontend-only change is prepared for Claude's later deployment. No deployment, migration, identity publication, account change or dev database access was performed.

## Design reference

Reference: https://github.com/pmobs2030/pmo — `src/app/app.html`, `src/app/app.css`, and its style-guide page. The existing site-control pages already originate from this project. This change brings back its compact RTL section bar, pill navigation, scoped design variables, and responsive spacing while keeping the platform dashboard shell and permission rules.

The section bar filters each destination with the existing `ruleForPath` / `AdminAccessService`. It adds no alternative permission list or grant.

## Original owner-supplied guide

`public/assets/site-control/identity-guide/index.html` is generated from the uploaded `هوية وسيط AI.dc.html`. Its source hash and generator are in the adjacent `source.json`. The source guide includes both themes and all twelve sections. It is loaded only after the administrator explicitly opens it, not on every dashboard visit.

The reference is kept separate from current published values. It is labelled as the original, with editing entry points for colours, typography, icons, layout and logo assets. The original document does not automatically change after a publish; the actual server values are displayed in the editors.

- Colours, typography and layout reuse `TokenEditor` inside the identity page.
- Icons open the existing library, with its current page permission; no second icon editor is introduced.
- Logos, images and the AI mark use the existing asset editor below the guide.
- Component examples, levels, chart examples and business rules remain reference material. This change does not invent operational settings for them or make all hard-coded styling globally editable.

## Isolation and publication

The reference iframe has `sandbox="allow-scripts"` without same-origin, forms, popups or top-navigation permissions. Its embedded CSP prohibits network connections, external frames, objects and forms; embedded fonts, images and script bytes are already bundled. No application token or server data is passed to it.

A reference message is accepted only from that iframe's own WindowProxy, with a fixed message type and allowlisted section. Messages may select an editor or acknowledge rendering; they cannot upload, apply, restore or write settings. The readiness indicator waits for the reference's rendering handshake, not merely an iframe load event. Existing server authorization, version conflicts, preview and confirmation are unchanged.

The code uses the original document's embedded rendering runtime inside the isolated frame. It does not add React, Babel or another runtime to the Angular application's dependencies or global context.

## Local checks

- `node tools/check-identity-guide.cjs` runs the actual generated bundle offline in JSDOM: 26 section headings, ten edit entry points, no unresolved template expressions, no renderer errors, and only three embedded blob script requests. DOM validation is not browser pixel proof; JSDOM does not enforce CSP.
- Angular specs cover lazy loading, sandbox attributes, frame-source/message validation, no publication through messages, existing editor reuse and permission-filtered navigation.
- Existing identity and token-editor tests remain the publication/restore regression coverage.
- A real browser screenshot review is still required. Chromium download failed in this environment. No authenticated dev save, restore, multi-session check or visual parity claim is made.

To regenerate after the owner changes the original file:

```sh
python tools/import-identity-guide.py /path/to/identity.dc.html
node tools/check-identity-guide.cjs
```

Review a new source file before import. Do not add application authentication to the reference frame, loosen its sandbox, or publish imported defaults automatically.

## Handoff to Claude

The feature is stacked on the site-control verification branch (PR #322), not a separate replacement for the current integration history. Merge/rebase that prerequisite before this feature. Recheck the actual dev heads and preserve the registration and other agents' changes before any later release. Ship the `public/assets/site-control/identity-guide` directory with the frontend build, and preserve the existing `WS_IDENTITY_*` configuration through `fe-swap-env.sh`. No new backend configuration or database migration is needed for this feature. Opening or importing the guide publishes no defaults.

Final focused Angular run: 61/61 tests passed (identity, guide, shared token editor, section routing/navigation). The generated usage report matches the source. The application TypeScript check also passed. The initial failed test compile was corrected by supplying the complete access fixture and explicitly typing a synthetic MessageEvent; no production permission logic was relaxed.
