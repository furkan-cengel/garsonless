# 3D and AR for menu items (pilot)

Guests can open a published 3D model from the product modal ("3D incele") and, on supported
phones, place it on their table ("Masamda gör"). Owners manage models in the product editor
("3D ve AR" section). The owner-facing guide is the Claude Doc "Masabu 3D ve AR rehberi".

## Pieces

| Layer | Where |
|---|---|
| File checks (GLB/USDZ structure, 10 MB) | `packages/domain/src/ar-model.ts` |
| Upload into Dosyalar (model role, AR-access gate) | `apps/dashboard/lib/media-library-server.ts` |
| Versions, publish pointer, access switch, RPCs | `20261011100000_menu_item_ar.sql` (+ `…100100`, `…100200`) |
| Commands and ports | `packages/application/src/menu-ar.ts`, `packages/db/src/menu-ar-port.ts` |
| Product editor section | `apps/dashboard/components/menu/MenuItemArSection.tsx` |
| Public read and viewer | `apps/menu/lib/queries.ts` (`getMenuItems`), `apps/menu/app/[slug]/MenuArViewer.tsx` |

## Decisions

- **Access is per restaurant.** `restaurant_ar_access.enabled` is set by the Masabu team (no UI
  yet). Without it, model uploads are refused (`ar_disabled`), the editor section is hidden and
  `read_published_menu_ar` returns nothing, so the menu falls back to photos. Switching it off
  is the fastest stop.
- **Drafts are public by unguessable URL.** A model's public object is written at upload under
  `restaurants/<id>/library/<asset uuid>/model.<ext>`, like every library image. Publishing only
  moves the `menu_item_ar.published_version_id` pointer; nothing is copied. A draft's URL is
  therefore reachable by anyone who has it, but it is never listed on the menu.
- **Every save is a new version.** The editor saves a draft version; publishing needs an
  explicit "checked the look and size" confirmation. Old unreferenced versions are pruned.
- **Cache.** `menu_item_ar` and `restaurant_ar_access` bump `menu_invalidations`, so the menu's
  revision-keyed cache picks up publishes. The AR read has its own cache entry; a failed read is
  not cached and the menu shows photos.
- **Device rules.** iOS uses Quick Look (USDZ if given, otherwise model-viewer converts the
  GLB). Android is offered AR only when WebXR `immersive-ar` is supported; phones without ARCore
  would otherwise land on a Play Store "not compatible" page. Desktop shows 3D only.
- **Selections survive AR.** The viewer opens over the still-mounted product modal.
- **Bundles.** model-viewer (three.js) loads only when a model is opened, in both apps.

## Known gaps

- No admin UI for `restaurant_ar_access`; no usage metric for AR starts yet (the menu has no
  analytics pipeline).
- Android WebXR has not been tested on an ARCore phone. The menu sends
  `Permissions-Policy: camera=()`; WebXR AR is gated by `xr-spatial-tracking`, which is not
  restricted, but confirm on a real device before the pilot.
- If a mobile browser discards the tab while the native AR viewer is open, the modal's
  selections are lost.

## Pilot checklist

1. Apply the three migrations to PROD before merging (see CLAUDE.md pending list).
2. Insert `restaurant_ar_access (restaurant_id, enabled, note)` for the pilot restaurant.
3. Upload GLB (+ USDZ) for one product, enter the real size, preview, publish.
4. Check on an iPhone and an ARCore Android phone; then widen.
