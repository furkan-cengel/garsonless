# Üretim promptları

## Son kontrol düzeltmeleri

### Kart 4

```text
Edit image 1, card 04. Image 2 is only the series cover as reference for canvas shape and spacing. Match image 2's EXACT portrait proportions and output dimensions: width 1092 pixels, height 1440 pixels (aspect 91:120, NOT 4:5). Preserve every Turkish word, original logo, illustration, colors and overall composition of image 1. The only change is fitting it to the cover's taller canvas by adding a little breathing space, NOT stretching the typography or distorting the drawing. Keep '04 / 05' at the top right; all text and arrow fully within 75px edges. Keep the plan line and '@masabuco' readable near bottom. No additions or omissions, no framing.
```

### Kart 5

```text
Use case: text-localization/compositing. Edit this completed carousel card only. Preserve its 1092 by 1440 pixel portrait canvas, official logo, page number, every existing Turkish word, headline, coffee illustration, colors and style unchanged. Add the missing Instagram account handle '@masabuco' in dark forest-green sans-serif, approximately 46 pixels, aligned with the left edge of 'takip et.', in the clear cream space directly beneath that call to action and left of the coffee cup. Leave adequate breathing room; adjust only local blank space if necessary, never cover the cup or any text. Keep footer 'masabu.co' unchanged. No other new words, no UI buttons. This exact handle is essential: @ m a s a b u c o, without spaces in final.
```


Yerleşik image_gen aracı kullanıldı; CLI/API fallback kullanılmadı. Her kart ayrı üretildi. Kapak, resmî wordmark ile mevcut Google kapak görselini referans aldı. Diğer kartlar kapak ile özgün wordmark referanslarını kullandı. Sonuçlar gerçek ürün ekranı değil, kavramsal çizimlerdir.

## 01 — Kapak

```text
Use case: ads-marketing.
Create ONE finished first carousel card for Masabu, a Turkish cafe and restaurant SaaS. Portrait 4:5, exactly 1080x1350 if supported. This is a ready-to-use social post image, not a presentation/mockup, no outer frame.
Inputs: image 1 is the official masabu wordmark, a supporting brand insert. Preserve the wordmark's exact spelling, silhouette, tiny QR texture, black 'masa', green 'bu', and square period, don't redesign it. Image 2 is ONLY a palette/typography mood reference, NOT the layout to repeat.
Art direction: premium editorial campaign, warm ivory #FDFAF5, ink #1C1814, forest green #176341, pale sage #E2EBDD. Confident expressive large Fraunces-like serif title plus restrained Geist-like sans serif body. Airy typography, strong hierarchy and crisp Turkish accents. Generous 80px side margins. One integrated sophisticated line-and-paper illustration, not generic SaaS floating cards, not a grid of icons.
Layout: small original logo upper left around 260px wide, upper right a restrained '01 / 05' page marker. Below a small sans serif eyebrow. Dominant headline left aligned on two lines starting approximately y=235, about 105px type. Below at y=510 a two-line readable subtitle around 34px. Lower-middle illustration y=690..1100: poetic editorial overhead cafe table scene, round table, espresso cup and saucer, linen napkin, small green sprig, and a diagonally placed simple outlined smartphone with ONE stylized fork-and-plate symbol inside it. Hand-drawn dark green fine linework, subtle flat paper shapes and ample cream negative space; no invented app interface, no buttons, no screen text, no QR code. A single elegant thin green line threads through table elements to suggest connected service. Footer at y=1240 has small handle left and swipe instruction right.
All text verbatim:
eyebrow: 'KAFE VE RESTORANLAR İÇİN'
headline line 1: 'QR menüyle'
headline line 2: 'başla.'
subtitle line 1: 'Sipariş, adisyon ve mutfağı'
subtitle line 2: 'aynı sistemden yönet.'
page marker: '01 / 05'
footer left: '@masabuco'
footer right: 'Tanışmak için kaydır →'
Constraints: no other words, no prices, no trial badge, no analytics promises, no photographs of real people, no fake testimonial, no Instagram/Facebook logo, no UI mockup. Perfect Turkish spelling including ü, ş, ı, ğ. Preserve the official logo. Flat matte elegant editorial finish, no 3D, no shiny gradients. Essential text entirely within safe 80px edges.
```

## 02-qr-menu

```text
Use case: ads-marketing. Make ONE finished Masabu carousel card, a new artwork, not a screenshot of a poster. Portrait target 1080x1350 pixels, 4:5, no outer frame. Input image 1 is the preceding cover: match its editorial serif headline, sans-serif supporting text, warm ivory paper, forest-green drawing outlines, delicately textured paper illustration, spacious margins, logo position, footer alignment. Input image 2 is the ORIGINAL logo to preserve exactly, including QR texture, black 'masa', green 'bu', square period; use as brand insert. Small original logo upper left and page marker upper right. 80px safe side edges, 80px top/bottom margins. Headline begins around y=240, huge expressive black Fraunces-like serif, max 3 lines. Supporting copy around y=540, clearly readable sans serif. The illustrative scene occupies lower middle. Footer handle '@masabuco' at lower left, right arrow '→' lower right. All text is Turkish, exact as below, no extra words. NO fabricated product interface, no screen labels, no app buttons, no pseudo QR codes, no testimonial, no customer details, no real photography, no price or feature guarantees, no 3D. Illustrations are clearly symbolic editorial artwork, never actual app screenshots.
Page marker '02 / 05'. Eyebrow 'DİJİTAL MENÜ'. Exact title in two lines: 'Menün güncel.' / 'Tarzın sana ait.' Exact supporting text two lines: 'Ürünleri, fiyatları ve menü görünümünü' / 'tek panelden düzenle.' A quiet dark green package line above footer: 'QR menü · Starter ve üzeri'. Artwork: elegant editorial paper illustration of a cream open menu folder with a simple plate-and-leaf drawing, a pencil, three muted cream/sage/green color swatches, and a minimal phone with a single botanical sprig illustration on its cream screen. No UI, no menu-item text, no barcode. A delicate green continuous curved line ties the objects together. Keep visual around lower-right, leaving breathing space. Tiny sage paper semicircle grounds the objects. Match cover quality.
```

## 03-adisyon

```text
Use case: ads-marketing. Make ONE finished Masabu carousel card, a new artwork, not a screenshot of a poster. Portrait target 1080x1350 pixels, 4:5, no outer frame. Input image 1 is the preceding cover: match its editorial serif headline, sans-serif supporting text, warm ivory paper, forest-green drawing outlines, delicately textured paper illustration, spacious margins, logo position, footer alignment. Input image 2 is the ORIGINAL logo to preserve exactly, including QR texture, black 'masa', green 'bu', square period; use as brand insert. Small original logo upper left and page marker upper right. 80px safe side edges, 80px top/bottom margins. Headline begins around y=240, huge expressive black Fraunces-like serif, max 3 lines. Supporting copy around y=540, clearly readable sans serif. The illustrative scene occupies lower middle. Footer handle '@masabuco' at lower left, right arrow '→' lower right. All text is Turkish, exact as below, no extra words. NO fabricated product interface, no screen labels, no app buttons, no pseudo QR codes, no testimonial, no customer details, no real photography, no price or feature guarantees, no 3D. Illustrations are clearly symbolic editorial artwork, never actual app screenshots.
Page marker '03 / 05'. Eyebrow 'MASA VE ADİSYON'. Exact title in two lines: 'Masanın hesabı' / 'sende.' Exact supporting text two lines: 'Personel siparişini ve adisyonu' / 'masayla birlikte takip et.' Quiet dark green package line above footer: 'Personel siparişi ve adisyon · Plus ve üzeri'. Artwork: premium editorial overhead cafe table scene consistent with cover: round table, two cups, folded linen and a large cream paper bill/order pad with restrained abstract horizontal pencil strokes and check marks, no numbers or readable text; a green pencil resting diagonally across pad. One elegant green line connects table to paper pad to communicate relationship. Restrained forest-green outline, warm paper collage texture, pale sage shadows, no currency signs, no payments screens, no phone interface.
```

## 04-mutfak

```text
Use case: ads-marketing. Make ONE finished Masabu carousel card, a new artwork, not a screenshot of a poster. Portrait target 1080x1350 pixels, 4:5, no outer frame. Input image 1 is the preceding cover: match its editorial serif headline, sans-serif supporting text, warm ivory paper, forest-green drawing outlines, delicately textured paper illustration, spacious margins, logo position, footer alignment. Input image 2 is the ORIGINAL logo to preserve exactly, including QR texture, black 'masa', green 'bu', square period; use as brand insert. Small original logo upper left and page marker upper right. 80px safe side edges, 80px top/bottom margins. Headline begins around y=240, huge expressive black Fraunces-like serif, max 3 lines. Supporting copy around y=540, clearly readable sans serif. The illustrative scene occupies lower middle. Footer handle '@masabuco' at lower left, right arrow '→' lower right. All text is Turkish, exact as below, no extra words. NO fabricated product interface, no screen labels, no app buttons, no pseudo QR codes, no testimonial, no customer details, no real photography, no price or feature guarantees, no 3D. Illustrations are clearly symbolic editorial artwork, never actual app screenshots.
Page marker '04 / 05'. Eyebrow 'QR SİPARİŞ VE MUTFAK'. Exact title in two lines: 'Sipariş masadan' / 'mutfağa.' Exact supporting text three lines: 'Misafirin QR siparişini ve' / 'mutfaktaki hazırlık sürecini' / 'birlikte takip et.' Quiet dark green package line above footer: 'QR sipariş ve mutfak ekranı · Pro ve üzeri'. Artwork: symbolic restaurant workflow illustration, NOT a dashboard. On the lower left a small round cafe table with plate and a simple phone bearing one fork/plate pictogram. A long thin forest-green curved arrow flows from the table to a kitchen pass on the lower right, with two plates and a cloche under a small hanging restaurant heat lamp. A tiny abstract paper order ticket hangs on the pass with only strokes, no words. Beautiful matte cream and pale sage editorial paper texture and green pen linework consistent with cover. Maintain same headline/readability hierarchy.
```

## 05-takip

```text
Use case: ads-marketing. Make ONE finished Masabu carousel card, a new artwork, not a screenshot of a poster. Portrait target 1080x1350 pixels, 4:5, no outer frame. Input image 1 is the preceding cover: match its editorial serif headline, sans-serif supporting text, warm ivory paper, forest-green drawing outlines, delicately textured paper illustration, spacious margins, logo position, footer alignment. Input image 2 is the ORIGINAL logo to preserve exactly, including QR texture, black 'masa', green 'bu', square period; use as brand insert. Small original logo upper left and page marker upper right. 80px safe side edges, 80px top/bottom margins. Headline begins around y=240, huge expressive black Fraunces-like serif, max 3 lines. Supporting copy around y=540, clearly readable sans serif. The illustrative scene occupies lower middle. Footer handle '@masabuco' at lower left, right arrow '→' lower right. All text is Turkish, exact as below, no extra words. NO fabricated product interface, no screen labels, no app buttons, no pseudo QR codes, no testimonial, no customer details, no real photography, no price or feature guarantees, no 3D. Illustrations are clearly symbolic editorial artwork, never actual app screenshots.
Page marker '05 / 05'. Eyebrow 'TANIŞTIĞIMIZA MEMNUN OLDUK'. Exact dominant title in three lines: 'İşletmen için' / 'iyi fikirler' / 'burada.' Exact supporting text three lines: 'QR menü ve servis yönetimiyle ilgili' / 'pratik fikirler için' / 'takip et.' Make 'takip et.' bold green, about 44px, a clear editorial call to action, not a fake app button. Artwork: a beautiful simple single drawn green espresso cup with coffee steam, with a small cream open notebook beside it; three tiny expressive curved lines above it suggest ideas, not stars or confetti. Keep this illustration smaller and lower right so call to action has breathing room. Across lower-middle left, '@masabuco' as a prominent dark green sans-serif account signature. Footer left 'masabu.co' instead of the usual handle; no right arrow on this final card. Stay on ivory background; do not create huge dark green blocks or distort the original wordmark. No trial sales pitch, no promise of daily posting, no other words.
```
