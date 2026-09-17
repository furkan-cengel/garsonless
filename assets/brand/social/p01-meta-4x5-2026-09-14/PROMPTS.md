# Meta tuval düzeltmesi — üretim kaydı

Araç: Yerleşik image_gen. CLI kullanılmadı. Aşağıdaki ortak prompt her kart için ayrı çağrıldı; o kartın önceki PNG dosyası düzenleme hedefi olarak verildi. Kaynak klasör: `../p01-launch-2026-09-14/`.

```text
Use case: compositing / canvas format conversion.
Convert this exact finished social carousel card to an output canvas with WIDTH:HEIGHT = 4:5 (portrait). Output a 1088 pixel wide by 1360 pixel high image if possible; the critical constraint is aspect ratio 0.8 or very slightly WIDER, NEVER narrower than 4:5. The existing source is too tall for Meta Business Suite.
Preserve the ENTIRE original picture and typography: do not crop any edges, don't rewrite, rearrange, or resize individual text blocks, don't redesign logo or drawings. Scale the complete original picture uniformly so its entire height fits inside the new 4:5 canvas. Center it horizontally. Extend ONLY the warm ivory background at the left and right, about 3 percent extra width on each side, seamlessly matching the adjacent texture. Keep all text, page numbering, tiny footer, @masabuco or masabu.co identical to the original. No new text, no new illustration, no borders, no shadow, no watermark. Return the flat final image itself, not a mockup. DO NOT preserve the source's narrow aspect ratio: return the wider 4:5 portrait canvas.
```
