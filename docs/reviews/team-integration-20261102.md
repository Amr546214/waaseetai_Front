# Frontend team integration review 2026 11 02

This branch combines the team's report fixes with the existing dev integration line. It targets `int/settings-fees-fe`, not `main`. No backend, database, account or financial operation is changed. The uploaded Reports document was reviewed as reference; its screenshots and user data are not copied into the repository.

## Sources and attribution

| Contributor | PRs reviewed | Work retained |
| --- | --- | --- |
| KariMuhammad | #303, #304, #306, #307, #308, #309, #310, #311, #312 | Request review/PDF, compact specialty picker, profile tour, session isolation, account/withdrawal UI, notification state, typography, request and contract workflow display |
| ziadhassanein21 | #313, #315 | Theme switching, chat layout, disclosure cleanup, accessible dialogs, shared dashboard footer |
| EmanEmam2003 | #314 | KYC upload response handling, negotiation input validation, support attachment selection UI |

Several Karim PRs contain equivalent cherry-picked changes. Their combined descendant `e89be272` is integrated once instead of replaying overlapping variants. Ziad #315 includes #313. The integration retains the contributors' commits as parents. Older open PRs are not merged indiscriminately: the existing dev line already carries earlier work, and deferred currency/registration work is outside this review.

## Integration baseline

- Dev integration branch at review start: `0941da2ed3f9903b7b67571dbca700e5004b3c28` (includes performance head `b3d8fbf7`).
- Main at review start: `488dac5e52c695f194c6552f72e71ecbd3f77f6a`. Its README-only changes are preserved.
- Team heads: `f9ad876206f6049d320b6fd84dbfa452f4cdfb09`, `50bbf4e9489ccad3e6e96127d4e743e2a64ba0f7`, `e89be27247e1aa6ae264fc54bc7c39836d3969a2`.

## Corrections made during integration

- Resolved template, stylesheet, import and layout conflicts without replacing the live identity, permission or performance implementations with older versions.
- Preserved the admin sidebar width, dynamic brand, centralized font family, platform date helpers, theme tokens and email-channel override.
- Restored lost icon bindings. New UI drawings use existing approved keys, so no backend allow-list change is needed. Two keys whose consumers were removed stay in the unused library with explicit reasons in `tools/retired-inline-icons.json`.
- Fixed a broken support ticket template caught by the Angular production compiler.
- Rejected a regression claiming AI watches every chat with 97% accuracy. The existing truthful support/dispute-review notice remains.
- Removed fabricated 4,500/7,000 SAR dispute amounts, invented completed evidence/settlement steps and an unimplemented evidence form that claimed successful upload after only mutating an array.
- Kept the live theme transition fix and made theme backgrounds consume `--pg`, so branding changes remain effective.
- Restored phone-search focus, visible notification switch states and legal links, while retaining the platform's authority to disable optional email.
- Removed a frontend-only minimum-age rule. The reviewed backend DTO accepts past dates and does not enforce an 18-year policy; the UI must not invent one.
- Kept deployed dependency versions. No new code imports CDK or needs the unrelated dependency upgrades/downgrade in the team branch.
- Updated obsolete tests for token-based typography and a single shared footer. Permission and monetary assertions were not relaxed.

## Validation

The initial integrated run had 5,095 tests, 5,003 passed, 83 failed, 9 skipped. The isolated baseline run with the same runtime/config had 5,040 tests, 4,952 passed, 79 failed, 9 skipped. Comparison by full test name found 14 added failures and 10 baseline failures absent from the integrated run. The added failures were investigated rather than treating equal counts as proof.

Production compilation succeeded after the initial conflict repairs. The three Node tests for negotiation-dialog theme ownership and the progress ring passed. Identity generators and targeted integration tests were also run. The final complete run on the repaired integration has **5,096 tests: 5,026 passed, 61 failed, 9 skipped**. Comparing `(source file, full test name)` with the isolated baseline gives **zero added failures** and 18 baseline failures absent in this run. Some absences are timing-sensitive tests, so they are not all claimed as fixes. The comparison used one Vitest worker with file parallelism disabled on both trees.

A focused run before the final full run covered 184 tests (180 passed, 2 failed, 2 skipped): one failure was pre-existing, and the other was a timeout caused by recomputing the complete icon report inside a second guard. That duplicate work was removed; the final full run passes that guard. The separate usage guard still compares the generated report against actual sources.

The release production build passed after the full test run. A subsequent review found the team budget-display helper truncated cents and could duplicate dollar signs or append dollars to unavailable/foreign-currency text. That helper was corrected and covered by four new boundary tests exercising the production method through the TypeScript AST. Together with the three existing dialog/progress tests, the Node run is **7/7**. The complete Angular suite was not repeated after this isolated formatter correction; the production build was repeated.

Final checks: `inline-icon-keys`, `icon-real-library` and `icon-usage-report` must all match the sources; `git diff --check` is clean.

## Remaining scope and limits

- Selecting ticket attachments is not a working server upload: `CreateTicketPayload` has no attachment contract. The page explains this and refuses to silently submit a ticket without the selected files. This issue is not closed.
- Additional evidence after opening a dispute has no implemented server submission path here. The UI does not claim upload success.
- The report also includes backend issues: chat history after acceptance, stale stages, email delivery, presence/typing, meeting screen sharing, payment state and the registration proof flow. This frontend integration does not establish that those are fixed.
- No real-user login, live payment, email, server deployment or database write was performed.
- Browser binaries could not be downloaded in this execution environment. No production-browser visual comparison is claimed. Production compilation and unit tests do not replace that check.
- SSH from this environment to the dev server returns `Network is unreachable`. Deployment is not performed or represented as completed.

## Review and deployment

Review this PR against the integration branch, not against the much older main. Preserve `fe-swap-env.sh`, `WS_IDENTITY_UPSTREAM` and `WS_IDENTITY_HOST` when a connected deployment environment releases it. Check the actual deployed heads immediately before release and run the identity deployment check afterward. Do not overwrite newer registration or site-control changes. No migration is required for this frontend branch.
