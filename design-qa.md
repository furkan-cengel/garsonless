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
