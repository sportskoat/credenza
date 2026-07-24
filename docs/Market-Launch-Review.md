# Credenza Fashion Market Launch Review

**Review date:** July 24, 2026  
**Product:** Credenza Fashion PWA  
**Strategy source:** `docs/Monetization.md`

## Executive verdict

Credenza has a strong product foundation.

The application is suitable for a limited free beta after the major launch fixes.

The application is not ready for a public paid launch.

Most core haul workflows now work. The product has a clear user purpose.

However, security, data reliability, legal, and trust defects block the paid launch.

Use this revenue model:

1. Keep the complete haul workflow free.
2. Earn affiliate revenue from outbound agent clicks.
3. Sell continuity, history, storage, and advanced planning.
4. Do not sell product access or seller access.

## Product rule

Credenza must remain an independent agent haul planner.

Credenza must not become a marketplace.

Credenza must not replace buying agents.

Credenza must not help users evade customs requirements.

Use this rule from `docs/Monetization.md`:

> If a feature does not reduce uncertainty before the agent click, or reduce chaos after QC, it is probably wrong work.

## Current launch score

| Area | Score | Assessment |
|---|---:|---|
| Product usefulness | 3/4 | The main haul workflow works and has clear value. |
| User experience | 2/4 | The design is strong, but accessibility and trust need work. |
| Data reliability | 2/4 | Storage recovery is strong, but hydration and migration defects remain. |
| Security | 1/4 | The client credential, SSRF, and abuse controls block launch. |
| Revenue operations | 1/4 | Affiliate support exists, but billing and entitlements do not exist. |

The overall readiness score is 1.8 out of 4.

## Audit snapshot

The audit examined this repository state:

- The active branch was `mobile-fix-loop`.
- The reviewed HEAD was `e984a55`.
- The production boundary was `deploy-2026-07-23` at `f0b7857`.
- Twelve commits existed after the production tag.
- Several tracked and untracked changes also existed.

The repository changed during the audit.

Treat this report as a verified snapshot, not a final release manifest.

The untracked sheet files are required by lazy imports.

A partial commit would break the application build.

Do not deploy until the release commit contains all required sheet modules.

## What the recent work adds

The recent work improves the correct product.

It does not move Credenza toward a marketplace.

The application now provides these functions:

- The application imports Reddit hauls.
- The application creates multiple item cards.
- The application stores canonical marketplace links.
- The application adds agent referral data during outbound navigation.
- The application creates named hauls.
- The application shows haul status counts.
- The application stores body measurements.
- The application stores category fit preferences.
- The application stores separate warehouse QC images.
- The application records GL and RL decisions.
- The application estimates item and haul weight.
- The application protects destructive import actions.
- The application lazy-loads six large sheets.
- The application supports Gallery and Blackout themes.

These changes follow the strategy in `docs/Monetization.md`.

## Verified quality results

The latest complete test run produced these results:

```text
Test files: 15 passed
Tests: 198 passed
ESLint errors: 0
ESLint warnings: 59
TypeScript errors: 0
Production dependency vulnerabilities: 0
```

These results show a useful engineering foundation.

However, the existing tests do not cover several launch risks.

## Launch blockers

### 1. Prevent item loss during storage loading

The application enables empty-shelf actions while storage still loads.

A delayed storage result can replace a newly created item array.

A fast user can stash an item and then lose it.

Relevant code exists near `credenza-fashion.jsx:8180-8184` and `credenza-fashion.jsx:8447-8494`.

Lock capture until storage loading finishes.

Alternatively, merge loaded items with actions that occurred during loading.

Add a test with delayed storage loading.

### 2. Preserve Reddit poster information

The current migration preserves these fields:

- `weightGrams`
- `qcPhotos`
- `qcNote`
- `qcVerdictAt`

The current migration does not preserve `posterStats`.

Imported poster statistics can disappear after a reload.

The importer also does not store the poster username on each item.

Preserve both values in `migrateItem`.

Add a reload test for the imported poster information.

Retain the original haul text or create a first-class import record.

### 3. Replace the client credential design

The browser reads a function credential from a `VITE_*` variable.

Relevant code exists near `credenza-fashion.jsx:876-899`.

Every visitor can extract this value from the browser bundle.

The credential cannot identify one user.

The server cannot apply a reliable user quota.

The server cannot revoke access for one user.

Replace this design with server-issued user sessions.

Authorize each paid request on the server.

Rotate the exposed credential after the replacement system is active.

Never place the replacement credential in a web or extension bundle.

### 4. Fix the Chart Vision SSRF defect

`preview/netlify/functions/chart-vision.js:27-79` accepts and fetches user-selected image URLs.

The function does not reject private or special-use network addresses.

The function also follows redirects without validating each destination.

An attacker can use the function to request internal network resources.

Apply these controls:

- Allow only the required Yupoo image hosts.
- Reject private and special-use addresses.
- Reject local and metadata hostnames.
- Disable automatic redirects.
- Validate each redirect destination.
- Pin the validated network address.
- Stream responses through strict byte limits.
- Limit the total images in each request.

Add tests for private addresses, encoded addresses, redirects, and DNS changes.

### 5. Add cost and abuse controls

The paid functions lack effective user-level controls.

This issue affects Chart Vision, Ask, Resolve, and Yupoo processing.

Add these controls:

- Add a per-user request limit.
- Add a per-IP request limit.
- Add a route-specific request limit.
- Add a concurrency limit.
- Add a request-body limit.
- Add an AI token limit.
- Add a daily Anthropic cost budget.
- Return `429` for exceeded limits.
- Add traffic and cost alerts.
- Record request outcomes without sensitive content.

Also limit the Ask query length.

Limit the Yupoo HTML response size.

### 6. Publish the required legal pages

Publish a complete privacy notice before the public launch.

The notice must explain:

- Shelf storage.
- Body-profile storage.
- Browser storage.
- Extension storage.
- Service-worker caches.
- Outbound click records.
- Server enrichment requests.
- Anthropic processing.
- Retention periods.
- Export procedures.
- Deletion procedures.

Publish product terms.

Publish a working support contact.

Add a complete local-data deletion control.

The current Clear action does not remove all Credenza data.

It leaves preferences, measurements, analytics, and other records.

### 7. Fix misleading trust surfaces

The reviewed production onboarding included a Log in action.

The action did not start an authentication flow.

Remove the action until real authentication exists.

The sample shelf creates generic bookmark cards.

Replace those cards with one realistic fashion haul.

The sample should teach capture, sizing, QC, status, and Buy actions.

The public FAQ describes Pro features without an available paid product.

Show a waitlist until pricing, checkout, entitlements, and support exist.

### 8. Remove consumer referral controls

`AgentSheet.jsx` lets consumers change referral codes.

A consumer can replace Credenza attribution.

Remove these fields from the consumer interface.

Keep referral configuration in server settings or deployment configuration.

Add a short affiliate disclosure near each commission-producing Buy action.

### 9. Replace the public replica-first metadata

`preview/index-fashion.html` describes replica fashion finds.

This statement creates unnecessary platform and legal risk.

Use the safer description from `manifest.webmanifest`.

Describe Credenza as an independent haul planning tool.

State that purchases occur through external buying agents.

Do not present Credenza as a marketplace.

### 10. Fix the primary accessibility defects

The custom mobile card dialog does not manage focus completely.

It does not reliably trap focus or restore focus to the trigger.

Use the existing native `ModalShell` where possible.

The haul combobox lacks standard arrow-key option navigation.

The carousel lacks a complete active-option relationship.

A later CSS rule removes the favorite focus indicator.

Several mobile controls remain smaller than 44 pixels.

Add Fashion-specific Axe tests and real keyboard tests.

### 11. Do not ship the current extension

`extension/src/main.jsx` still imports the legacy application.

Its storage does not synchronize with the Fashion PWA.

The extension also has outdated product metadata and broad permissions.

Exclude the extension from the first Fashion launch.

## Tier A completion status

All six Tier A features have meaningful implementation.

All six features remain partial against the complete written requirements.

### A1: Reddit haul import

This feature is substantially complete.

The parser handles links, labels, categories, review text, and poster measurements.

Add record limits, file limits, and complete input validation.

Preserve poster information across reloads.

Retain the original haul text for later reparsing.

### A2: Agent-independent Buy actions

This feature is substantially complete.

Keep stored marketplace URLs canonical.

Add referral information only during outbound navigation.

Remove consumer referral-code editing.

Add a first-Buy agent choice.

Add a visible original-link action.

Hide unverified agent routes or show a clear warning.

### A3: First-class haul pipeline

This feature is partly complete.

The application shows counts, costs, ready items, and total weight.

Named hauls are repeated `item.project` values.

They are not first-class stored records.

Create a haul model with stable identifiers.

Add these pipeline stages:

- Show Wanted.
- Show Bought.
- Show Warehouse.
- Show GL.
- Show RL.
- Show Returned.
- Show Shipped.
- Show Received.

Add budgets, history, parcel records, and archive state.

Exclude returned items from the haul weight total.

### A4: Body profiles and size decisions

The basic feature works.

Keep one body profile free.

Add multiple profiles and fit history to Pro.

Add the usual tops, bottoms, and shoes sizes to the main profile.

Do not describe deterministic local summaries as AI summaries.

### A5: Warehouse QC

The basic GL and RL feature works.

Add a clear QC URL-paste flow.

Suggest Returned or Exchange after an RL decision.

Add image-storage limits and quota recovery.

Add QC-specific persistence tests.

### A6: Shipping-weight estimates

The basic feature works.

Add volumetric-weight estimates.

Add packaging adjustments.

Add a clear estimate disclaimer.

Explain that the buying agent provides the final measurement.

## Tier B status

### B1: Bulk agent checklist

A structured export helper exists in `credenza-haul-export.js`.

The helper is not connected to the interface.

Add a selected-item checklist before adding CSV output.

### B2: Seller memory

Items contain seller and batch fields.

No first-class seller record exists.

Add private seller notes and personal outcome history later.

Do not create public seller rankings.

### B3: Duplicate handling across hauls

Canonical duplicate detection exists.

The application suppresses duplicates or opens the existing item.

Add explicit warn, merge, and link choices.

### B4: Parcel mode

This feature is absent.

Add parcel selection, packaging preferences, and shipment notes.

### B5: Tracking

This feature is absent.

Add a tracking field and a 17Track deep link later.

### B6: Read-only sharing

This feature is absent.

Add private, expiring share links after cloud ownership exists.

## Recommended free product

The free product must complete the full affiliate path.

Keep these functions free:

- Keep link capture free.
- Keep Reddit haul import free.
- Keep named hauls free.
- Keep status tracking free.
- Keep agent Buy actions free.
- Keep one body profile free.
- Keep basic fit decisions free.
- Keep basic warehouse QC free.
- Keep category weight estimates free.
- Keep manual JSON backup free.
- Keep basic CSV export free.
- Keep canonical marketplace URLs free.

Do not limit the first Buy action.

Do not limit users before they understand the product.

Do not charge for seller or product access.

These restrictions would reduce affiliate traffic.

## Recommended Pro package

Sell workflow continuity and advanced planning.

### Pro should include these functions

1. **Encrypted cloud backup**

   Store a recoverable copy of the user shelf.

2. **Multi-device synchronization**

   Synchronize hauls, profiles, QC decisions, and statuses.

3. **Version history**

   Restore deleted or damaged shelf records.

4. **Multiple body profiles**

   Support partners, family members, and different measurement sets.

5. **Fit history**

   Record ordered sizes, outcomes, and future size decisions.

6. **Expanded QC storage**

   Increase image counts and preserve higher-quality images.

7. **Advanced parcel planning**

   Estimate volumetric weight, packaging changes, and parcel splits.

8. **Higher chart-scan limits**

   Provide more AI size-chart scans with clear monthly limits.

9. **Bulk agent checklists**

   Export item URLs, sizes, colors, notes, and QC decisions.

10. **Advanced exports**

    Provide parcel, receipt, and workflow exports.

11. **Expiring haul shares**

    Share a private read-only haul without exposing the complete account.

12. **Storage deadline warnings**

    Warn users before agent warehouse storage periods expire.

13. **Priority recovery support**

    Help paid users recover synchronized or damaged data.

## Recommended limits

Start with simple limits.

| Capability | Free | Pro |
|---|---|---|
| Body profiles | Provide one profile. | Provide multiple profiles. |
| QC images | Provide five images per item. | Provide up to 25 images per item. |
| Cloud synchronization | Do not include synchronization. | Include encrypted synchronization. |
| Version history | Do not include history. | Keep at least 30 days. |
| AI chart scans | Provide a small monthly allowance. | Provide a larger monthly allowance. |
| Parcel planning | Provide basic weight totals. | Include volumetric and split planning. |
| Exports | Provide JSON and basic CSV. | Include advanced parcel exports. |
| Sharing | Provide no hosted sharing. | Include private expiring links. |

Enforce AI and storage limits on the server.

Show each limit inside the application.

Do not use hidden fair-use limits.

## Recommended price

Start with this price:

- Charge **$5.99 each month**.
- Charge **$39 each year**.
- Make the annual plan the default offer.
- Offer a 14-day Pro trial.
- Do not require payment for the first trial test.

A lower market test can use $4.99 monthly and $39.99 yearly.

Raise the annual price to $49 after the first twenty paying customers.

Do not launch a lifetime plan during the first six months.

Later, test a $99 lifetime plan for local Pro functions.

Do not include unlimited cloud storage or AI processing in lifetime access.

## Affiliate revenue design

Use this path:

1. The user captures an item.
2. Credenza stores the canonical marketplace URL.
3. The user organizes the item inside a haul.
4. Credenza reduces size, QC, and shipping uncertainty.
5. The user selects a buying agent.
6. Credenza adds the configured referral information.
7. Credenza opens the agent destination.
8. Credenza records a privacy-safe outbound event.

Store these event fields:

- Store the selected agent.
- Store the event time.
- Store the marketplace.
- Store whether Credenza wrapped the URL.
- Store a hashed item identifier.

Do not store the raw marketplace URL in analytics.

Show the affiliate disclosure before or beside the Buy action.

Do not change links silently inside the capture extension.

Do not rank agents by commission.

Keep the original link available.

Affiliate revenue must start before aggressive Pro restrictions.

## Entitlement architecture

Do not trust a client-side `isPro` value.

Use a server-authoritative entitlement record.

Include these fields:

- Include the plan.
- Include the billing status.
- Include the entitlement source.
- Include the expiry time.
- Include the grace period.
- Include the feature limits.
- Include the current usage.
- Include the last verification time.

Use these controls:

- Use authenticated server sessions.
- Verify each paid action on the server.
- Process billing webhooks idempotently.
- Cache a signed entitlement for offline use.
- Give expired accounts a short grace period.
- Keep local data after cancellation.
- Stop new cloud writes after the grace period.
- Provide account export.
- Provide account deletion.
- Provide invoice and cancellation access.

A merchant-of-record provider can reduce global tax work.

Use Stripe only if Credenza can manage tax and compliance obligations.

## PWA and performance work

The current initial JavaScript and CSS total about 180 KB with gzip compression.

The size is acceptable for a first beta.

However, several implementation defects need attention.

### Fix these PWA defects

- Make required precache failures reject service-worker installation.
- Serve immutable precached assets from the cache first.
- Add runtime-cache limits and expiration.
- Remove the unused 352 KB Inter font.
- Keep lazy sheet chunks outside the install precache.
- Show a loading state while a sheet chunk loads.
- Preserve the staged-update action until the user applies it.
- Report service-worker registration failures.
- Match the launch color to the default Blackout theme.

### Fix these performance defects

- Stop updating React state during every animation frame.
- Stop Gallery animation when reduced motion is active.
- Remove duplicate full-screen ambient backgrounds.
- Avoid serializing the complete shelf after each small change.
- Batch saves and store image data separately.
- Correct the unused `data-theme="dark"` selectors.

These defects do not all block the first web beta.

They block a reliable installed-PWA marketing push.

## Required test additions

Add these tests before the paid launch:

- Test delayed storage hydration.
- Test Reddit poster-data migration.
- Test image-heavy quota recovery.
- Test private-address SSRF rejection.
- Test redirect destination validation.
- Test request limits and `429` responses.
- Test AI cost-budget enforcement.
- Test offline installation failure.
- Test offline navigation.
- Test service-worker updates.
- Test cache limits.
- Test reduced-motion behavior.
- Test delayed lazy chunks.
- Test mobile dialog focus management.
- Test combobox keyboard behavior.
- Test the complete entitlement lifecycle.
- Test duplicate billing webhooks.
- Test cancellation and grace periods.
- Run Axe against the Fashion application.
- Run real-browser mobile PWA tests.

## Delivery estimate

These estimates assume one experienced full-time engineer.

They also assume part-time design and legal support.

### Free affiliate launch

Allow **four to six weeks**.

This launch includes:

- Fixing storage hydration.
- Fixing Reddit poster-data migration.
- Fixing the security design.
- Fixing Chart Vision SSRF.
- Adding abuse controls.
- Completing the legal pages.
- Adding complete local deletion.
- Correcting onboarding and metadata.
- Completing the Tier A gaps.
- Activating affiliate attribution.
- Adding basic monitoring.

### Paid Pro beta

Allow **ten to fourteen total weeks**.

This estimate includes the free launch work.

It also includes:

- Adding authentication.
- Adding billing.
- Adding server entitlements.
- Adding encrypted cloud backup.
- Adding synchronization.
- Adding usage enforcement.
- Adding multiple profiles.
- Adding fit history.
- Adding advanced QC storage.
- Adding account export and deletion.

### Comprehensive public launch

Allow **fourteen to eighteen total weeks**.

This estimate includes:

- Running a private beta.
- Fixing beta defects.
- Completing accessibility checks.
- Completing PWA hardening.
- Completing performance work.
- Completing support procedures.
- Completing billing recovery flows.
- Completing production monitoring.
- Completing legal review.

Two experienced engineers can reduce this schedule to about nine to twelve weeks.

The schedule does not include the Chrome extension.

## Recommended implementation sequence

1. Freeze one reviewed release baseline.
2. Commit every required lazy-loaded sheet.
3. Prevent item loss during storage loading.
4. Preserve Reddit poster information.
5. Remove the false Log in action.
6. Remove consumer referral-code editing.
7. Replace the browser credential system.
8. Fix Chart Vision SSRF.
9. Add request and cost controls.
10. Add privacy, terms, support, and deletion.
11. Fix the primary accessibility defects.
12. Create first-class haul records.
13. Complete the remaining Tier A behavior.
14. Replace the sample shelf with a real fashion haul.
15. Add affiliate attribution and disclosure.
16. Launch a limited free beta.
17. Measure activation and outbound clicks.
18. Add authentication, billing, and entitlements.
19. Add encrypted synchronization and Pro functions.
20. Run a paid beta.
21. Fix the remaining PWA and performance defects.
22. Launch the public Pro plan.
23. Review pricing after twenty customers.

## Launch metrics

Measure these activation events:

- Measure the first captured item.
- Measure the first imported haul.
- Measure the first named haul.
- Measure the first size decision.
- Measure the first QC decision.
- Measure the first outbound Buy click.

Measure these revenue events:

- Measure outbound clicks per active user.
- Measure affiliate clicks by agent.
- Measure Pro trial starts.
- Measure trial conversion.
- Measure monthly churn.
- Measure annual-plan selection.
- Measure AI cost per paid account.
- Measure cloud-storage cost per paid account.

Measure these quality events:

- Measure failed enrichment requests.
- Measure storage recovery events.
- Measure synchronization conflicts.
- Measure billing webhook failures.
- Measure support requests.
- Measure account deletion completion.

## Final recommendation

Launch the free affiliate product first.

Do not wait for every Pro function.

However, fix all security, data, trust, and legal blockers first.

Then observe how real users plan and complete hauls.

Build Pro around the repeated problems that appear after activation.

The strongest initial Pro value is encrypted continuity across devices.

The second strongest value is fit and QC history.

The third strongest value is advanced parcel planning.

This model supports affiliate revenue without weakening the free product.

## Market sources

- [Superbuy fee composition](https://www.superbuy.com/en/page/guide/feecomposition/)
- [Superbuy affiliate program](https://www.superbuy.com/en/page/about/affiliate/)
- [Sugargoo consolidation guide](https://blog.sugargoo.com/how-does-package-consolidation-work-at-sugargoo/)
- [Sugargoo affiliate guide](https://blog.sugargoo.com/sugargoo-affiliate-program-guide-for-influencers/)
- [AllChinaBuy transport guide](https://www.allchinabuy.com/en/page/guide/transportagent/)
- [AllChinaBuy affiliate program](https://www.allchinabuy.com/en/page/about/affiliate/)
- [Stylebook FAQ](https://stylebookapp.com/faq.html)
- [Whering pricing FAQ](https://whering.co.uk/faq/is-whering-free)
- [Indyx product overview](https://www.myindyx.com/home)
- [Wishes pricing](https://wishes.app/pricing)
- [CartPause](https://cartpause.com/)
- [Raindrop Pro](https://raindrop.io/pro/buy)
- [Notion pricing](https://www.notion.com/pricing)
- [Airtable plans](https://support.airtable.com/docs/en/airtable-plans)
- [MyUS membership](https://www.myus.com/faq/myus-membership/)
- [Shipito pricing](https://www.shipito.com/en/shipito-pricing)
- [Stackry pricing](https://www.stackry.com/pricing)
- [Chrome affiliate policy](https://developer.chrome.com/docs/webstore/program-policies/affiliate-ads/)
- [FTC endorsement guidance](https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking)

## Review activity

The review did not modify application source files.

The report file is the only file created by this review step.
