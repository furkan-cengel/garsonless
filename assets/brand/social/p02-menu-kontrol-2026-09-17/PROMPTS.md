# Masabu P02 — Üretim promptları

## Devam kartlarına eklenen süreklilik talimatı

Kart 02–06 için ilk referans, bu yeni setin 01-kapak.png dosyasıdır (1122×1402). İkinci referans özgün masabu-logo-transparent-1024px.png dosyasıdır.

```text
Continuity: Input image 1 is now the finished cover of THIS six-card series. Match its actual 1122×1402 canvas, exact header logo scale, margins, typography and footer alignment. Preserve the same design system, but replace content and the lower illustration as specified. Do not reuse the cover headline.
```

Kart 04–06 çağrılarına ayrıca şu not eklendi:

```text
Keep question particles separate: 'mu?' and 'mi?' must be spaced away from previous word.
```


Yerleşik image_gen aracı; CLI kullanılmadı. Her kart ayrı üretilir. Önceki P01 kapak tasarımı ve özgün marka logosu referans olarak kullanılır. Çizimler kavramsaldır, gerçek ürün ekranı veya müşteri fotoğrafı değildir. İstenen ölçü ile gerçek çıktı ölçüsü farklı olabilir; gerçek ölçüler verification.json ile doğrulanır.

## 01-kapak.png

```text
Use case: ads-marketing.
Task: create the next Masabu Turkish educational carousel by adapting the supplied existing Masabu poster. Input image 1 is a brand/style reference; preserve its exact distinctive masabu wordmark (textured black masa, green bu.), warm ivory paper, deep green hand-drawn fine contour illustrations and rich black editorial serif headline. Replace the previous poster's headline, copy, numbering and scene entirely with the new card specified below.
Output ONE flat finished poster. Canvas 1088 pixels wide × 1360 pixels high, portrait WIDTH:HEIGHT 4:5. The actual exported canvas MUST have ratio 0.8 or a hair WIDER, never narrower; do not output a tall 3:4 or 2:3 image. All cards in series must have the SAME canvas dimensions. No outer mockup, frame, multiple cards, collage, crop marks or borders.
Art direction: refined tactile café editorial, calm generous negative space, cream #F8F6EF, ink #101610, pine green #175944, gentle sage shadows. Strong, highly readable Turkish typography. Not a corporate infographic template. No fake screenshot: any phone/menu drawing is visibly conceptual with abstract strokes and no invented UI, buttons or tiny text.
Grid: 8% safe margins on every edge. Small original wordmark upper left (about 26% canvas width); small dark-green page counter upper right. Upper-middle contains short uppercase category label, then very large black high-contrast serif headline and 2–3 short lines of plain sans-serif supporting text. Illustration occupies lower 40%, airy composition, never overlaps copy. Footer handle bottom left and action bottom right, both readable, green. Use EXACT provided Turkish copy with correct ı, İ, ş, ğ, ü, ö, ç, no additions or missing words. Only text listed in the card may appear. Match type hierarchy and location across the series.

Input image 2 is the original transparent brand wordmark. Use it faithfully for the small header logo, do not invent a new logo or distort its lettering.

CARD SPECIFICATION:
Page counter: "01 / 06"
Category label: "KAFE VE RESTORANLAR İÇİN"
Headline (line breaks suggested): "Menüne bir de
müşterinin
gözünden bak."
Supporting text: "Telefonunda kontrol edebileceğin
5 küçük detay."
Bottom left: "@masabuco"
Bottom right: "5 kontrol için kaydır →"
Illustration: An elegant top-down illustrated café table with one cream smartphone placed at a slight diagonal, a short paper checklist bearing five empty green squares but no text, one small espresso cup, restrained green looping line. Minimal botanical detail near right edge. This is an invitation to inspect one's menu, not a software screenshot.
```

## 02-okunabilirlik.png

```text
Use case: ads-marketing.
Task: create the next Masabu Turkish educational carousel by adapting the supplied existing Masabu poster. Input image 1 is a brand/style reference; preserve its exact distinctive masabu wordmark (textured black masa, green bu.), warm ivory paper, deep green hand-drawn fine contour illustrations and rich black editorial serif headline. Replace the previous poster's headline, copy, numbering and scene entirely with the new card specified below.
Output ONE flat finished poster. Canvas 1088 pixels wide × 1360 pixels high, portrait WIDTH:HEIGHT 4:5. The actual exported canvas MUST have ratio 0.8 or a hair WIDER, never narrower; do not output a tall 3:4 or 2:3 image. All cards in series must have the SAME canvas dimensions. No outer mockup, frame, multiple cards, collage, crop marks or borders.
Art direction: refined tactile café editorial, calm generous negative space, cream #F8F6EF, ink #101610, pine green #175944, gentle sage shadows. Strong, highly readable Turkish typography. Not a corporate infographic template. No fake screenshot: any phone/menu drawing is visibly conceptual with abstract strokes and no invented UI, buttons or tiny text.
Grid: 8% safe margins on every edge. Small original wordmark upper left (about 26% canvas width); small dark-green page counter upper right. Upper-middle contains short uppercase category label, then very large black high-contrast serif headline and 2–3 short lines of plain sans-serif supporting text. Illustration occupies lower 40%, airy composition, never overlaps copy. Footer handle bottom left and action bottom right, both readable, green. Use EXACT provided Turkish copy with correct ı, İ, ş, ğ, ü, ö, ç, no additions or missing words. Only text listed in the card may appear. Match type hierarchy and location across the series.

Input image 2 is the original transparent brand wordmark. Use it faithfully for the small header logo, do not invent a new logo or distort its lettering.

CARD SPECIFICATION:
Page counter: "02 / 06"
Category label: "01 · OKUNABİLİRLİK"
Headline (line breaks suggested): "Yazılar rahat
okunuyor mu?"
Supporting text: "Menünü telefonda aç.
Yakınlaştırmadan okumayı dene."
Bottom left: "@masabuco"
Bottom right: "Sırada: kategoriler →"
Illustration: A close-up editorial illustration of one simple green-outlined smartphone lying on ivory café table. Conceptual menu represented by large crisp green horizontal strokes, plus a small round magnifying glass lying BESIDE the phone to symbolize readability. No human hands, no interface text, no real screenshot. Small edge of a coffee saucer and ample cream space.
```

## 03-kategoriler.png

```text
Use case: ads-marketing.
Task: create the next Masabu Turkish educational carousel by adapting the supplied existing Masabu poster. Input image 1 is a brand/style reference; preserve its exact distinctive masabu wordmark (textured black masa, green bu.), warm ivory paper, deep green hand-drawn fine contour illustrations and rich black editorial serif headline. Replace the previous poster's headline, copy, numbering and scene entirely with the new card specified below.
Output ONE flat finished poster. Canvas 1088 pixels wide × 1360 pixels high, portrait WIDTH:HEIGHT 4:5. The actual exported canvas MUST have ratio 0.8 or a hair WIDER, never narrower; do not output a tall 3:4 or 2:3 image. All cards in series must have the SAME canvas dimensions. No outer mockup, frame, multiple cards, collage, crop marks or borders.
Art direction: refined tactile café editorial, calm generous negative space, cream #F8F6EF, ink #101610, pine green #175944, gentle sage shadows. Strong, highly readable Turkish typography. Not a corporate infographic template. No fake screenshot: any phone/menu drawing is visibly conceptual with abstract strokes and no invented UI, buttons or tiny text.
Grid: 8% safe margins on every edge. Small original wordmark upper left (about 26% canvas width); small dark-green page counter upper right. Upper-middle contains short uppercase category label, then very large black high-contrast serif headline and 2–3 short lines of plain sans-serif supporting text. Illustration occupies lower 40%, airy composition, never overlaps copy. Footer handle bottom left and action bottom right, both readable, green. Use EXACT provided Turkish copy with correct ı, İ, ş, ğ, ü, ö, ç, no additions or missing words. Only text listed in the card may appear. Match type hierarchy and location across the series.

Input image 2 is the original transparent brand wordmark. Use it faithfully for the small header logo, do not invent a new logo or distort its lettering.

CARD SPECIFICATION:
Page counter: "03 / 06"
Category label: "02 · KATEGORİLER"
Headline (line breaks suggested): "Aranan ürün kolay
bulunuyor mu?"
Supporting text: "Kahve, ana yemek, tatlı...
Kategoriler ilk bakışta anlaşılır olsun."
Bottom left: "@masabuco"
Bottom right: "Sırada: açıklamalar →"
Illustration: A refined café menu notebook with three separated bookmark tabs, alongside a cup silhouette, a plate silhouette, and an elegant small cake slice illustration, representing three categories. Drawings tactile and understated with green contour and sage shadows, not infographic flowchart. No printed labels or text on props.
```

## 04-aciklamalar.png

```text
Use case: ads-marketing.
Task: create the next Masabu Turkish educational carousel by adapting the supplied existing Masabu poster. Input image 1 is a brand/style reference; preserve its exact distinctive masabu wordmark (textured black masa, green bu.), warm ivory paper, deep green hand-drawn fine contour illustrations and rich black editorial serif headline. Replace the previous poster's headline, copy, numbering and scene entirely with the new card specified below.
Output ONE flat finished poster. Canvas 1088 pixels wide × 1360 pixels high, portrait WIDTH:HEIGHT 4:5. The actual exported canvas MUST have ratio 0.8 or a hair WIDER, never narrower; do not output a tall 3:4 or 2:3 image. All cards in series must have the SAME canvas dimensions. No outer mockup, frame, multiple cards, collage, crop marks or borders.
Art direction: refined tactile café editorial, calm generous negative space, cream #F8F6EF, ink #101610, pine green #175944, gentle sage shadows. Strong, highly readable Turkish typography. Not a corporate infographic template. No fake screenshot: any phone/menu drawing is visibly conceptual with abstract strokes and no invented UI, buttons or tiny text.
Grid: 8% safe margins on every edge. Small original wordmark upper left (about 26% canvas width); small dark-green page counter upper right. Upper-middle contains short uppercase category label, then very large black high-contrast serif headline and 2–3 short lines of plain sans-serif supporting text. Illustration occupies lower 40%, airy composition, never overlaps copy. Footer handle bottom left and action bottom right, both readable, green. Use EXACT provided Turkish copy with correct ı, İ, ş, ğ, ü, ö, ç, no additions or missing words. Only text listed in the card may appear. Match type hierarchy and location across the series.

Input image 2 is the original transparent brand wordmark. Use it faithfully for the small header logo, do not invent a new logo or distort its lettering.

CARD SPECIFICATION:
Page counter: "04 / 06"
Category label: "03 · ÜRÜN AÇIKLAMASI"
Headline (line breaks suggested): "Ürünün içeriği
anlaşılıyor mu?"
Supporting text: "İsmin yanına kısa bir açıklama ekle.
Misafirin ne seçeceğini bilsin."
Bottom left: "@masabuco"
Bottom right: "Sırada: fiyatlar →"
Illustration: An editorial café still life: a ceramic plate holding a simple toasted sandwich with tomato and leafy greens, beside a small cream menu card with one abstract title stroke and two abstract description strokes. Clean coherent illustration, no actual words on card, no arrows or pseudo UI. A loose parsley leaf naturally echoes the prior poster botanical.
```

## 05-fiyatlar.png

```text
Use case: ads-marketing.
Task: create the next Masabu Turkish educational carousel by adapting the supplied existing Masabu poster. Input image 1 is a brand/style reference; preserve its exact distinctive masabu wordmark (textured black masa, green bu.), warm ivory paper, deep green hand-drawn fine contour illustrations and rich black editorial serif headline. Replace the previous poster's headline, copy, numbering and scene entirely with the new card specified below.
Output ONE flat finished poster. Canvas 1088 pixels wide × 1360 pixels high, portrait WIDTH:HEIGHT 4:5. The actual exported canvas MUST have ratio 0.8 or a hair WIDER, never narrower; do not output a tall 3:4 or 2:3 image. All cards in series must have the SAME canvas dimensions. No outer mockup, frame, multiple cards, collage, crop marks or borders.
Art direction: refined tactile café editorial, calm generous negative space, cream #F8F6EF, ink #101610, pine green #175944, gentle sage shadows. Strong, highly readable Turkish typography. Not a corporate infographic template. No fake screenshot: any phone/menu drawing is visibly conceptual with abstract strokes and no invented UI, buttons or tiny text.
Grid: 8% safe margins on every edge. Small original wordmark upper left (about 26% canvas width); small dark-green page counter upper right. Upper-middle contains short uppercase category label, then very large black high-contrast serif headline and 2–3 short lines of plain sans-serif supporting text. Illustration occupies lower 40%, airy composition, never overlaps copy. Footer handle bottom left and action bottom right, both readable, green. Use EXACT provided Turkish copy with correct ı, İ, ş, ğ, ü, ö, ç, no additions or missing words. Only text listed in the card may appear. Match type hierarchy and location across the series.

Input image 2 is the original transparent brand wordmark. Use it faithfully for the small header logo, do not invent a new logo or distort its lettering.

CARD SPECIFICATION:
Page counter: "05 / 06"
Category label: "04 · GÜNCEL FİYATLAR"
Headline (line breaks suggested): "Fiyatlar
güncel mi?"
Supporting text: "Son değişiklikten sonra
müşterinin gördüğü menüyü kontrol et."
Bottom left: "@masabuco"
Bottom right: "Sırada: fotoğraflar →"
Illustration: One open cream paper menu notebook, a dark-green pencil and a smartphone side-by-side, with a single conceptual price tag icon bearing only the Turkish lira symbol ₺ as graphic. No actual prices, dates, screenshots, fake dashboard or extra text. Elegant café perspective and subtle tabletop shadow.
```

## 06-fotograflar.png

```text
Use case: ads-marketing.
Task: create the next Masabu Turkish educational carousel by adapting the supplied existing Masabu poster. Input image 1 is a brand/style reference; preserve its exact distinctive masabu wordmark (textured black masa, green bu.), warm ivory paper, deep green hand-drawn fine contour illustrations and rich black editorial serif headline. Replace the previous poster's headline, copy, numbering and scene entirely with the new card specified below.
Output ONE flat finished poster. Canvas 1088 pixels wide × 1360 pixels high, portrait WIDTH:HEIGHT 4:5. The actual exported canvas MUST have ratio 0.8 or a hair WIDER, never narrower; do not output a tall 3:4 or 2:3 image. All cards in series must have the SAME canvas dimensions. No outer mockup, frame, multiple cards, collage, crop marks or borders.
Art direction: refined tactile café editorial, calm generous negative space, cream #F8F6EF, ink #101610, pine green #175944, gentle sage shadows. Strong, highly readable Turkish typography. Not a corporate infographic template. No fake screenshot: any phone/menu drawing is visibly conceptual with abstract strokes and no invented UI, buttons or tiny text.
Grid: 8% safe margins on every edge. Small original wordmark upper left (about 26% canvas width); small dark-green page counter upper right. Upper-middle contains short uppercase category label, then very large black high-contrast serif headline and 2–3 short lines of plain sans-serif supporting text. Illustration occupies lower 40%, airy composition, never overlaps copy. Footer handle bottom left and action bottom right, both readable, green. Use EXACT provided Turkish copy with correct ı, İ, ş, ğ, ü, ö, ç, no additions or missing words. Only text listed in the card may appear. Match type hierarchy and location across the series.

Input image 2 is the original transparent brand wordmark. Use it faithfully for the small header logo, do not invent a new logo or distort its lettering.

CARD SPECIFICATION:
Page counter: "06 / 06"
Category label: "05 · ÜRÜN FOTOĞRAFLARI"
Headline (line breaks suggested): "Fotoğraf, ürünü
anlatıyor mu?"
Supporting text: "Net, güncel ve servis ettiğin
ürünü yansıtan fotoğraflar kullan."
Bottom left: "@masabuco"
Bottom right: "Kaydet. Menünü kontrol ederken aç."
Illustration: One ceramic plate with an appetizing simple slice of cake and a cream photo print showing the SAME slice of cake from above, placed naturally beside it. Fine green contour and subtle watercolor sage shading, attractive editorial still life, no UI screenshot or actual photographic proof, no extra printed words. Keep sufficient footer space for the save call-to-action.
```
