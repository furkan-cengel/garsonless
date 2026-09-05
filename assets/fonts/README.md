# Self-hosted interface fonts

These font binaries are sourced from the official Google Fonts repository and are bundled so Masabu builds and renders without runtime requests to Google Fonts.

Included families: DM Sans, Fraunces, Fredoka, Geist, Geist Mono, Inter, Manrope, Nunito, Pacifico, and Playfair Display.

They are distributed under the SIL Open Font License 1.1. See `OFL.txt` in this directory.

The `.woff2` files are losslessly compressed derivatives of the corresponding
TTF sources. Menu theme families retain their original Unicode character maps.
The marketing-only `*-Latin.woff2` files include Latin/Latin Extended, Vietnamese,
Turkish, general punctuation and currency symbols; other scripts use the CSS
fallback fonts. Generate them with FontTools and Brotli; retain this license.
Fraunces Latin retains variable weight and optical sizing; unused soft/wonky
axes are fixed at their original defaults to reduce transfer size.

`Fraunces-Latin-TR.woff2` is the primary marketing subset: Basic Latin, Latin-1,
Turkish, punctuation, currency and arrows. It retains the original weight and
optical-size axes and OpenType layout features. The full `Fraunces-Latin.woff2`
remains in the CSS fallback chain for other Latin characters, without preload.
Its Unicode range excludes the primary subset so both files are not downloaded
for ordinary Turkish text. The primary face disables Next's automatic system
fallback so other Latin characters can reach the original font family.
Regenerate with `python3 scripts/generate-marketing-font-subset.py` (FontTools
4.60.2 and Brotli).
