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
