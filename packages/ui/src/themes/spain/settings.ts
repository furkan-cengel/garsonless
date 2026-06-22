import type { SettingsGroup } from '../types'
import { TEMPLATES } from '@garsonless/design-engine'

const SPAIN_DEFAULTS = TEMPLATES['spain']!

export const SPAIN_SETTINGS_SCHEMA: SettingsGroup[] = [
  {
    id: 'surface',
    label: 'Yüzeyler',
    fields: [
      { id: 'bg', label: 'Sayfa Zemini', type: 'color', cssVar: '--p-bg', themeField: 'bg', default: SPAIN_DEFAULTS.bg },
      { id: 'accentSoft', label: 'Kart Zemini', type: 'color', cssVar: '--p-accent-soft', themeField: 'accentSoft', default: SPAIN_DEFAULTS.accentSoft },
      { id: 'accent', label: 'Ana Metin / Siyah', type: 'color', cssVar: '--p-accent', themeField: 'accent', default: SPAIN_DEFAULTS.accent },
      { id: 'cta', label: 'Ödeme Butonu', type: 'color', cssVar: '--p-cta', themeField: 'cta', default: SPAIN_DEFAULTS.cta },
      { id: 'headerBg', label: 'Cam Bar Zemini', type: 'color', themeField: 'headerBg', default: SPAIN_DEFAULTS.headerBg },
      {
        id: 'texture',
        label: 'Zemin Dokusu',
        type: 'select',
        themeField: 'texture',
        default: SPAIN_DEFAULTS.texture,
        options: [
          { value: 'solid', label: 'Düz' },
          { value: 'grid', label: 'İnce grid' },
          { value: 'noise', label: 'Kağıt hissi' },
        ],
      },
    ],
  },
  {
    id: 'topbar',
    label: 'Üst Bar',
    fields: [
      { id: 'stickyHeader', label: 'Sabit Cam Bar', type: 'toggle', themeField: 'stickyHeader', default: SPAIN_DEFAULTS.stickyHeader },
      { id: 'headerBorder', label: 'Alt Ayırıcı', type: 'toggle', themeField: 'headerBorder', default: SPAIN_DEFAULTS.headerBorder },
      { id: 'headerNameSize', label: 'Restoran Adı', type: 'range', min: 22, max: 36, step: 1, unit: 'px', themeField: 'headerNameSize', default: SPAIN_DEFAULTS.headerNameSize },
      { id: 'headerShowMenu', label: 'Sol Menü İkonu', type: 'toggle', themeField: 'headerShowMenu', default: SPAIN_DEFAULTS.headerShowMenu },
      { id: 'headerTableBadge', label: 'Masa Durumu', type: 'toggle', themeField: 'headerTableBadge', default: SPAIN_DEFAULTS.headerTableBadge },
      {
        id: 'headerShowLang',
        label: 'Dil Kontrolü',
        type: 'toggle',
        themeField: 'headerShowLang',
        default: SPAIN_DEFAULTS.headerShowLang,
      },
    ],
  },
  {
    id: 'welcome',
    label: 'Karşılama',
    fields: [
      { id: 'pageDescription', label: 'Alt Metin', type: 'select', themeField: 'pageDescription', default: SPAIN_DEFAULTS.pageDescription ?? '',
        options: [
          { value: '', label: 'Misafir isimleri' },
          { value: 'short', label: 'Kısa karşılama' },
          { value: 'table', label: 'Masa bilgisi' },
          { value: 'hidden', label: 'Gizle' },
        ],
      },
      { id: 'fs', label: 'Metin Ölçeği', type: 'range', min: 14, max: 18, step: 1, unit: 'px', cssVar: '--p-fs', themeField: 'fs', default: SPAIN_DEFAULTS.fs },
      { id: 'headerLogoStyle', label: 'Başlık Stili', type: 'select', themeField: 'headerLogoStyle', default: SPAIN_DEFAULTS.headerLogoStyle,
        options: [
          { value: 'display', label: 'Büyük display' },
          { value: 'wordmark', label: 'Sade wordmark' },
          { value: 'image', label: 'Monogram' },
        ],
      },
    ],
  },
  {
    id: 'menu-cards',
    label: 'Menü Kartları',
    fields: [
      { id: 'catnavShowIcons', label: 'İkonlar', type: 'toggle', themeField: 'catnavShowIcons', default: SPAIN_DEFAULTS.catnavShowIcons },
      { id: 'catnavShowCount', label: 'Numara / Fiyat İzi', type: 'toggle', themeField: 'catnavShowCount', default: SPAIN_DEFAULTS.catnavShowCount },
      {
        id: 'catnavStyle',
        label: 'Kart Tonu',
        type: 'select',
        themeField: 'catnavStyle',
        default: SPAIN_DEFAULTS.catnavStyle,
        options: [
          { value: 'pills', label: 'Pastel' },
          { value: 'visual', label: 'Görselli' },
          { value: 'outlined', label: 'Çerçeveli' },
          { value: 'segmented', label: 'Minimal' },
        ],
      },
      { id: 'radius', label: 'Kart Köşesi', type: 'range', min: 8, max: 24, step: 1, unit: 'px', cssVar: '--p-radius', themeField: 'radius', default: SPAIN_DEFAULTS.radius },
      { id: 'gap', label: 'Kart Aralığı', type: 'range', min: 12, max: 28, step: 2, unit: 'px', cssVar: '--p-gap', themeField: 'gap', default: SPAIN_DEFAULTS.gap },
    ],
  },
  {
    id: 'dish-list',
    label: 'Ürün Listesi',
    fields: [
      { id: 'cardShowDesc', label: 'Açıklama', type: 'toggle', themeField: 'cardShowDesc', default: SPAIN_DEFAULTS.cardShowDesc },
      { id: 'cardShowTag', label: 'Görsel Rozeti', type: 'toggle', themeField: 'cardShowTag', default: SPAIN_DEFAULTS.cardShowTag },
      {
        id: 'cardCtaStyle',
        label: 'Ekle Kontrolü',
        type: 'select',
        themeField: 'cardCtaStyle',
        default: SPAIN_DEFAULTS.cardCtaStyle,
        options: [
          { value: 'pill', label: 'Add hapı' },
          { value: 'icon', label: 'Sadece ikon' },
          { value: 'full', label: 'Tam buton' },
        ],
      },
      {
        id: 'shadow',
        label: 'Kart Gölgesi',
        type: 'select',
        themeField: 'shadow',
        default: SPAIN_DEFAULTS.shadow,
        options: [
          { value: 'none', label: 'Yok' },
          { value: 'soft', label: 'Yumuşak' },
          { value: 'hard', label: 'Belirgin' },
        ],
      },
      { id: 'sectionGap', label: 'Bölüm Aralığı', type: 'range', min: 20, max: 48, step: 4, unit: 'px', cssVar: '--p-section-gap', themeField: 'sectionGap', default: SPAIN_DEFAULTS.sectionGap },
    ],
  },
  {
    id: 'payment-bar',
    label: 'Ödeme Barı',
    fields: [
      { id: 'cartShowBadge', label: 'Alt Sekmeler', type: 'toggle', themeField: 'cartShowBadge', default: SPAIN_DEFAULTS.cartShowBadge },
      {
        id: 'cartIcon',
        label: 'Aksiyon İkonu',
        type: 'select',
        themeField: 'cartIcon',
        default: SPAIN_DEFAULTS.cartIcon,
        options: [
          { value: 'cart', label: 'Cart' },
          { value: 'bag', label: 'Bag' },
          { value: 'basket', label: 'Basket' },
        ],
      },
      { id: 'cartButtonText', label: 'Birincil Aksiyon', type: 'select', themeField: 'cartButtonText', default: SPAIN_DEFAULTS.cartButtonText ?? 'Pay',
        options: [
          { value: 'Pay', label: 'Pay' },
          { value: 'Order', label: 'Order' },
          { value: 'Checkout', label: 'Checkout' },
        ],
      },
      {
        id: 'cartStyle',
        label: 'Bar Stili',
        type: 'select',
        themeField: 'cartStyle',
        default: SPAIN_DEFAULTS.cartStyle,
        options: [
          { value: 'banner', label: 'Tam ödeme barı' },
          { value: 'pill', label: 'Kompakt bar' },
          { value: 'fab', label: 'Mini sepet' },
        ],
      },
    ],
  },
  {
    id: 'announcement',
    label: 'Servis Bildirimi',
    fields: [
      { id: 'announcementEnabled', label: 'Üst Duyuru', type: 'toggle', themeField: 'announcementEnabled', default: SPAIN_DEFAULTS.announcementEnabled },
      {
        id: 'announcementText',
        label: 'Duyuru Metni',
        type: 'select',
        themeField: 'announcementText',
        default: SPAIN_DEFAULTS.announcementText,
        options: [
          { value: 'Hoş geldiniz! 🎉', label: 'Welcome' },
          { value: 'Today’s chef selection is ready', label: 'Chef selection' },
          { value: 'Ask staff for wine pairing', label: 'Wine pairing' },
        ],
      },
      { id: 'announcementBg', label: 'Duyuru Zemini', type: 'color', themeField: 'announcementBg', default: SPAIN_DEFAULTS.announcementBg },
      { id: 'announcementColor', label: 'Duyuru Yazısı', type: 'color', themeField: 'announcementColor', default: SPAIN_DEFAULTS.announcementColor },
    ],
  },
]
