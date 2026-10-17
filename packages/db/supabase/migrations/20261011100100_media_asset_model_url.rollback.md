# Media asset model url recovery

Only `media_asset_json` changes: its `url` falls back to the asset's public `model` object after `image` and `video`. Recovery is re-running the original definition from `20260921120000_media_library.sql` (`create or replace`, same signature, grants kept). Without it, 3D models show an empty url in Dosyalar but stay usable through the menu item AR RPCs, which read the `model` object directly.
