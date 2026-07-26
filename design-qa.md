# Daily Special Media Visual QA

- Source visual truth: conversation screenshot, 2026-07-25
- Source pixels: unavailable from the embedded conversation image
- Implementation screenshot: not captured — in-app Browser reported no available browser backend
- Viewport / CSS size / density: unavailable
- State: split-layout Daily Special with product image, description, countdown, price card and membership note
- Full-view comparison evidence: blocked because the rendered implementation could not be captured
- Focused-region comparison evidence: blocked for the same reason
- Primary interactions tested: server-rendered component tests only; browser interactions not tested
- Console errors checked: not browser-tested

## Findings

- [P1 fixed in code] The source screenshot showed the product image stretching to the full height of the adjacent content column, producing an unnaturally narrow portrait crop.
- The implementation now gives split-layout media its own square frame, controlled by the existing image-size setting and aligned to the top of the section.
- The text, countdown, price and membership-note column can now grow without changing the image height.

## Comparison history

1. Initial source finding: the split media inherited the content row height through `align-self: stretch`, `height: 100%` and `min-height: 100%` behavior.
2. Fix: independent square media frame with explicit height, `aspect-ratio: 1 / 1`, and `align-self: start`.
3. Automated evidence: Daily Special component tests pass 5/5, including a regression case with a long content column; UI and dashboard typechecks pass.
4. Post-fix visual evidence: unavailable because the in-app Browser backend is not currently available.

## Residual test gap

- Refresh the signed-in theme preview and visually confirm the Daily Special image stays square while the countdown, description, chef note and price card are all visible.
- Confirm both `cover` and `contain` image-fit options produce an intentional crop at the smallest and largest image-size settings.

final result: blocked

# Header and Customer Actions Redesign Visual QA

- Source visual truth: `/private/tmp/header-audit/03-header-overflow.png` (the 390×820 pre-change reproduction of the supplied problem screenshot)
- Implementation screenshot: `/private/tmp/header-audit/11-header-final-390.png`
- Combined comparison evidence: `/private/tmp/header-audit/14-before-after-comparison.png`
- Responsive evidence: `/private/tmp/header-audit/12-compact-actions-320.png`
- Context-bar and below-header Drawer evidence: `/private/tmp/header-audit/13-context-final.png`
- Shared service-sheet evidence: `/private/tmp/header-audit/10-header-service-sheet.png`
- Viewport: source and primary implementation 390×820 CSS px; compact case 320×820 CSS px
- Pixel dimensions and normalization: both primary captures are 390×820 at deviceScaleFactor 1; no resizing or density conversion was used before the side-by-side comparison
- State: source has the legacy `… > Üye ol` popover open; implementation intentionally removes that control and keeps membership on its selected Drawer surface
- Console errors checked: 0 in the final header, drawer, and service-sheet Playwright runs

## Findings

- No actionable P0/P1/P2 issue remains. The legacy popover no longer covers the category navigation, the centered brand stays stable, and the header has no horizontal overflow.
- Fonts and typography: the existing tenant DM Sans/Fraunces pairing, weights, hierarchy, wrapping, and product typography are unchanged; the redesign limits itself to header/action composition.
- Spacing and layout rhythm: 44×44 primary targets align on one row, the compact row is capped at 56 px, and the 34 px table bar remains visually separate from category navigation. The Drawer starts at the measured combined header/context boundary.
- Colors and visual tokens: controls continue to use tenant accent, soft-accent, card, border, text, and muted-text tokens. No new off-brand surface was introduced.
- Image quality and asset fidelity: the real restaurant logo and product imagery remain at their original crop and density. New service/header glyphs use the existing application icon system.
- Copy and content: the persistent `Üye ol +200 puan` overflow copy is removed; membership appears once as `Üye ol` on the configured surface. The table bar uses `Masa BAF7` and `Hesap · ₺150,00` only when real table/bill data exists.

## Comparison history

1. Source finding [P1]: the `…` trigger exposed a single membership row and its popover covered category navigation at 390 px. Fix: remove overflow entirely and route membership through canonical placement.
2. First responsive pass [P2]: the cart pill hid its label below 420 px but retained a 72 px minimum width. Fix: collapse the pill to a true 44×44 icon/badge control. Post-fix evidence: `/private/tmp/header-audit/12-compact-actions-320.png` and measured 44×44 member/cart targets with zero horizontal overflow.
3. First context/Drawer pass [P2]: when bill placement was Header, the disabled Drawer table card still displayed the total and looked like a second bill control. Fix: render a static table-status card without bill total/action outside the Drawer placement. Post-fix evidence: `/private/tmp/header-audit/13-context-final.png`.
4. Post-fix interaction evidence: service sheet opens from Header and Drawer, focuses its first action, traps focus, closes on Escape, restores focus to the trigger, and leaves zero console errors.

## Focused comparison evidence

- The full comparison is rendered at 1:1 density, so the header, first category row, typography, logo, radii, and action geometry are directly readable without a separate crop.
- The 320 px compact and table-context captures provide focused evidence for the two details not represented in the primary source state: two header actions and the combined Header + status-bar boundary.

## Follow-up Polish

- P3: a future tenant with an unusually wide horizontal logo may benefit from a dedicated maximum-logo-width editor control; current long-name and no-logo fallbacks already truncate safely.

final result: passed

# Navigation Drawer Redesign Visual QA

- Source visual truth: `/Users/furkancengelm3/Desktop/nav-drawer.html`
- Source target: 480×820 mobile navigation drawer reference
- Implementation: `packages/ui/src/menu/NavDrawer.tsx`
- State: drawer open, category hierarchy visible, optional table and information sections present
- Reference screenshot: `/private/tmp/nav-drawer-reference-open.png`
- Implementation screenshot: `/private/tmp/nav-drawer-live.png`
- Browser evidence: Playwright Chromium, 480×820, `/maf-lounge?preview=1`, 2026-07-26
- Primary interactions covered in code: open/close, scrim and Escape dismissal, category search, category and subcategory navigation, visual-category routing, bill opening, hours expansion, Wi-Fi expansion and copy actions
- Console errors checked: 0

## Findings

- The production drawer follows the reference hierarchy and responsive proportions while using tenant theme tokens. At 480×820 the measured live frame is 370×820, opens from x=0, and keeps the customer actions fixed at the bottom.
- Wi-Fi and working-hours blocks are projected into the drawer only when their section instances exist in the published page flow.
- Reference and live captures were compared at the same viewport. Brand header, search, root/child hierarchy, count badges, active row and fixed actions are all represented; the live version intentionally uses the restaurant's green theme instead of copying the reference gray surface.
- Escape closes the drawer, `aria-hidden` changes from false on open, and the dialog is removed from the tab order when closed. Focus cycling is trapped inside the open dialog.

## Residual test gap

- The current MAF draft does not contain drawer-placed Wi-Fi/hours instances, so their expanded pixels were verified from component implementation and schema tests rather than this tenant capture.
- Signed-in editor click-through was not automated in this run; the preview message bridge and selection behavior are covered by type/architecture checks.

final result: passed

# Promo Slider Campaign Card Visual QA

- Source visual truth: conversation screenshot, 2026-07-25
- Target state: active Combo Ribbon, Daily Special and Discount Badge campaigns rendered inside the same compact slider frame
- Implementation screenshot: not captured — in-app Browser reported no available browser backend
- Automated render evidence: static markup verifies the full long combo title, a two-line clamp, countdown state and configured countdown label

## Findings

- [P1 fixed in code] Long combo titles previously used an oversized single-line presentation and were clipped by the fixed card width.
- [P1 fixed in code] Daily Special and Discount Badge deadlines were present in source campaign state but had no visible countdown in the slider card.
- [P2 fixed in code] Price and title colors could lose contrast on campaign-colored surfaces.
- [P2 fixed in code] Changing countdown digits could alter inline width and make the compact card feel unstable.

## Implemented response

1. Campaign cards now use a 170px shared frame, responsive media width and a compact content column.
2. Titles wrap to at most two lines with `overflow-wrap`, so long combo names remain readable without escaping the card.
3. Countdown-enabled Daily Special and Discount Badge slides show a stable `HH:MM:SS` row and preserve the source campaign's custom countdown label.
4. Countdown digits use tabular numerals and a fixed-width value slot, preventing second-by-second layout movement.
5. Expired campaigns still retire from the slider without a page refresh.

## Verification

- Component/model tests: 6 passed, 0 failed.
- `@garsonless/ui` lint: passed.
- `@garsonless/ui` typecheck: passed.
- `@garsonless/menu` typecheck and production build: passed.
- Visual browser comparison remains blocked until an in-app Browser backend is available.

final result: blocked

# Current Build Gate — Header Redesign

The current handoff is the Header and Customer Actions redesign documented above. Its 390×820 source/implementation comparison, 320 px compact capture, table-context Drawer capture, service-sheet interaction evidence, and comparison history are complete with no remaining P0/P1/P2 finding.

final result: passed

# Section Catalogue and Information Preview Visual QA

- Source visual truth: user-supplied conversation screenshot, 2026-07-26, showing the `Bölüm ekle` catalogue with empty Çalışma Saatleri/Wi‑Fi placeholders and the retired Alerjen/Yorumlar cards
- Source pixels: 1919×1342; the embedded source has no filesystem path or reliable CSS-density metadata, so it is used as a composition and product-state reference rather than for pixel-distance scoring
- Implementation screenshot: `/Users/furkancengelm3/dev/gersonless/apps/dashboard/test-results/product-design/info-sections-preview.png`
- Drawer interaction screenshot: `/Users/furkancengelm3/dev/gersonless/apps/dashboard/test-results/product-design/drawer-focus-after-theme-update.png`
- Implementation pixels: focused information-preview board 920×379; live drawer capture 390×2246; both captured at deviceScaleFactor 1
- Browser viewport: preview board 980×640; live menu drawer 390×844
- State: settings-backed opening hours and catalogue-safe guest-network data; live drawer open with its search input focused while a full theme update rerenders Header
- Console errors checked: 0 in the final Playwright run

## Findings

- No actionable P0/P1/P2 issue remains. İstek Butonları now precedes Çalışma Saatleri in catalogue order; Alerjen Bilgileri and Yorumlar are absent; the remaining catalogue contains 14 ready sections and no stale `geliştiriliyor` footer count.
- Fonts and typography: the new cards use the existing body-font token, compact 14 px headings, 10–11.5 px metadata and strong tabular-looking hour values. Hierarchy remains readable at catalogue scale without introducing a new type family.
- Spacing and layout rhythm: both previews use the product's card radius, border, shadow, 38 px icon tile and 37 px information rows. The focused capture shows aligned outer cards and consistent header/body rhythm; Wi‑Fi is intentionally shorter because it has two data rows instead of three schedule rows.
- Colors and visual tokens: surfaces, borders, accent, soft-accent, primary text and secondary text all come from the live theme variables. Open/today and guest-network states use the same green semantic treatment as the existing drawer.
- Image quality and asset fidelity: these information sections require no raster media. Clock, globe and copy glyphs come from the existing Lucide-backed application icon library; no placeholder art, emoji, handcrafted SVG or CSS illustration was introduced.
- Copy and content: the schedule identifies `Bugün` and reads each interval from `restaurants.settings.hours`; when no schedule has been saved it shows an honest empty state instead of fabricated hours. Wi‑Fi shows a representative guest SSID and masks the password.

## Comparison History

1. Initial source finding [P1]: Çalışma Saatleri and Wi‑Fi used generic empty dashed placeholders, so selection did not explain the resulting section. Fix: add canonical token-driven schedule and network cards; hours use the saved business schedule while Wi‑Fi retains a catalogue-only safe example. Post-fix evidence: `info-sections-preview.png`, plus four server-rendered component tests.
2. Initial interaction finding [P1]: every Wi‑Fi keystroke rerendered the preview Header, changed the inline Drawer close callback and reran the focus effect, moving focus into the iframe. Fix: keep the latest close callback in a ref and make the focus/trap effect depend only on the open transition.
3. Post-fix interaction evidence: Playwright focused the live drawer search, entered `K`, dispatched the same `FULL_THEME_UPDATE` used by the editor, retained focus, completed `Kahve`, and closed the Drawer with Escape. This exercises the same iframe rerender path that previously broke Wi‑Fi typing.

## Focused Comparison Evidence

- The conversation source and focused implementation capture were reviewed together for card hierarchy, catalogue density, typography, radius, token color and explanatory content. Exact pixel scoring was intentionally avoided because the source includes the whole 1919×1342 dialog while the implementation evidence isolates the two changed preview regions.
- A separate full-height live drawer capture records the interactive focus state; it is not used for picker geometry comparison.

## Follow-up Polish

- P3: unusually long custom Wi‑Fi notes are single-line truncated in the compact catalogue card; the full editor retains the complete text and the live drawer displays it in the expanded information panel.

final result: passed

# Current Build Gate — Section Catalogue and Information Previews

The current handoff is the Section Catalogue and Information Preview update documented above. Catalogue order/removal, settings-backed hours, meaningful preview content, live rerender focus retention, Escape dismissal, component tests, architecture tests, lint, typecheck and the menu production build all pass.

final result: passed
