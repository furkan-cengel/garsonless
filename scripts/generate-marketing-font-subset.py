"""Generate the primary marketing face, preserving weight and optical sizing.

Requires FontTools 4.60.2 and Brotli. The original Latin face remains a CSS
fallback for characters outside this subset. Run from any working directory.
"""
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

fonts = Path(__file__).resolve().parents[1] / "assets" / "fonts"
font = TTFont(fonts / "Fraunces-Latin.woff2")
subsetter = subset.Subsetter()
subsetter.populate(unicodes=(
    list(range(0x0000, 0x0100))
    + [0x011E, 0x011F, 0x0130, 0x0131, 0x015E, 0x015F]
    + list(range(0x2000, 0x2070))
    + list(range(0x20A0, 0x20D0))
    + list(range(0x2190, 0x2200))
))
subsetter.subset(font)
font.save(fonts / "Fraunces-Latin-TR.woff2")
