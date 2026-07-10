'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { THEME_REGISTRY } from '@garsonless/ui'
import type { SettingField, SettingsGroup } from '@garsonless/ui'
import type { GarsonlessTheme } from '@garsonless/design-engine'
import { saveActiveTemplate, saveTheme } from '../../lib/actions/theme'
import { uploadLogo, removeLogo } from '../../lib/actions/restaurant'
import { createDashboardBrowserClient } from '../../lib/supabase'
import { useShell } from '../../lib/shell-context'
import { I } from '../../lib/ui'

type EditorTab = 'design' | 'layout' | 'content'
type SectionFieldType = 'text' | 'textarea' | 'color' | 'range' | 'select' | 'url' | 'toggle' | 'product-select' | 'category-select' | 'heading'
type PageBlock = { type: 'section' | 'category' | 'nav'; id: string }
type PreviewStatus = 'preparing' | 'ready' | 'degraded'

interface SectionSettingField {
  key: string
  label: string
  type: SectionFieldType
  editorTab: EditorTab
  placeholder?: string
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: Array<{ value: string; label: string }>
}

interface Props {
  restaurantId: string
  restaurantSlug: string
  restaurantName: string
  restaurantLogoUrl: string | null
  templateId: string
  initialTheme: GarsonlessTheme
  menuCategories: Array<{ id: string; name: string; parentId?: string | null }>
  menuItems: Array<{ id: string; name: string; categoryId: string; categoryName: string }>
}

const SYSTEM_FONTS = new Set(['Georgia', 'Times New Roman', 'Arial', 'Helvetica', 'Verdana', 'Bodoni 72'])
const EDITOR_TABS: Array<{ id: EditorTab; label: string }> = [
  { id: 'design', label: 'Tasarım' },
  { id: 'layout', label: 'Düzen' },
  { id: 'content', label: 'İçerik' },
]
const THEME_GROUP_ID = 'theme'
const THEME_GROUP_SOURCE_IDS = new Set(['colors', 'typography'])
const PREVIEW_FALLBACK_MS = 5_000

const SECTION_LIBRARY = [
  { id: 'hero-banner', group: 'Üst Bölümler', label: 'Hero Banner', sub: 'Tam genişlik kampanya görseli + CTA', icon: <I.image size={17} />, plan: 'free' },
  { id: 'promo-strip', group: 'Üst Bölümler', label: 'Promo Şeridi', sub: 'Kayan duyuru bandı', icon: <I.megaphone size={17} />, plan: 'free' },
  { id: 'featured-scroll', group: 'Ürün Gösterimi', label: 'Öne Çıkanlar', sub: 'Yatay kaydırılabilir vitrin', icon: <I.arrow size={17} />, plan: 'pro' },
  { id: 'chef-pick', group: 'Ürün Gösterimi', label: "Şef'in Seçimi", sub: 'İmza tabaklar ve şef notu', icon: <I.cutlery size={17} />, plan: 'pro' },
  { id: 'combo-ribbon', group: 'Promosyon', label: 'Kombo Şerit', sub: '3 renk şeritli combo kartları', icon: <I.gift size={17} />, plan: 'pro' },
  { id: 'discount-badge', group: 'Promosyon', label: 'İndirim Rozeti', sub: '"2x1 OFFER" oval rozeti', icon: <I.tag size={17} />, plan: 'pro' },
  { id: 'daily-special', group: 'Promosyon', label: 'Günün Özeli', sub: 'Tek ürün + şef notu + sayaç', icon: <I.clock size={17} />, plan: 'free' },
  { id: 'promo-slider', group: 'Promosyon', label: 'Kampanya Slider', sub: 'Dönen kampanya kartları (kupon, flash, combo…)', icon: <I.section size={17} />, plan: 'pro' },
  { id: 'reviews', group: 'Bağlam', label: 'Yorumlar', sub: 'Yıldız + müşteri alıntısı', icon: <I.star size={17} />, plan: 'free' },
  { id: 'hours', group: 'Bağlam', label: 'Çalışma Saatleri', sub: 'Açılış kapanış bilgisi', icon: <I.clock size={17} />, plan: 'free' },
  { id: 'allergens', group: 'Bağlam', label: 'Alerjen Bilgileri', sub: 'Diyet ve alerjen ikonları', icon: <I.warn size={17} />, plan: 'free' },
  { id: 'gallery', group: 'Bağlam', label: 'Foto Galerisi', sub: 'Mekan kareleri grid görünümü', icon: <I.image size={17} />, plan: 'pro' },
  { id: 'request-buttons', group: 'Etkileşim', label: 'İstek Butonları', sub: 'Garson / Hesap / Su gibi hızlı istekler', icon: <I.bell size={17} />, plan: 'free' },
  { id: 'wifi-info', group: 'Etkileşim', label: 'Wi-Fi Bilgisi', sub: 'Ağ adı ve şifre kartı', icon: <I.globe size={17} />, plan: 'free' },
  { id: 'social-block', group: 'Site Sonu', label: 'Sosyal Medya', sub: 'Instagram, WhatsApp ve TikTok', icon: <I.arrow size={17} />, plan: 'free' },
  { id: 'footer', group: 'Site Sonu', label: 'Footer', sub: 'Adres, iletişim ve marka sonu', icon: <I.chevDown size={17} />, plan: 'free' },
] as const
const SECTION_PLAN_META = {
  free: { label: 'FREE', bg: '#e6f7ef', fg: '#177a4b' },
  pro: { label: 'PRO', bg: '#fff2d9', fg: '#b66400' },
} as const
const SECTION_GROUPS = ['Tümü', 'Üst Bölümler', 'Ürün Gösterimi', 'Promosyon', 'Bağlam', 'Etkileşim', 'Site Sonu'] as const
const FOOD_ICON_OPTIONS = [
  { value: '🍳', label: 'Sahanda Yumurta' },
  { value: '🥚', label: 'Haşlama' },
  { value: '🍅', label: 'Menemen' },
  { value: '🧀', label: 'Peynir Tabağı' },
  { value: '🥓', label: 'Pastırma' },
  { value: '🌭', label: 'Sucuk / Hotdog' },
  { value: '🥖', label: 'Ekmek' },
  { value: '🥐', label: 'Kruvasan' },
  { value: '🥨', label: 'Simit / Pretzel' },
  { value: '🫓', label: 'Bazlama / Nachos' },
  { value: '🧈', label: 'Tereyağı' },
  { value: '🍯', label: 'Bal / Baklava' },
  { value: '🫙', label: 'Reçel' },
  { value: '🥯', label: 'Poğaça' },
  { value: '🥞', label: 'Pankek' },
  { value: '🧇', label: 'Waffle / Çıtır' },
  { value: '🍞', label: 'Tost' },
  { value: '🥗', label: 'Salata' },
  { value: '🫒', label: 'Zeytin' },
  { value: '☕', label: 'Kahve' },
  { value: '🥛', label: 'Latte / Salep' },
  { value: '🍵', label: 'Çay / Matcha' },
  { value: '🫖', label: 'Demlik Çay / Lokum' },
  { value: '🍫', label: 'Sıcak Çikolata / Brownie' },
  { value: '🌿', label: 'Bitki Çayı' },
  { value: '🧉', label: 'Mate' },
  { value: '🧊', label: 'Ice Latte' },
  { value: '🥤', label: 'Cold Brew / Milkshake / Kola' },
  { value: '🧋', label: 'Bubble Tea' },
  { value: '🍹', label: 'Smoothie' },
  { value: '🍊', label: 'Portakal Suyu' },
  { value: '🍋', label: 'Limonata' },
  { value: '🍓', label: 'Çilek / Meyveli' },
  { value: '🥥', label: 'Hindistan Cevizi' },
  { value: '🫐', label: 'Yaban Mersini' },
  { value: '🥭', label: 'Mango' },
  { value: '🍉', label: 'Karpuz' },
  { value: '🧃', label: 'Meyve Suyu' },
  { value: '💧', label: 'Soda' },
  { value: '🍶', label: 'Ayran' },
  { value: '🍕', label: 'Pizza' },
  { value: '🍔', label: 'Burger' },
  { value: '🥪', label: 'Sandviç' },
  { value: '🌯', label: 'Dürüm' },
  { value: '🌮', label: 'Taco' },
  { value: '🍝', label: 'Makarna' },
  { value: '🍜', label: 'Noodle' },
  { value: '🍲', label: 'Güveç' },
  { value: '🥘', label: 'Tava' },
  { value: '🍛', label: 'Köri' },
  { value: '🥩', label: 'Biftek' },
  { value: '🍗', label: 'Tavuk' },
  { value: '🐟', label: 'Balık' },
  { value: '🍤', label: 'Karides' },
  { value: '🧆', label: 'Köfte / Falafel' },
  { value: '🥟', label: 'Mantı' },
  { value: '🥙', label: 'Pide' },
  { value: '🍚', label: 'Pilav' },
  { value: '🍰', label: 'Cheesecake' },
  { value: '🎂', label: 'Pasta' },
  { value: '🧁', label: 'Cupcake' },
  { value: '🍮', label: 'Sütlaç' },
  { value: '🍩', label: 'Donut' },
  { value: '🥧', label: 'Turta' },
  { value: '🍪', label: 'Kurabiye' },
  { value: '🍨', label: 'Dondurma' },
  { value: '🍦', label: 'Külah' },
  { value: '🥮', label: 'Künefe' },
  { value: '🍌', label: 'Magnolia' },
  { value: '🥜', label: 'Fıstıklı / Kuruyemiş' },
  { value: '🍟', label: 'Patates' },
  { value: '🧅', label: 'Soğan Halkası' },
  { value: '🍿', label: 'Mısır' },
  { value: '🍢', label: 'Şiş' },
]
const SECTION_SETTING_SCHEMA: Record<string, SectionSettingField[]> = {
  'hero-banner': [
    { key: 'eyebrow', label: 'Etiket', type: 'text', editorTab: 'content', placeholder: 'GÜN ÖZEL' },
    { key: 'title', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: 'Künefe Tabağı' },
    { key: 'body', label: 'Açıklama', type: 'textarea', editorTab: 'content', placeholder: 'Favorilerinizi keşfedin...' },
    { key: 'cta', label: 'Buton', type: 'text', editorTab: 'content', placeholder: 'Sipariş ver' },
    { key: 'targetType', label: 'Aksiyon', type: 'select', editorTab: 'content', options: [
      { value: 'none', label: 'Aksiyon yok' },
      { value: 'category', label: 'Kategoriye git' },
      { value: 'product', label: 'Ürüne git' },
      { value: 'cart', label: 'Sepete yönlendir' },
      { value: 'link', label: 'Dış link' },
    ] },
    { key: 'targetId', label: 'Hedef ID', type: 'text', editorTab: 'content', placeholder: 'kategori veya ürün ID' },
    { key: 'targetUrl', label: 'Link', type: 'url', editorTab: 'content', placeholder: 'https://...' },
    { key: 'imageUrl', label: 'Fotoğraf', type: 'url', editorTab: 'design', placeholder: 'https://.../hero.jpg' },
    { key: 'imageMode', label: 'Görsel', type: 'select', editorTab: 'design', options: [
      { value: 'background', label: 'Arka plan' },
      { value: 'side', label: 'Sağ ürün görseli' },
      { value: 'none', label: 'Gizle' },
    ] },
    { key: 'bgStart', label: 'Renk 1', type: 'color', editorTab: 'design', placeholder: '#a13b7a' },
    { key: 'bgEnd', label: 'Renk 2', type: 'color', editorTab: 'design', placeholder: '#d97757' },
    { key: 'textColor', label: 'Yazı', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'buttonBg', label: 'Buton BG', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'buttonText', label: 'Buton Yazı', type: 'color', editorTab: 'design', placeholder: '#a13b7a' },
    { key: 'overlay', label: 'Overlay', type: 'range', editorTab: 'design', min: 0, max: 80, step: 5, unit: '%' },
    { key: 'height', label: 'Yükseklik', type: 'range', editorTab: 'layout', min: 120, max: 280, step: 8, unit: 'px' },
    { key: 'padding', label: 'Boşluk', type: 'range', editorTab: 'layout', min: 12, max: 32, step: 2, unit: 'px' },
    { key: 'radius', label: 'Köşe', type: 'range', editorTab: 'layout', min: 0, max: 32, step: 1, unit: 'px' },
    { key: 'align', label: 'Hizalama', type: 'select', editorTab: 'layout', options: [
      { value: 'left', label: 'Sol' },
      { value: 'center', label: 'Orta' },
      { value: 'right', label: 'Sağ' },
    ] },
  ],
  'mode-tabs': [
    { key: 'mode1', label: 'Mod 1', type: 'text', editorTab: 'content', placeholder: 'Salon' },
    { key: 'mode2', label: 'Mod 2', type: 'text', editorTab: 'content', placeholder: 'Paket' },
    { key: 'mode3', label: 'Mod 3', type: 'text', editorTab: 'content', placeholder: 'Teslimat' },
  ],
  'address-bar': [
    { key: 'title', label: 'Metin', type: 'text', editorTab: 'content', placeholder: 'Masa teslimatı · Adres seç' },
  ],
  search: [
    { key: 'title', label: 'Placeholder', type: 'text', editorTab: 'content', placeholder: 'Ürün ara...' },
  ],
  'promo-strip': [
    { key: 'title', label: 'Duyuru', type: 'text', editorTab: 'content', placeholder: 'İLK SİPARİŞE %20 İNDİRİM' },
    { key: 'repeatText', label: 'Tekrar', type: 'text', editorTab: 'content', placeholder: 'BUGÜNE ÖZEL · MASADAN HIZLI SİPARİŞ' },
    { key: 'targetType', label: 'Aksiyon', type: 'select', editorTab: 'content', options: [
      { value: 'none', label: 'Aksiyon yok' },
      { value: 'category', label: 'Kategoriye git' },
      { value: 'product', label: 'Ürüne git' },
      { value: 'link', label: 'Dış link' },
    ] },
    { key: 'targetId', label: 'Hedef ID', type: 'text', editorTab: 'content', placeholder: 'kategori veya ürün ID' },
    { key: 'targetUrl', label: 'Link', type: 'url', editorTab: 'content', placeholder: 'https://...' },
    { key: 'bgColor', label: 'Arka Plan', type: 'color', editorTab: 'design', placeholder: '#1c1d20' },
    { key: 'textColor', label: 'Yazı', type: 'color', editorTab: 'design', placeholder: '#ffd089' },
    { key: 'accentColor', label: 'Vurgu', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'height', label: 'Yükseklik', type: 'range', editorTab: 'layout', min: 28, max: 64, step: 2, unit: 'px' },
    { key: 'speed', label: 'Hız', type: 'range', editorTab: 'layout', min: 6, max: 40, step: 1, unit: 'sn' },
    { key: 'animation', label: 'Animasyon', type: 'select', editorTab: 'layout', options: [
      { value: 'marquee', label: 'Kayan' },
      { value: 'static', label: 'Sabit' },
      { value: 'fade', label: 'Fade' },
    ] },
    { key: 'direction', label: 'Yön', type: 'select', editorTab: 'layout', options: [
      { value: 'left', label: 'Sağa doğru' },
      { value: 'right', label: 'Sola doğru' },
    ] },
    { key: 'pauseOnHover', label: 'Hover durdur', type: 'toggle', editorTab: 'layout' },
  ],
  'combo-ribbon': [
    { key: 'comboCount', label: 'Kart Sayısı', type: 'select', editorTab: 'content', options: [
      { value: '1', label: '1 kart' },
      { value: '2', label: '2 kart' },
      { value: '3', label: '3 kart' },
    ] },
    { key: 'title', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: '🔥 Komboları Kaçırma' },
    { key: 'combo1Title', label: 'Combo 1', type: 'text', editorTab: 'content', placeholder: 'Burger + Patates + İçecek' },
    { key: 'combo1Badge', label: 'Combo 1 İndirim', type: 'text', editorTab: 'content', placeholder: '-30%' },
    { key: 'combo1RibbonTop', label: 'C1 Ribbon Üst', type: 'text', editorTab: 'content', placeholder: 'MEGA' },
    { key: 'combo1RibbonBottom', label: 'C1 Ribbon Alt', type: 'text', editorTab: 'content', placeholder: 'COMBO' },
    { key: 'combo1IconCount', label: 'C1 İkon Sayısı', type: 'select', editorTab: 'content', options: [
      { value: '1', label: '1 ikon' },
      { value: '2', label: '2 ikon' },
      { value: '3', label: '3 ikon' },
    ] },
    { key: 'combo1Icon1', label: 'C1 İkon 1', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo1Icon2', label: 'C1 İkon 2', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo1Icon3', label: 'C1 İkon 3', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo1ImageUrl', label: 'C1 Görsel', type: 'url', editorTab: 'content', placeholder: 'https://.../combo.png' },
    { key: 'combo1Price', label: 'Combo 1 Fiyat', type: 'text', editorTab: 'content', placeholder: '189' },
    { key: 'combo1OldPrice', label: 'Combo 1 Eski Fiyat', type: 'text', editorTab: 'content', placeholder: '270' },
    { key: 'combo2Title', label: 'Combo 2', type: 'text', editorTab: 'content', placeholder: 'Kahve + Kruvasan + Reçel' },
    { key: 'combo2Badge', label: 'Combo 2 İndirim', type: 'text', editorTab: 'content', placeholder: '-20%' },
    { key: 'combo2RibbonTop', label: 'C2 Ribbon Üst', type: 'text', editorTab: 'content', placeholder: 'KAHVALTI' },
    { key: 'combo2RibbonBottom', label: 'C2 Ribbon Alt', type: 'text', editorTab: 'content', placeholder: 'COMBO' },
    { key: 'combo2IconCount', label: 'C2 İkon Sayısı', type: 'select', editorTab: 'content', options: [
      { value: '1', label: '1 ikon' },
      { value: '2', label: '2 ikon' },
      { value: '3', label: '3 ikon' },
    ] },
    { key: 'combo2Icon1', label: 'C2 İkon 1', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo2Icon2', label: 'C2 İkon 2', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo2Icon3', label: 'C2 İkon 3', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo2ImageUrl', label: 'C2 Görsel', type: 'url', editorTab: 'content', placeholder: 'https://.../combo.png' },
    { key: 'combo2Price', label: 'Combo 2 Fiyat', type: 'text', editorTab: 'content', placeholder: '145' },
    { key: 'combo2OldPrice', label: 'Combo 2 Eski Fiyat', type: 'text', editorTab: 'content', placeholder: '180' },
    { key: 'combo3Title', label: 'Combo 3', type: 'text', editorTab: 'content', placeholder: 'Cheesecake + Filtre Kahve' },
    { key: 'combo3Badge', label: 'Combo 3 İndirim', type: 'text', editorTab: 'content', placeholder: '-15%' },
    { key: 'combo3RibbonTop', label: 'C3 Ribbon Üst', type: 'text', editorTab: 'content', placeholder: 'TATLI' },
    { key: 'combo3RibbonBottom', label: 'C3 Ribbon Alt', type: 'text', editorTab: 'content', placeholder: 'COMBO' },
    { key: 'combo3IconCount', label: 'C3 İkon Sayısı', type: 'select', editorTab: 'content', options: [
      { value: '1', label: '1 ikon' },
      { value: '2', label: '2 ikon' },
      { value: '3', label: '3 ikon' },
    ] },
    { key: 'combo3Icon1', label: 'C3 İkon 1', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo3Icon2', label: 'C3 İkon 2', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo3Icon3', label: 'C3 İkon 3', type: 'select', editorTab: 'content', options: FOOD_ICON_OPTIONS },
    { key: 'combo3ImageUrl', label: 'C3 Görsel', type: 'url', editorTab: 'content', placeholder: 'https://.../combo.png' },
    { key: 'combo3Price', label: 'Combo 3 Fiyat', type: 'text', editorTab: 'content', placeholder: '165' },
    { key: 'combo3OldPrice', label: 'Combo 3 Eski Fiyat', type: 'text', editorTab: 'content', placeholder: '195' },
    { key: 'cta', label: 'Buton', type: 'text', editorTab: 'content', placeholder: 'Ekle' },
    { key: 'targetType', label: 'Aksiyon', type: 'select', editorTab: 'content', options: [
      { value: 'none', label: 'Aksiyon yok' },
      { value: 'category', label: 'Kategoriye git' },
      { value: 'product', label: 'Ürüne git' },
      { value: 'cart', label: 'Sepete yönlendir' },
      { value: 'link', label: 'Dış link' },
    ] },
    { key: 'targetId', label: 'Hedef ID', type: 'text', editorTab: 'content', placeholder: 'kategori veya ürün ID' },
    { key: 'targetUrl', label: 'Link', type: 'url', editorTab: 'content', placeholder: 'https://...' },
    { key: 'bgColor', label: 'Arka Plan', type: 'color', editorTab: 'design', placeholder: '#fff3a8' },
    { key: 'accentColor', label: 'Vurgu', type: 'color', editorTab: 'design', placeholder: '#ffd089' },
    { key: 'combo1Color', label: 'C1 Kart Rengi', type: 'color', editorTab: 'design', placeholder: '#1cb6a8' },
    { key: 'combo1RibbonBg', label: 'C1 Ribbon BG', type: 'color', editorTab: 'design', placeholder: '#ff3b1c' },
    { key: 'combo1RibbonText', label: 'C1 Ribbon Yazı', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'combo2Color', label: 'C2 Kart Rengi', type: 'color', editorTab: 'design', placeholder: '#ff3b1c' },
    { key: 'combo2RibbonBg', label: 'C2 Ribbon BG', type: 'color', editorTab: 'design', placeholder: '#ffc91a' },
    { key: 'combo2RibbonText', label: 'C2 Ribbon Yazı', type: 'color', editorTab: 'design', placeholder: '#1c1d20' },
    { key: 'combo3Color', label: 'C3 Kart Rengi', type: 'color', editorTab: 'design', placeholder: '#ffc91a' },
    { key: 'combo3RibbonBg', label: 'C3 Ribbon BG', type: 'color', editorTab: 'design', placeholder: '#ff3b1c' },
    { key: 'combo3RibbonText', label: 'C3 Ribbon Yazı', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'buttonBg', label: 'Buton BG', type: 'color', editorTab: 'design', placeholder: '#1c1d20' },
    { key: 'buttonText', label: 'Buton Yazı', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'radius', label: 'Köşe', type: 'range', editorTab: 'layout', min: 8, max: 28, step: 1, unit: 'px' },
    { key: 'cardGap', label: 'Kart Arası', type: 'range', editorTab: 'layout', min: 8, max: 24, step: 1, unit: 'px' },
    { key: 'cardPadding', label: 'Kart İçi', type: 'range', editorTab: 'layout', min: 10, max: 22, step: 1, unit: 'px' },
    { key: 'imageSize', label: 'Görsel Boyutu', type: 'range', editorTab: 'layout', min: 34, max: 76, step: 2, unit: 'px' },
  ],
  'discount-badge': [
    { key: 'eyebrow', label: 'Etiket', type: 'text', editorTab: 'content', placeholder: 'SINIRLI SÜRE' },
    { key: 'title', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: '2 al 1 öde' },
    { key: 'body', label: 'Açıklama', type: 'textarea', editorTab: 'content', placeholder: 'Seçili kahvelerde masaya özel kampanya.' },
    { key: 'offer', label: 'Rozet', type: 'text', editorTab: 'content', placeholder: '2x1' },
    { key: 'productIcon', label: 'Ürün İkonu', type: 'text', editorTab: 'content', placeholder: '🌭' },
    { key: 'cta', label: 'Buton', type: 'text', editorTab: 'content', placeholder: 'Fırsatı kullan' },
    { key: 'targetType', label: 'Aksiyon', type: 'select', editorTab: 'content', options: [
      { value: 'none', label: 'Aksiyon yok' },
      { value: 'category', label: 'Kategoriye git' },
      { value: 'product', label: 'Ürüne git' },
      { value: 'cart', label: 'Sepete yönlendir' },
      { value: 'link', label: 'Dış link' },
    ] },
    { key: 'targetId', label: 'Hedef ID', type: 'text', editorTab: 'content', placeholder: 'kategori veya ürün ID' },
    { key: 'targetUrl', label: 'Link', type: 'url', editorTab: 'content', placeholder: 'https://...' },
    { key: 'bgColor', label: 'Arka Plan', type: 'color', editorTab: 'design', placeholder: '#d7f65a' },
    { key: 'textColor', label: 'Yazı', type: 'color', editorTab: 'design', placeholder: '#1d2a10' },
    { key: 'accentColor', label: 'Vurgu', type: 'color', editorTab: 'design', placeholder: '#111111' },
    { key: 'height', label: 'Yükseklik', type: 'range', editorTab: 'layout', min: 120, max: 240, step: 4, unit: 'px' },
    { key: 'radius', label: 'Köşe', type: 'range', editorTab: 'layout', min: 8, max: 32, step: 1, unit: 'px' },
  ],
  'daily-special': [
    { key: 'productId', label: 'Ürün', type: 'product-select', editorTab: 'content', placeholder: 'Ürün seç…' },
    { key: 'eyebrow', label: 'Etiket', type: 'text', editorTab: 'content', placeholder: 'GÜNÜN ÖZELİ' },
    { key: 'title', label: 'Başlık (opsiyonel)', type: 'text', editorTab: 'content', placeholder: 'Ürün adından otomatik' },
    { key: 'body', label: 'Açıklama (opsiyonel)', type: 'textarea', editorTab: 'content', placeholder: 'Ürün açıklamasından otomatik' },
    { key: 'chefNote', label: 'Şef Notu', type: 'text', editorTab: 'content', placeholder: '"Bugün en taze malzemeyle hazırladım." — Şef Murat' },
    { key: 'timer', label: 'Sayaç (HH:MM veya metin)', type: 'text', editorTab: 'content', placeholder: '18:00  ya da  ⏱ 4 saat kaldı' },
    { key: 'price', label: 'Fiyat (opsiyonel)', type: 'text', editorTab: 'content', placeholder: 'Ürün fiyatından otomatik' },
    { key: 'oldPrice', label: 'Eski Fiyat', type: 'text', editorTab: 'content', placeholder: '195' },
    { key: 'cta', label: 'Buton', type: 'text', editorTab: 'content', placeholder: 'Sepete ekle' },
    { key: 'targetType', label: 'Aksiyon', type: 'select', editorTab: 'content', options: [
      { value: 'none', label: 'Aksiyon yok' },
      { value: 'category', label: 'Kategoriye git' },
      { value: 'product', label: 'Ürüne git' },
      { value: 'cart', label: 'Sepete yönlendir' },
      { value: 'link', label: 'Dış link' },
    ] },
    { key: 'targetId', label: 'Hedef ID', type: 'text', editorTab: 'content', placeholder: 'kategori veya ürün ID' },
    { key: 'targetUrl', label: 'Link', type: 'url', editorTab: 'content', placeholder: 'https://...' },
    { key: 'imageUrl', label: 'Fotoğraf (opsiyonel)', type: 'url', editorTab: 'design', placeholder: 'https://.../special.jpg' },
    { key: 'accentColor', label: 'Vurgu Rengi', type: 'color', editorTab: 'design', placeholder: '#a13b7a' },
    { key: 'bgStart', label: 'Gradient Renk 1', type: 'color', editorTab: 'design', placeholder: '#f5d5a8' },
    { key: 'bgEnd', label: 'Gradient Renk 2', type: 'color', editorTab: 'design', placeholder: '#d97757' },
    { key: 'bgColor', label: 'Kart Zemini', type: 'color', editorTab: 'design', placeholder: '#fdf6ec' },
    { key: 'timerBg', label: 'Sayaç Zemin', type: 'color', editorTab: 'design', placeholder: '#000000' },
    { key: 'timerColor', label: 'Sayaç Metin', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'ribbonCorner', label: 'Şerit Köşe', type: 'select', editorTab: 'design', options: [
      { value: 'tl', label: '↖ Sol üst' },
      { value: 'tr', label: '↗ Sağ üst' },
    ] },
    { key: 'ribbonSize', label: 'Şerit Boyut', type: 'select', editorTab: 'design', options: [
      { value: 'sm', label: 'Küçük' },
      { value: 'md', label: 'Orta' },
      { value: 'lg', label: 'Büyük' },
    ] },
    { key: 'ribbonSpeed', label: 'Şerit Hızı', type: 'range', editorTab: 'design', min: 4, max: 16, step: 1, unit: 's' },
    { key: 'radius', label: 'Köşe', type: 'range', editorTab: 'layout', min: 8, max: 32, step: 1, unit: 'px' },
  ],
  'promo-slider': [
    { key: 'couponHeading', label: '1 · Kupon', type: 'heading', editorTab: 'content' },
    { key: 'couponEnabled', label: 'Aktif', type: 'toggle', editorTab: 'content' },
    { key: 'couponEyebrow', label: 'Etiket', type: 'text', editorTab: 'content', placeholder: 'İLK SİPARİŞE ÖZEL' },
    { key: 'couponTitle', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: '%25 İndirim' },
    { key: 'couponSubtitle', label: 'Alt Metin', type: 'text', editorTab: 'content', placeholder: '200₺ üzeri tüm siparişlerde geçerli' },
    { key: 'couponCode', label: 'Kupon Kodu', type: 'text', editorTab: 'content', placeholder: 'HOSGELDIN25' },
    { key: 'flashHeading', label: '2 · Flash Sayaç', type: 'heading', editorTab: 'content' },
    { key: 'flashEnabled', label: 'Aktif', type: 'toggle', editorTab: 'content' },
    { key: 'flashChip', label: 'Çip', type: 'text', editorTab: 'content', placeholder: '⚡ FLASH İNDİRİM' },
    { key: 'flashTitle', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: 'Tatlılarda' },
    { key: 'flashAccentText', label: 'Vurgu Metni', type: 'text', editorTab: 'content', placeholder: '2 al 1 öde' },
    { key: 'flashTimer', label: 'Sayaç (HH:MM)', type: 'text', editorTab: 'content', placeholder: '21:00' },
    { key: 'freebieHeading', label: '3 · Bedava Ürün', type: 'heading', editorTab: 'content' },
    { key: 'freebieEnabled', label: 'Aktif', type: 'toggle', editorTab: 'content' },
    { key: 'freebieLabel', label: 'Üst Etiket', type: 'text', editorTab: 'content', placeholder: 'Bugüne özel' },
    { key: 'freebieTitle', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: 'Kahvenin yanında kurabiye bedava' },
    { key: 'freebieSubtitle', label: 'Alt Metin', type: 'text', editorTab: 'content', placeholder: 'Her sıcak kahve siparişinde 🍪' },
    { key: 'freebieEmoji', label: 'Emoji', type: 'text', editorTab: 'content', placeholder: '🎁' },
    { key: 'freebieCtaText', label: 'Buton', type: 'text', editorTab: 'content', placeholder: 'Menüye git →' },
    { key: 'freebieCategoryId', label: 'Hedef Kategori', type: 'category-select', editorTab: 'content', placeholder: 'Kategori seç…' },
    { key: 'loyaltyHeading', label: '4 · Sadakat Kartı', type: 'heading', editorTab: 'content' },
    { key: 'loyaltyEnabled', label: 'Aktif', type: 'toggle', editorTab: 'content' },
    { key: 'loyaltyTitle', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: '10. kahve bizden ☕' },
    { key: 'loyaltyFilled', label: 'Dolu Damga', type: 'range', editorTab: 'content', min: 0, max: 20, step: 1 },
    { key: 'loyaltyTotal', label: 'Toplam Damga', type: 'range', editorTab: 'content', min: 1, max: 20, step: 1 },
    { key: 'comboHeading', label: '5 · Combo', type: 'heading', editorTab: 'content' },
    { key: 'comboEnabled', label: 'Aktif', type: 'toggle', editorTab: 'content' },
    { key: 'comboTitle', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: 'İkili Burger Menü' },
    { key: 'comboSubtitle', label: 'Alt Metin', type: 'text', editorTab: 'content', placeholder: '2 Burger + 2 Patates + 2 İçecek' },
    { key: 'comboEmoji', label: 'Emoji', type: 'text', editorTab: 'content', placeholder: '🍔🍟' },
    { key: 'comboImageUrl', label: 'Görsel (opsiyonel)', type: 'url', editorTab: 'content', placeholder: 'https://...' },
    { key: 'comboPrice', label: 'Fiyat', type: 'text', editorTab: 'content', placeholder: '349' },
    { key: 'comboOldPrice', label: 'Eski Fiyat', type: 'text', editorTab: 'content', placeholder: '480' },
    { key: 'indicator', label: 'Gösterge', type: 'select', editorTab: 'design', options: [
      { value: 'dots', label: '⦿ Noktalı' },
      { value: 'bars', label: '▬ Çubuklu' },
    ] },
    { key: 'couponBgStart', label: 'Kupon Gradient 1', type: 'color', editorTab: 'design', placeholder: '#a13b7a' },
    { key: 'couponBgEnd', label: 'Kupon Gradient 2', type: 'color', editorTab: 'design', placeholder: '#d4477f' },
    { key: 'autoplay', label: 'Otomatik oynat', type: 'toggle', editorTab: 'layout' },
    { key: 'interval', label: 'Geçiş Süresi', type: 'range', editorTab: 'layout', min: 2000, max: 6000, step: 200, unit: 'ms' },
    { key: 'radius', label: 'Köşe', type: 'range', editorTab: 'layout', min: 8, max: 28, step: 1, unit: 'px' },
  ],
  gallery: [
    { key: 'title', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: 'Mekandan Kareler' },
    { key: 'body', label: 'Alt Metin / Instagram', type: 'text', editorTab: 'content', placeholder: '@mafcafelounge · Instagram\'da paylaş' },
    { key: 'tile1Label', label: 'Kare 1 Etiket', type: 'text', editorTab: 'content', placeholder: 'İç mekan' },
    { key: 'tile2Label', label: 'Kare 2 Etiket', type: 'text', editorTab: 'content', placeholder: '' },
    { key: 'tile3Label', label: 'Kare 3 Etiket', type: 'text', editorTab: 'content', placeholder: '' },
    { key: 'tile4Label', label: 'Kare 4 Etiket', type: 'text', editorTab: 'content', placeholder: '' },
    { key: 'tile5Label', label: 'Kare 5 Etiket', type: 'text', editorTab: 'content', placeholder: '' },
    { key: 'tile6Label', label: 'Kare 6 Etiket', type: 'text', editorTab: 'content', placeholder: '' },
    { key: 'targetType', label: '"Hepsi" Aksiyon', type: 'select', editorTab: 'content', options: [
      { value: 'none', label: 'Aksiyon yok' },
      { value: 'link', label: 'Dış link (Instagram vb.)' },
    ] },
    { key: 'targetUrl', label: '"Hepsi" Link', type: 'url', editorTab: 'content', placeholder: 'https://instagram.com/...' },
    { key: 'tile1Image', label: 'Kare 1', type: 'url', editorTab: 'design', placeholder: 'https://...' },
    { key: 'tile2Image', label: 'Kare 2', type: 'url', editorTab: 'design', placeholder: 'https://...' },
    { key: 'tile3Image', label: 'Kare 3', type: 'url', editorTab: 'design', placeholder: 'https://...' },
    { key: 'tile4Image', label: 'Kare 4', type: 'url', editorTab: 'design', placeholder: 'https://...' },
    { key: 'tile5Image', label: 'Kare 5', type: 'url', editorTab: 'design', placeholder: 'https://...' },
    { key: 'tile6Image', label: 'Kare 6', type: 'url', editorTab: 'design', placeholder: 'https://...' },
    { key: 'accentColor', label: 'Başlık Rengi', type: 'color', editorTab: 'design', placeholder: '#a13b7a' },
    { key: 'radius', label: 'Köşe', type: 'range', editorTab: 'layout', min: 0, max: 28, step: 1, unit: 'px' },
  ],
  'chef-pick': [
    { key: 'eyebrow', label: 'Etiket', type: 'text', editorTab: 'content', placeholder: "ŞEF'İN SEÇİMİ" },
    { key: 'title', label: 'Şef Adı', type: 'text', editorTab: 'content', placeholder: 'Şef Murat Demir' },
    { key: 'body', label: 'Açıklama', type: 'textarea', editorTab: 'content', placeholder: '20 yıllık mutfak tecrübesi' },
    { key: 'dish1Name', label: 'Ürün 1', type: 'text', editorTab: 'content', placeholder: 'Hünkar Beğendi' },
    { key: 'dish1Price', label: 'Fiyat 1', type: 'text', editorTab: 'content', placeholder: '280' },
    { key: 'dish2Name', label: 'Ürün 2', type: 'text', editorTab: 'content', placeholder: 'Kuzu Tandır' },
    { key: 'dish2Price', label: 'Fiyat 2', type: 'text', editorTab: 'content', placeholder: '420' },
    { key: 'dish3Name', label: 'Ürün 3', type: 'text', editorTab: 'content', placeholder: 'Levrek Buğulama' },
    { key: 'dish3Price', label: 'Fiyat 3', type: 'text', editorTab: 'content', placeholder: '360' },
    { key: 'bgColor', label: 'Arka Plan', type: 'color', editorTab: 'design', placeholder: '#1a1612' },
    { key: 'accentColor', label: 'Vurgu', type: 'color', editorTab: 'design', placeholder: '#ffd089' },
    { key: 'textColor', label: 'Yazı', type: 'color', editorTab: 'design', placeholder: '#ffffff' },
    { key: 'radius', label: 'Köşe', type: 'range', editorTab: 'layout', min: 8, max: 32, step: 1, unit: 'px' },
  ],
  default: [
    { key: 'title', label: 'Başlık', type: 'text', editorTab: 'content', placeholder: 'Bölüm başlığı' },
    { key: 'body', label: 'Açıklama', type: 'textarea', editorTab: 'content', placeholder: 'Kısa açıklama' },
  ],
}

function fontCssValue(fontName: string, isDisplay = false) {
  if (SYSTEM_FONTS.has(fontName)) return fontName
  return isDisplay ? `"${fontName}", cursive` : `"${fontName}", sans-serif`
}

function getFieldEditorTab(field: SettingField, groupId = ''): EditorTab {
  if (field.editorTab) return field.editorTab
  if (
    groupId === 'layout' ||
    field.id.includes('Layout') ||
    field.id.includes('layout') ||
    field.id.includes('Align') ||
    field.id.includes('align') ||
    field.id.includes('sticky') ||
    field.id.includes('Height') ||
    field.id.includes('cols') ||
    field.id.includes('gap') ||
    field.id.includes('pad') ||
    field.id.includes('sectionGap') ||
    field.themeField === 'cardLayout' ||
    field.themeField === 'cardImageAspect' ||
    field.themeField === 'catnavStyle' ||
    field.themeField === 'catnavVisualStyle' ||
    field.themeField === 'cartStyle'
  ) {
    return 'layout'
  }
  if (
    groupId === 'content' ||
    field.type === 'text' ||
    field.id.includes('Text') ||
    field.id.includes('Tagline') ||
    field.id.includes('Description') ||
    field.id.includes('Show') ||
    field.themeField === 'headerTagline' ||
    field.themeField === 'pageDescription' ||
    field.themeField === 'cartButtonText' ||
    field.themeField === 'cartEmptyText' ||
    field.themeField === 'announcementText' ||
    field.themeField === 'announcementEnabled' ||
    field.themeField === 'cardShowDesc' ||
    field.themeField === 'cardShowTag' ||
    field.themeField === 'cartShowBadge' ||
    field.themeField === 'headerShowSearch' ||
    field.themeField === 'headerShowLang' ||
    field.themeField === 'headerShowMenu' ||
    field.themeField === 'headerTableBadge'
  ) {
    return 'content'
  }
  return 'design'
}

function fieldToCSSValue(field: SettingField, value: unknown): string {
  const v = value as string | number | boolean
  if (field.type === 'color') return v as string
  if (field.type === 'range') return field.unit === 'px' ? `${v}px` : String(v)
  if (field.type === 'font') {
    const isDisplay = field.id.includes('display') || field.id.includes('Display')
    return fontCssValue(v as string, isDisplay)
  }
  return String(v)
}

function pageBlockKey(block: PageBlock) {
  return `${block.type}:${block.id}`
}

function buildPageBlocks(theme: Partial<GarsonlessTheme>, menuCategories: Array<{ id: string; name: string; parentId?: string | null }>): PageBlock[] {
  const categoryIds = new Set(menuCategories.map((category) => category.id))
  const sectionIds = new Set<string>(SECTION_LIBRARY.map((section) => section.id))
  const stored = (theme.pageBlocks ?? []).filter((block) =>
    block.type === 'category'
      ? categoryIds.has(block.id)
      : block.type === 'nav'
        ? block.id === 'category-nav'
        : sectionIds.has(block.id),
  )
  const legacySections = (theme.sections ?? []).filter((id) => sectionIds.has(id))
  const base = stored.length > 0
    ? stored
    : [
        { type: 'nav' as const, id: 'category-nav' },
        ...legacySections.map((id) => ({ type: 'section' as const, id })),
        ...menuCategories.map((category) => ({ type: 'category' as const, id: category.id })),
      ]
  const seen = new Set<string>()
  const unique = base.filter((block) => {
    const key = pageBlockKey(block)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  if (!seen.has('nav:category-nav')) {
    unique.unshift({ type: 'nav', id: 'category-nav' })
    seen.add('nav:category-nav')
  }

  for (const category of menuCategories) {
    const key = `category:${category.id}`
    if (!seen.has(key)) {
      unique.push({ type: 'category', id: category.id })
      seen.add(key)
    }
  }

  return unique
}

function getCategoryParentId(menuCategories: Array<{ id: string; parentId?: string | null }>, categoryId: string) {
  return menuCategories.find((category) => category.id === categoryId)?.parentId ?? null
}

function normalizePageBlocksForCategoryScope(
  blocks: PageBlock[],
  menuCategories: Array<{ id: string; name: string; parentId?: string | null }>,
) {
  const childIds = new Set(menuCategories.filter((category) => category.parentId).map((category) => category.id))
  const childrenByParent = new Map<string, PageBlock[]>()
  const childBlockById = new Map(blocks.filter((block) => block.type === 'category' && childIds.has(block.id)).map((block) => [block.id, block]))

  for (const block of blocks) {
    if (block.type !== 'category' || !childIds.has(block.id)) continue
    const parentId = getCategoryParentId(menuCategories, block.id)
    if (!parentId) continue
    const bucket = childrenByParent.get(parentId) ?? []
    bucket.push(block)
    childrenByParent.set(parentId, bucket)
  }

  const next: PageBlock[] = []
  const appended = new Set<string>()
  for (const block of blocks) {
    if (block.type === 'category' && childIds.has(block.id)) continue
    next.push(block)
    if (block.type === 'category') {
      for (const child of childrenByParent.get(block.id) ?? []) {
        next.push(child)
        appended.add(child.id)
      }
    }
  }

  for (const [id, child] of childBlockById.entries()) {
    if (!appended.has(id)) next.push(child)
  }
  return next
}

const GALLERY_TILES: Array<{ key: string; label: string; span: 1 | 2 }> = [
  { key: 'tile1Image', label: '1', span: 2 },
  { key: 'tile2Image', label: '2', span: 1 },
  { key: 'tile3Image', label: '3', span: 1 },
  { key: 'tile4Image', label: '4', span: 1 },
  { key: 'tile5Image', label: '5', span: 1 },
  { key: 'tile6Image', label: '6', span: 1 },
]

function GalleryUploadPanel({
  restaurantId,
  values,
  onChange,
}: {
  restaurantId: string
  values: Record<string, string>
  onChange: (key: string, value: string) => void
}) {
  const [uploading, setUploading] = useState<string | null>(null)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  async function handleTileUpload(tileKey: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(tileKey)
    const supabase = createDashboardBrowserClient()
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `restaurants/${restaurantId}/gallery/${tileKey}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('restaurant-assets')
      .upload(path, file, { upsert: true })
    if (!error) {
      const { data } = supabase.storage.from('restaurant-assets').getPublicUrl(path)
      onChange(tileKey, data.publicUrl)
    }
    setUploading(null)
  }

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridAutoRows: 64, gap: 6, marginBottom: 8 }}>
        {GALLERY_TILES.map((tile) => {
          const imgUrl = values[tile.key] ?? ''
          const isLoading = uploading === tile.key
          return (
            <div
              key={tile.key}
              style={{
                gridColumn: tile.span === 2 ? 'span 2' : 'auto',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                background: imgUrl ? 'transparent' : 'var(--surface-3)',
                border: `1.5px dashed ${imgUrl ? 'transparent' : 'var(--border)'}`,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={() => !isLoading && fileRefs.current[tile.key]?.click()}
            >
              <input
                ref={(el) => { fileRefs.current[tile.key] = el }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleTileUpload(tile.key, e)}
              />
              {imgUrl ? (
                <>
                  <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onChange(tile.key, '') }}
                    style={{
                      position: 'absolute', top: 3, right: 3,
                      width: 18, height: 18, borderRadius: 99,
                      background: 'rgba(0,0,0,.55)', color: '#fff',
                      border: 'none', cursor: 'pointer', fontSize: 9, fontWeight: 900,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                    }}
                  >✕</button>
                </>
              ) : isLoading ? (
                <span style={{ fontSize: 10, color: 'var(--text-3)' }}>…</span>
              ) : (
                <span style={{ fontSize: 18, color: 'var(--text-3)', lineHeight: 1 }}>+</span>
              )}
            </div>
          )
        })}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', lineHeight: 1.4 }}>
        Her kareye tıklayarak fotoğraf yükle · JPG, PNG, WEBP
      </p>
    </div>
  )
}

export default function ThemeEditorClient({
  restaurantId,
  restaurantSlug,
  restaurantName,
  restaurantLogoUrl,
  templateId,
  initialTheme,
  menuCategories,
  menuItems,
}: Props) {
  const router = useRouter()
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const entry = THEME_REGISTRY[templateId] ?? THEME_REGISTRY['default']!
  const schema: SettingsGroup[] = entry.SETTINGS_SCHEMA

  const [overrides, setOverrides] = useState<Partial<GarsonlessTheme>>(() => {
    const defaults = entry.THEME_DEFAULTS
    const patch: Partial<GarsonlessTheme> = {}
    schema.forEach((g) => {
      g.fields.forEach((f) => {
        const saved = initialTheme[f.themeField as keyof GarsonlessTheme]
        const def = defaults[f.themeField as keyof GarsonlessTheme]
        if (saved !== undefined && saved !== def) {
          ;(patch as Record<string, unknown>)[f.themeField] = saved
        }
      })
    })
    if (initialTheme.sections?.length) patch.sections = initialTheme.sections
    if (initialTheme.pageBlocks?.length) patch.pageBlocks = initialTheme.pageBlocks
    if (initialTheme.sectionSettings && Object.keys(initialTheme.sectionSettings).length > 0) {
      patch.sectionSettings = initialTheme.sectionSettings
    }
    return patch
  })

  const [activeGroup, setActiveGroup] = useState(() =>
    schema.some((group) => THEME_GROUP_SOURCE_IDS.has(group.id)) ? THEME_GROUP_ID : schema[0]?.id ?? '',
  )
  const [activeEditorTab, setActiveEditorTab] = useState<EditorTab>('design')
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false)
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null)
  const [sectionPickerOpen, setSectionPickerOpen] = useState(false)
  const [sectionSearch, setSectionSearch] = useState('')
  const [editorSearch, setEditorSearch] = useState('')
  const [sectionGroup, setSectionGroup] = useState<(typeof SECTION_GROUPS)[number]>('Tümü')
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null)
  const [dragBlockKey, setDragBlockKey] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [previewMode, setPreviewMode] = useState<'mobile' | 'desktop'>('mobile')
  const [previewScale, setPreviewScale] = useState(1)
  const [undoStack, setUndoStack] = useState<Array<Partial<GarsonlessTheme>>>([])
  const [redoStack, setRedoStack] = useState<Array<Partial<GarsonlessTheme>>>([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(restaurantLogoUrl)
  const [logoUploading, setLogoUploading] = useState(false)
  const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('preparing')
  const revisionRef = useRef(0)
  const previewRequestRef = useRef(0)
  const pendingPreviewRequestRef = useRef<string | null>(null)
  const previewFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const templateTriggerRef = useRef<HTMLButtonElement>(null)
  const sectionTriggerRef = useRef<HTMLButtonElement>(null)
  const templateCloseRef = useRef<HTMLButtonElement>(null)
  const sectionCloseRef = useRef<HTMLButtonElement>(null)
  const lastFocusedBeforeDialogRef = useRef<HTMLElement | null>(null)

  const mergedTheme = useMemo(
    () => ({ ...entry.THEME_DEFAULTS, ...overrides }) as GarsonlessTheme,
    [entry.THEME_DEFAULTS, overrides],
  )
  const pageBlocks = useMemo(
    () => normalizePageBlocksForCategoryScope(buildPageBlocks(mergedTheme, menuCategories), menuCategories),
    [mergedTheme, menuCategories],
  )
  const previewTheme = useMemo(
    () => ({
      ...mergedTheme,
      pageBlocks,
      sections: pageBlocks.filter((block) => block.type === 'section').map((block) => block.id),
    }) as GarsonlessTheme,
    [mergedTheme, pageBlocks],
  )
  const activeSections = useMemo(
    () => pageBlocks.filter((block) => block.type === 'section').map((block) => block.id),
    [pageBlocks],
  )
  const editorQuery = editorSearch.trim().toLocaleLowerCase('tr')
  const templateEntries = Object.values(THEME_REGISTRY).sort((a, b) => {
    if (a.id === templateId) return -1
    if (b.id === templateId) return 1
    return 0
  })

  function flashToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(''), 2500)
  }

  const clearPreviewFallback = useCallback(() => {
    if (previewFallbackTimerRef.current) {
      clearTimeout(previewFallbackTimerRef.current)
      previewFallbackTimerRef.current = null
    }
  }, [])

  const armPreviewFallback = useCallback(() => {
    clearPreviewFallback()
    previewFallbackTimerRef.current = setTimeout(() => {
      previewFallbackTimerRef.current = null
      pendingPreviewRequestRef.current = null
      setPreviewStatus((current) => current === 'preparing' ? 'degraded' : current)
    }, PREVIEW_FALLBACK_MS)
  }, [clearPreviewFallback])

  function reloadPreviewFrame() {
    const iframe = iframeRef.current
    if (!iframe) return
    setPreviewStatus('preparing')
    pendingPreviewRequestRef.current = null
    armPreviewFallback()
    const currentSrc = iframe.src
    iframe.src = currentSrc
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setLogoUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const result = await uploadLogo(restaurantId, fd)
    setLogoUploading(false)
    if ('error' in result) {
      flashToast(`Logo yüklenemedi: ${result.error}`)
    } else {
      setLocalLogoUrl(result.url)
      flashToast('Logo güncellendi')
      reloadPreviewFrame()
    }
  }

  async function handleLogoRemove() {
    setLogoUploading(true)
    const result = await removeLogo(restaurantId)
    setLogoUploading(false)
    if ('error' in result) {
      flashToast(`Logo kaldırılamadı: ${result.error}`)
    } else {
      setLocalLogoUrl(null)
      flashToast('Logo kaldırıldı')
      reloadPreviewFrame()
    }
  }

  function closeTemplatePicker() {
    setTemplatePickerOpen(false)
    requestAnimationFrame(() => {
      ;(lastFocusedBeforeDialogRef.current ?? templateTriggerRef.current)?.focus()
    })
  }

  function openSectionPicker() {
    lastFocusedBeforeDialogRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setSectionPickerOpen(true)
  }

  function closeSectionPicker() {
    setSectionPickerOpen(false)
    requestAnimationFrame(() => {
      ;(lastFocusedBeforeDialogRef.current ?? sectionTriggerRef.current)?.focus()
    })
  }

  const markDirty = useCallback(() => {
    revisionRef.current += 1
    setHasUnsavedChanges(true)
  }, [])

  const { setNavigationGuard } = useShell()

  useEffect(() => {
    if (!hasUnsavedChanges) return
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [hasUnsavedChanges])

  useEffect(() => {
    setNavigationGuard(
      hasUnsavedChanges
        ? 'Kaydedilmemiş değişiklikler var. Çıkmak istediğine emin misin?'
        : null,
    )
    return () => setNavigationGuard(null)
  }, [hasUnsavedChanges, setNavigationGuard])

  async function handleTemplateSelect(nextTemplateId: string) {
    if (activatingTemplateId) return
    if (nextTemplateId === templateId) {
      closeTemplatePicker()
      return
    }

    setActivatingTemplateId(nextTemplateId)
    const result = await saveActiveTemplate(restaurantId, nextTemplateId)
    setActivatingTemplateId(null)

    if ('error' in result) {
      flashToast(`Hata: ${result.error}`)
      return
    }

    closeTemplatePicker()
    router.push(`/dashboard/${restaurantId}/theme/${nextTemplateId}/edit`)
    router.refresh()
  }

  const menuBaseUrl = process.env.NEXT_PUBLIC_MENU_URL ?? 'http://localhost:3011'
  const previewUrl = `${menuBaseUrl.replace(/\/$/, '')}/${encodeURIComponent(restaurantSlug)}?preview=1&template=${encodeURIComponent(templateId)}`
  const previewOrigin = getMessageTargetOrigin(previewUrl)

  const postPreviewMessage = useCallback((message: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(message, previewOrigin)
  }, [previewOrigin])

  const sendFullTheme = useCallback((requestId?: string) => {
    postPreviewMessage({ type: 'FULL_THEME_UPDATE', theme: previewTheme, requestId })
  }, [postPreviewMessage, previewTheme])

  useEffect(() => {
    setPreviewStatus('preparing')
    pendingPreviewRequestRef.current = null
    armPreviewFallback()
    return clearPreviewFallback
  }, [armPreviewFallback, clearPreviewFallback, previewUrl])

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return
      if (previewOrigin !== '*' && e.origin !== previewOrigin) return
      const data = e.data as { type?: string; requestId?: string }
      if (data.type === 'PREVIEW_READY') {
        const requestId = `theme-preview-${++previewRequestRef.current}`
        pendingPreviewRequestRef.current = requestId
        setPreviewStatus('preparing')
        armPreviewFallback()
        sendFullTheme(requestId)
      }
      if (
        data.type === 'THEME_APPLIED' &&
        data.requestId === pendingPreviewRequestRef.current
      ) {
        pendingPreviewRequestRef.current = null
        clearPreviewFallback()
        setPreviewStatus('ready')
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [armPreviewFallback, clearPreviewFallback, previewOrigin, sendFullTheme])

  useEffect(() => {
    if (!templatePickerOpen && !sectionPickerOpen) return
    const closeRef = templatePickerOpen ? templateCloseRef : sectionCloseRef
    requestAnimationFrame(() => closeRef.current?.focus())
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (templatePickerOpen) closeTemplatePicker()
      if (sectionPickerOpen) closeSectionPicker()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [sectionPickerOpen, templatePickerOpen])

  const rememberOverrides = useCallback((snapshot: Partial<GarsonlessTheme>) => {
    setUndoStack((prev) => [...prev.slice(-24), snapshot])
    setRedoStack([])
  }, [])

  const applyOverridesSnapshot = useCallback((snapshot: Partial<GarsonlessTheme>) => {
    setOverrides(snapshot)
    const nextMerged = { ...entry.THEME_DEFAULTS, ...snapshot } as GarsonlessTheme
    const nextPageBlocks = normalizePageBlocksForCategoryScope(buildPageBlocks(nextMerged, menuCategories), menuCategories)
    const nextTheme = {
      ...nextMerged,
      pageBlocks: nextPageBlocks,
      sections: nextPageBlocks.filter((block) => block.type === 'section').map((block) => block.id),
    } as GarsonlessTheme
    markDirty()
    postPreviewMessage({ type: 'FULL_THEME_UPDATE', theme: nextTheme })
  }, [entry.THEME_DEFAULTS, markDirty, menuCategories, postPreviewMessage])

  const handleUndo = useCallback(() => {
    setUndoStack((prev) => {
      const previous = prev[prev.length - 1]
      if (!previous) return prev
      setRedoStack((redo) => [...redo.slice(-24), overrides])
      applyOverridesSnapshot(previous)
      flashToast('Geri alındı')
      return prev.slice(0, -1)
    })
  }, [applyOverridesSnapshot, overrides])

  const handleRedo = useCallback(() => {
    setRedoStack((prev) => {
      const next = prev[prev.length - 1]
      if (!next) return prev
      setUndoStack((undo) => [...undo.slice(-24), overrides])
      applyOverridesSnapshot(next)
      flashToast('Yeniden uygulandı')
      return prev.slice(0, -1)
    })
  }, [applyOverridesSnapshot, overrides])

  const handleFieldChange = useCallback((field: SettingField, value: unknown) => {
    const updated = { ...previewTheme, [field.themeField]: value } as GarsonlessTheme
    rememberOverrides(overrides)
    markDirty()
    setOverrides((prev) => ({ ...prev, [field.themeField]: value }))

    if (field.cssVar) {
      const cssValue = fieldToCSSValue(field, value)
      postPreviewMessage({ type: 'CSS_VARS_UPDATE', vars: { [field.cssVar]: cssValue } })
    }

    postPreviewMessage({ type: 'FULL_THEME_UPDATE', theme: updated })
  }, [markDirty, overrides, postPreviewMessage, previewTheme, rememberOverrides])

  const updateThemePatch = useCallback((patch: Partial<GarsonlessTheme>) => {
    const updated = { ...previewTheme, ...patch } as GarsonlessTheme
    rememberOverrides(overrides)
    markDirty()
    setOverrides((prev) => ({ ...prev, ...patch }))
    postPreviewMessage({ type: 'FULL_THEME_UPDATE', theme: updated })
  }, [markDirty, overrides, postPreviewMessage, previewTheme, rememberOverrides])

  function handleAddSection(sectionId: string) {
    if (activeSections.includes(sectionId)) {
      setSectionPickerOpen(false)
      setSelectedSectionId(sectionId)
      return
    }
    const nextSections = [...activeSections, sectionId]
    updateThemePatch({
      sections: nextSections,
      pageBlocks: [...pageBlocks, { type: 'section', id: sectionId }],
    })
    setSectionPickerOpen(false)
    setActiveEditorTab('content')
    setSelectedSectionId(sectionId)
  }

  function handleRemoveSection(sectionId: string) {
    const nextSettings = { ...(mergedTheme.sectionSettings ?? {}) }
    delete nextSettings[sectionId]
    updateThemePatch({
      sections: activeSections.filter((id) => id !== sectionId),
      pageBlocks: pageBlocks.filter((block) => !(block.type === 'section' && block.id === sectionId)),
      sectionSettings: nextSettings,
    })
    if (selectedSectionId === sectionId) setSelectedSectionId(null)
  }

  const hasDailySpecial = activeSections.includes('daily-special')
  const dailySpecialTimer = (mergedTheme.sectionSettings?.['daily-special']?.['timer'] as string | undefined) ?? ''

  useEffect(() => {
    if (!hasDailySpecial) return
    const m = dailySpecialTimer.match(/^(\d{1,2}):(\d{2})$/)
    if (!m) return
    const isExpired = () => {
      const t = new Date()
      t.setHours(Number(m[1]), Number(m[2]), 0, 0)
      return t.getTime() - Date.now() <= 0
    }
    if (isExpired()) { handleRemoveSection('daily-special'); return }
    const id = setInterval(() => { if (isExpired()) handleRemoveSection('daily-special') }, 1_000)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDailySpecial, dailySpecialTimer])

  function handleSectionSettingChange(sectionId: string, key: string, value: string) {
    const currentSettings = mergedTheme.sectionSettings?.[sectionId] ?? {}
    const nextSettings = { ...currentSettings, [key]: value }
    if (key === 'targetType') {
      nextSettings['targetId'] = ''
      nextSettings['targetUrl'] = ''
    }
    updateThemePatch({
      sectionSettings: {
        ...(mergedTheme.sectionSettings ?? {}),
        [sectionId]: nextSettings,
      },
    })
  }

  function reorderPageBlock(sourceKey: string, targetKey: string) {
    if (sourceKey === targetKey) return
    const fromIndex = pageBlocks.findIndex((block) => pageBlockKey(block) === sourceKey)
    const toIndex = pageBlocks.findIndex((block) => pageBlockKey(block) === targetKey)
    if (fromIndex < 0 || toIndex < 0) return
    const movedBlock = pageBlocks[fromIndex]
    const targetBlock = pageBlocks[toIndex]
    if (!movedBlock || !targetBlock) return

    const movedParentId = movedBlock.type === 'category' ? getCategoryParentId(menuCategories, movedBlock.id) : null
    const targetParentId = targetBlock.type === 'category' ? getCategoryParentId(menuCategories, targetBlock.id) : null

    if (movedBlock.type === 'category' && movedParentId) {
      if (targetBlock.type !== 'category' || targetParentId !== movedParentId) {
        flashToast('Alt kategoriler yalnızca kendi üst kategorisi altında sıralanabilir')
        setDragBlockKey(null)
        return
      }
    }

    if (targetBlock.type === 'category' && targetParentId && !(movedBlock.type === 'category' && movedParentId === targetParentId)) {
      flashToast('Bu alan alt kategori kapsamı; üst öğeleri buraya taşıyamazsınız')
      setDragBlockKey(null)
      return
    }

    if (movedBlock.type === 'category' && !movedParentId) {
      const childIds = new Set(menuCategories.filter((category) => category.parentId === movedBlock.id).map((category) => category.id))
      const movingKeys = new Set([pageBlockKey(movedBlock), ...Array.from(childIds).map((id) => `category:${id}`)])
      const movingGroup = pageBlocks.filter((block) => movingKeys.has(pageBlockKey(block)))
      if (movingGroup.length > 1) {
        const withoutGroup = pageBlocks.filter((block) => !movingKeys.has(pageBlockKey(block)))
        const targetTopKey = targetBlock.type === 'category' && targetParentId ? `category:${targetParentId}` : pageBlockKey(targetBlock)
        const nextIndex = withoutGroup.findIndex((block) => pageBlockKey(block) === targetTopKey)
        if (nextIndex < 0) return
        withoutGroup.splice(nextIndex, 0, ...movingGroup)
        updateThemePatch({
          pageBlocks: withoutGroup,
          sections: withoutGroup.filter((block) => block.type === 'section').map((block) => block.id),
        })
        setDragBlockKey(null)
        return
      }
    }

    const nextBlocks = [...pageBlocks]
    const [moved] = nextBlocks.splice(fromIndex, 1)
    if (!moved) return
    nextBlocks.splice(toIndex, 0, moved)
    updateThemePatch({
      pageBlocks: nextBlocks,
      sections: nextBlocks.filter((block) => block.type === 'section').map((block) => block.id),
    })
    setDragBlockKey(null)
  }

  function handlePageBlockDrop(targetKey: string) {
    if (!dragBlockKey) return
    reorderPageBlock(dragBlockKey, targetKey)
  }

  function handlePageBlockKeyboardMove(sourceKey: string, direction: -1 | 1) {
    const currentIndex = pageBlocks.findIndex((block) => pageBlockKey(block) === sourceKey)
    const targetBlock = pageBlocks[currentIndex + direction]
    if (currentIndex < 0 || !targetBlock) return
    reorderPageBlock(sourceKey, pageBlockKey(targetBlock))
  }

  async function handleSave() {
    const savingRevision = revisionRef.current
    setSaving(true)
    const result = await saveTheme(restaurantId, previewTheme, templateId)
    if (!('error' in result)) {
      // Publishing makes this template live — keep active_template_id in sync
      // so the menu app and the editor agree on which tokens are current.
      await saveActiveTemplate(restaurantId, templateId)
    }
    setSaving(false)
    if ('error' in result) {
      setToast(`Hata: ${result.error}`)
    } else {
      const changedDuringSave = revisionRef.current !== savingRevision
      if (changedDuringSave) {
        setToast('Kaydedildi; son değişiklikler henüz yayınlanmadı')
      } else {
        setHasUnsavedChanges(false)
        setLastSavedAt(new Date())
        setToast('Kaydedildi')
      }
    }
    setTimeout(() => setToast(''), 2500)
  }

  const themeGroupData = buildThemeGroup(schema)
  const activeGroupData = activeGroup === THEME_GROUP_ID
    ? themeGroupData
    : schema.find((g) => g.id === activeGroup) ?? schema[0]
  const navGroups = buildEditorNav(schema, entry.name)
  const filteredNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: editorQuery
        ? group.items.filter((item) =>
            `${item.label} ${item.sub}`.toLocaleLowerCase('tr').includes(editorQuery),
          )
        : group.items,
    }))
    .filter((group) => group.items.length > 0)
  const activeFields = activeGroupData?.fields ?? []
  const selectedSection = selectedSectionId
    ? SECTION_LIBRARY.find((section) => section.id === selectedSectionId)
    : null
  const selectedSectionSettings = selectedSectionId
    ? (mergedTheme.sectionSettings?.[selectedSectionId] ?? {})
    : {}
  const selectedSectionFields = selectedSectionId
    ? (SECTION_SETTING_SCHEMA[selectedSectionId] ?? SECTION_SETTING_SCHEMA.default ?? [])
    : []
  const activeAvailableTabs = getAvailableEditorTabs(activeFields, activeGroupData?.id)
  const sectionAvailableTabs = getAvailableSectionTabs(selectedSectionFields)
  const visibleEditorTabs = selectedSection ? sectionAvailableTabs : activeAvailableTabs
  const effectiveEditorTab = visibleEditorTabs.some((tab) => tab.id === activeEditorTab)
    ? activeEditorTab
    : visibleEditorTabs[0]?.id ?? 'design'
  const visibleFields = activeFields.filter((field) => {
    const fieldKey = String(field.themeField)
    if (fieldKey.startsWith('catnavVisual') && mergedTheme.catnavStyle !== 'visual') return false
    if (fieldKey.startsWith('catnavOverlay') && (mergedTheme.catnavStyle !== 'visual' || mergedTheme.catnavVisualStyle !== 'overlay')) return false
    if (fieldKey === 'headerNameSize' && mergedTheme.headerLogoStyle === 'image') return false
    if ((fieldKey === 'headerLogoSize' || fieldKey === 'logoShape' || fieldKey === 'logoShadow' || fieldKey === 'logoBorder' || fieldKey === 'logoBg') && mergedTheme.headerLogoStyle !== 'image') return false
    return getFieldEditorTab(field, activeGroupData?.id) === effectiveEditorTab
  })
  const visibleSectionFields = selectedSectionFields.filter((field) => field.editorTab === effectiveEditorTab)
  const filteredSections = SECTION_LIBRARY.filter((section) => {
    const matchesGroup = sectionGroup === 'Tümü' || section.group === sectionGroup
    const q = sectionSearch.trim().toLocaleLowerCase('tr')
    const matchesSearch = !q || `${section.label} ${section.sub} ${section.group}`.toLocaleLowerCase('tr').includes(q)
    return matchesGroup && matchesSearch
  })
  const filteredPageBlocks = editorQuery
    ? pageBlocks.filter((block) => {
        const preset = block.type === 'section'
          ? SECTION_LIBRARY.find((item) => item.id === block.id)
          : null
        const category = block.type === 'category'
          ? menuCategories.find((item) => item.id === block.id)
          : null
        const label = block.type === 'nav'
          ? 'Kategori Menüsü Kaydırılabilir kategori navigasyonu'
          : block.type === 'section'
            ? `${preset?.label ?? block.id} ${preset?.sub ?? ''}`
            : `${category?.name ?? block.id} Menü kategorisi`
        return label.toLocaleLowerCase('tr').includes(editorQuery)
      })
    : pageBlocks

  function handleEditorTabChange(tab: EditorTab) {
    setActiveEditorTab(tab)
  }

  function handleZoom(delta: number) {
    setPreviewScale((value) => Math.min(1.4, Math.max(0.55, Math.round((value + delta) * 100) / 100)))
  }

  function handleFitPreview() {
    if (previewMode === 'desktop') {
      setPreviewScale(isNarrowEditor ? 0.58 : isCompactEditor ? 0.64 : 0.72)
      return
    }
    setPreviewScale(isNarrowEditor ? 0.68 : isCompactEditor ? 0.78 : 0.86)
  }

  function handleOpenPreview() {
    window.open(previewUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleCopyCurrentSettings() {
    const payload = selectedSectionId
      ? {
          type: 'section',
          id: selectedSectionId,
          settings: mergedTheme.sectionSettings?.[selectedSectionId] ?? {},
        }
      : {
          type: 'group',
          id: activeGroupData?.id ?? 'page',
          settings: Object.fromEntries(
            (activeGroupData?.fields ?? []).map((field) => [
              field.themeField,
              previewTheme[field.themeField as keyof GarsonlessTheme],
            ]),
          ),
        }

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
      flashToast('Ayarlar kopyalandı')
    } catch {
      flashToast('Kopyalama başarısız')
    }
  }

  function handleResetCurrentSettings() {
    if (selectedSectionId) {
      const nextSettings = { ...(mergedTheme.sectionSettings ?? {}) }
      delete nextSettings[selectedSectionId]
      updateThemePatch({ sectionSettings: nextSettings })
      flashToast('Bölüm ayarları sıfırlandı')
      return
    }

    if (!activeGroupData) return
    const patch: Partial<GarsonlessTheme> = {}
    for (const field of activeGroupData.fields) {
      ;(patch as Record<string, unknown>)[field.themeField] = entry.THEME_DEFAULTS[field.themeField as keyof GarsonlessTheme]
    }
    updateThemePatch(patch)
    flashToast('Panel ayarları sıfırlandı')
  }

  const canUndo = undoStack.length > 0
  const canRedo = redoStack.length > 0
  const viewportWidth = useViewportWidth()
  const isCompactEditor = viewportWidth > 0 && viewportWidth < 1320
  const isNarrowEditor = viewportWidth > 0 && viewportWidth < 1120
  const leftPanelWidth = isNarrowEditor ? 224 : 260
  const rightPanelWidth = isNarrowEditor ? 286 : isCompactEditor ? 300 : 320
  const showFullTopbarCopy = !isNarrowEditor
  const saveStatusText = saving
    ? 'Kaydediliyor'
    : hasUnsavedChanges
      ? 'Kaydedilmedi'
      : lastSavedAt
        ? `Kaydedildi ${formatTime(lastSavedAt)}`
        : 'Kaydedildi'
  const saveStatusColor = hasUnsavedChanges ? '#b86408' : 'var(--positive)'

  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background: 'var(--surface-inset)',
    }}>
      <div style={{
        minHeight: 52,
        flexShrink: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px 16px',
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--surface)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: showFullTopbarCopy ? 12 : 8, minWidth: 0, flex: '1 1 260px' }}>
          {/* Narrow topbar → compact m mark; wide → full wordmark (both real assets, light surface). */}
          {showFullTopbarCopy
            ? <img src="/brand/masabu-logo-transparent.svg" alt="Masabu" style={{ height: 18, width: 'auto', display: 'block', flexShrink: 0 }} />
            : <img src="/brand/masabu-m-favicon-transparent.svg" alt="Masabu" style={{ width: 26, height: 26, display: 'block', flexShrink: 0 }} />}
          {showFullTopbarCopy && <span style={{ color: 'var(--text-4)' }}>/</span>}
          <span style={{ color: 'var(--text-2)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {restaurantName}
          </span>
          {showFullTopbarCopy && <span style={{ color: 'var(--text-4)' }}>/</span>}
          <span style={{ fontWeight: 650, fontSize: 13, color: 'var(--text)' }}>Tema Düzenleyici</span>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--surface-3)',
          borderRadius: 9,
          padding: 3,
          gap: 2,
          flex: '0 0 auto',
        }}>
          <SegmentButton
            active={previewMode === 'mobile'}
            icon={<PhoneIcon />}
            label="Mobil"
            onClick={() => setPreviewMode('mobile')}
          />
          <SegmentButton
            active={previewMode === 'desktop'}
            icon={<DesktopIcon />}
            label="Masaüstü"
            onClick={() => setPreviewMode('desktop')}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', flex: '1 1 320px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--text-3)', fontSize: 12.5, whiteSpace: 'nowrap' }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: saveStatusColor }} />
            {saveStatusText}
          </span>
          <div style={{
            height: 34,
            display: 'inline-flex',
            alignItems: 'center',
            borderRight: '1px solid var(--border)',
            paddingRight: 10,
            gap: 2,
          }}>
            <IconButton
              title="Geri al"
              disabled={!canUndo}
              onClick={handleUndo}
            >
              <UndoIcon />
            </IconButton>
            <IconButton
              title="Yinele"
              disabled={!canRedo}
              onClick={handleRedo}
            >
              <RedoIcon />
            </IconButton>
            <IconButton
              title="Son değişikliği geri al"
              disabled={!canUndo}
              onClick={handleUndo}
            >
              <HistoryIcon />
            </IconButton>
          </div>
          <button type="button" onClick={handleOpenPreview} style={topbarButtonStyle}>
            <EyeIcon />
            {showFullTopbarCopy && 'Önizle'}
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 34, padding: '0 18px', borderRadius: 8,
              border: 'none', background: 'var(--text)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.65 : 1,
            }}
          >
            {saving ? 'Kaydediliyor...' : 'Yayınla'}
          </button>
        </div>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        overflowX: isNarrowEditor ? 'auto' : 'hidden',
        overflowY: 'hidden',
      }}>
        <aside style={{
          width: leftPanelWidth,
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '16px 16px 14px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>
                Tema Düzenleyici
              </div>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 11,
                fontWeight: 650,
                color: 'var(--positive)',
                background: 'var(--positive-bg)',
                borderRadius: 999,
                padding: '3px 8px',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--positive)' }} />
                Canlı
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>v2.4 · {entry.name}</div>
          </div>

          <div style={{ padding: '12px 12px 6px' }}>
            <div style={{
              height: 34,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '0 10px',
              background: 'var(--surface-3)',
              borderRadius: 8,
              color: 'var(--text-3)',
            }}>
              <SearchIcon />
              <input
                value={editorSearch}
                onChange={(e) => setEditorSearch(e.target.value)}
                placeholder="Bölümlerde ara"
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: 'var(--text)',
                  fontSize: 12.5,
                }}
              />
              <span style={{ fontSize: 10, color: 'var(--text-4)' }}>⌘K</span>
            </div>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: '4px 8px 12px' }}>
            {filteredNavGroups.map((group, groupIndex) => (
              <div key={group.title} style={{ marginTop: groupIndex === 0 ? 8 : 18 }}>
                <div style={navGroupLabelStyle}>{group.title}</div>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveGroup(item.id)
                      setSelectedSectionId(null)
                      const itemGroup = item.id === THEME_GROUP_ID ? themeGroupData : schema.find((group) => group.id === item.id)
                      const firstTab = getAvailableEditorTabs(itemGroup?.fields ?? [], itemGroup?.id)[0]?.id
                      if (firstTab) setActiveEditorTab(firstTab)
                    }}
                    style={{
                      width: '100%',
                      minHeight: 48,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      textAlign: 'left',
                      padding: '8px 10px',
                      border: 'none',
                      borderRadius: 8,
                      background: activeGroup === item.id ? 'var(--surface-inset)' : 'transparent',
                      color: activeGroup === item.id ? 'var(--text)' : 'var(--text-2)',
                      cursor: 'pointer',
                    }}
                  >
                    <span style={{ display: 'inline-flex', color: activeGroup === item.id ? 'var(--text)' : 'var(--text-3)' }}>
                      {item.icon}
                    </span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{item.label}</span>
                      <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                        {item.sub}
                      </span>
                    </span>
                    {activeGroup === item.id && <ChevronRightIcon />}
                  </button>
                ))}
              </div>
            ))}
            {filteredPageBlocks.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={navGroupLabelStyle}>Sayfa Akışı</div>
                {filteredPageBlocks.map((block) => {
                  const key = pageBlockKey(block)
                  const preset = block.type === 'section'
                    ? SECTION_LIBRARY.find((item) => item.id === block.id)
                    : null
                  const category = block.type === 'category'
                    ? menuCategories.find((item) => item.id === block.id)
                    : null
                  const categoryParentId = block.type === 'category'
                    ? getCategoryParentId(menuCategories, block.id)
                    : null
                  const isChildCategory = Boolean(categoryParentId)
                  const selected = block.type === 'section' && selectedSectionId === block.id
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={`${block.type === 'section'
                        ? preset?.label ?? block.id
                        : block.type === 'nav'
                          ? 'Kategori Menüsü'
                          : category?.name ?? block.id} bölümünü seç. Alt ve ok tuşlarıyla sıralamayı değiştir.`}
                      draggable
                      onClick={() => {
                        if (block.type === 'section') {
                          setSelectedSectionId(block.id)
                          setActiveEditorTab('content')
                        } else if (block.type === 'nav') {
                          setSelectedSectionId(null)
                          setActiveGroup('nav')
                          setActiveEditorTab('design')
                        } else {
                          setSelectedSectionId(null)
                        }
                      }}
                      onDragStart={() => setDragBlockKey(key)}
                      onDragEnd={() => setDragBlockKey(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handlePageBlockDrop(key)}
                      onKeyDown={(event) => {
                        if (event.altKey && event.key === 'ArrowUp') {
                          event.preventDefault()
                          handlePageBlockKeyboardMove(key, -1)
                          return
                        }
                        if (event.altKey && event.key === 'ArrowDown') {
                          event.preventDefault()
                          handlePageBlockKeyboardMove(key, 1)
                          return
                        }
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          event.currentTarget.click()
                        }
                      }}
                      style={{
                        minHeight: 44,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: isChildCategory ? '6px 10px 6px 34px' : '7px 10px',
                        borderRadius: 8,
                        background: selected ? 'var(--surface-inset)' : 'transparent',
                        color: selected ? 'var(--text)' : 'var(--text-2)',
                        cursor: dragBlockKey === key ? 'grabbing' : 'grab',
                        opacity: dragBlockKey === key ? 0.55 : 1,
                        position: 'relative',
                        outline: 'none',
                      }}
                    >
                      {isChildCategory && (
                        <span
                          aria-hidden
                          style={{
                            position: 'absolute',
                            left: 17,
                            top: -8,
                            bottom: 18,
                            width: 14,
                            borderLeft: '1px solid var(--border-strong)',
                            borderBottom: '1px solid var(--border-strong)',
                            borderBottomLeftRadius: 6,
                          }}
                        />
                      )}
                      <span style={{ color: 'var(--text-4)', fontSize: 13, letterSpacing: -2 }}>⋮⋮</span>
                      <span style={{ display: 'inline-flex', color: selected ? 'var(--text)' : 'var(--text-3)' }}>
                        {block.type === 'section' ? <PageIcon /> : block.type === 'nav' ? <HeaderIcon /> : <ListIcon />}
                      </span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>
                          {block.type === 'section'
                            ? preset?.label ?? block.id
                            : block.type === 'nav'
                              ? 'Kategori Menüsü'
                              : category?.name ?? block.id}
                        </span>
                        <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-3)', marginTop: 1 }}>
                          {block.type === 'section'
                            ? preset?.sub ?? 'Özel bölüm'
                            : block.type === 'nav'
                              ? 'Kaydırılabilir kategori navigasyonu'
                              : isChildCategory
                                ? `${menuCategories.find((item) => item.id === categoryParentId)?.name ?? 'Üst kategori'} alt kategorisi`
                                : 'Menü kategorisi'}
                        </span>
                      </span>
                      {block.type === 'section' && (
                        <button
                          type="button"
                          aria-label="Bölümü kaldır"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveSection(block.id)
                          }}
                          style={{
                            width: 24,
                            height: 24,
                            border: 'none',
                            borderRadius: 6,
                            background: 'transparent',
                            color: 'var(--text-3)',
                            cursor: 'pointer',
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ position: 'relative', marginTop: 14 }}>
              <button
                ref={sectionTriggerRef}
                type="button"
                onClick={openSectionPicker}
                style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 36,
                border: '1px dashed var(--border-strong)',
                background: 'transparent',
                color: 'var(--text-2)',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}>
                <PlusIcon />
                Bölüm ekle
              </button>
            </div>
          </div>
        </aside>

        <div style={{
          flex: 1, minWidth: 0,
          background: 'var(--surface-inset)',
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,.06) 1px, transparent 0)',
          backgroundSize: '20px 20px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{
            minHeight: 40,
            flexShrink: 0,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '6px 12px',
            padding: '6px 14px',
            borderBottom: '1px solid var(--border)',
            background: 'rgba(255,255,255,.72)',
            backdropFilter: 'blur(8px)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-2)', fontSize: 12, minWidth: 0, flex: '1 1 260px' }}>
              <span style={{ fontWeight: 650, color: 'var(--text)' }}>Önizleme</span>
              <span style={{ color: 'var(--text-4)' }}>·</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {previewUrl.replace(/^https?:\/\//, '')}
              </span>
              {previewStatus === 'degraded' && (
                <span
                  role="status"
                  title="Tema onayı zamanında alınamadı; önizleme yine de gösteriliyor."
                  style={{
                    flexShrink: 0,
                    padding: '2px 6px',
                    borderRadius: 5,
                    background: 'var(--warning-bg)',
                    color: 'var(--warning)',
                    fontSize: 10.5,
                    fontWeight: 650,
                  }}
                >
                  Sınırlı önizleme
                </span>
              )}
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  height: 24,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '0 8px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--surface)',
                  color: 'var(--text-2)',
                  textDecoration: 'none',
                  fontSize: 11.5,
                  fontWeight: 600,
                }}
              >
                <GlobeIcon />
                Aç
              </a>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                border: '1px solid var(--border)',
                borderRadius: 7,
                background: 'var(--surface)',
                overflow: 'hidden',
              }}>
                <button type="button" onClick={() => handleZoom(-0.1)} style={zoomButtonStyle}>−</button>
                <span style={{ minWidth: 48, textAlign: 'center', color: 'var(--text-2)', fontSize: 12 }}>
                  %{Math.round(previewScale * 100)}
                </span>
                <button type="button" onClick={() => handleZoom(0.1)} style={zoomButtonStyle}>+</button>
              </div>
              <button type="button" onClick={handleFitPreview} style={{ ...topbarButtonStyle, height: 28 }}>Sığdır</button>
            </div>
          </div>

          <div style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: isNarrowEditor ? '22px 16px' : previewMode === 'desktop' ? '32px 24px' : '32px 24px',
            overflow: 'auto',
            minWidth: isNarrowEditor ? 500 : 0,
          }}>
            <PhoneFrame
              restaurantName={restaurantName}
              restaurantLogoUrl={localLogoUrl}
              mode={previewMode}
              scale={previewScale}
            >
              <>
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  style={{
                    width: '100%', height: '100%', border: 'none',
                    opacity: previewStatus === 'preparing' ? 0 : 1,
                  }}
                  data-preview-state={previewStatus}
                  title="Menu Preview"
                />
                {previewStatus === 'preparing' && (
                  <div
                    aria-label="Önizleme hazırlanıyor"
                    style={{
                      position: 'absolute', inset: 0, zIndex: 2,
                      display: 'grid', placeItems: 'center',
                      background: previewTheme.bg,
                      color: previewTheme.accent,
                    }}
                  >
                    <div style={{
                      width: 22, height: 22, borderRadius: 999,
                      border: '2px solid currentColor',
                      borderRightColor: 'transparent',
                      animation: 'spin 700ms linear infinite',
                    }} />
                  </div>
                )}
              </>
            </PhoneFrame>
          </div>
        </div>

        <div style={{
          width: rightPanelWidth, flexShrink: 0,
          borderLeft: '1px solid var(--border)',
          background: 'var(--surface)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>
                  {selectedSection?.label ?? activeGroupData?.label ?? 'Sayfa'}
                </div>
                <div style={{ marginTop: 2, fontSize: 12, color: 'var(--text-3)' }}>
                  {selectedSection?.sub ?? getGroupHint(activeGroupData?.id)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4, color: 'var(--text-3)' }}>
                <IconShell title="Ayarları kopyala" onClick={handleCopyCurrentSettings}>
                  <CopyIcon />
                </IconShell>
                <IconShell title="Varsayılana sıfırla" onClick={handleResetCurrentSettings}>
                  <HistoryIcon />
                </IconShell>
              </div>
            </div>
          </div>

          {visibleEditorTabs.length > 0 && (
          <div style={{ display: 'flex', borderBottom: '1px solid var(--divider)', padding: '0 12px' }}>
            {visibleEditorTabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => handleEditorTabChange(tab.id)} style={{
                padding: '11px 10px 10px',
                border: 'none',
                borderBottom: `2px solid ${effectiveEditorTab === tab.id ? 'var(--text)' : 'transparent'}`,
                background: 'transparent',
                color: effectiveEditorTab === tab.id ? 'var(--text)' : 'var(--text-2)',
                fontSize: 12.5,
                fontWeight: 650,
                cursor: 'pointer',
              }}>
                {tab.label}
              </button>
            ))}
          </div>
          )}

          <div style={{ flex: 1, overflow: 'auto' }}>
            {selectedSection && selectedSectionId ? (
              <>
                <PropertySection title="Bölüm İçeriği" defaultOpen>
                  {selectedSectionId === 'gallery' && effectiveEditorTab === 'design' && (
                    <GalleryUploadPanel
                      restaurantId={restaurantId}
                      values={selectedSectionSettings}
                      onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)}
                    />
                  )}
                  {visibleSectionFields.length > 0 ? (
                    <SectionSettingsEditor
                      fields={visibleSectionFields}
                      values={selectedSectionSettings}
                      menuCategories={menuCategories}
                      menuItems={menuItems}
                      menuHref={`/dashboard/${restaurantId}/menu`}
                      onChange={(key, value) => handleSectionSettingChange(selectedSectionId, key, value)}
                    />
                  ) : (
                    <div style={{
                      padding: '12px',
                      borderRadius: 8,
                      background: 'var(--surface-3)',
                      color: 'var(--text-3)',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                    }}>
                      {selectedSection.label} için {EDITOR_TABS.find((tab) => tab.id === effectiveEditorTab)?.label.toLowerCase()} sekmesinde ayar yok.
                    </div>
                  )}
                </PropertySection>
                <PropertySection title="Bölüm Davranışı" defaultOpen={false}>
                  <div style={{
                    padding: '12px',
                    borderRadius: 8,
                    background: 'var(--surface-3)',
                    color: 'var(--text-3)',
                    fontSize: 12.5,
                    lineHeight: 1.45,
                  }}>
                    Bölümü sol panelde tutup sürükleyerek sırasını değiştirebilirsin. Sıra anında önizlemeye gönderilir.
                  </div>
                </PropertySection>
              </>
            ) : (
              <>
                <PropertySection title={activeGroupData?.label ?? 'Ayarlar'} defaultOpen>
                  {activeGroup === 'header' && mergedTheme.headerLogoStyle === 'image' && effectiveEditorTab === 'design' && (
                    <LogoUploadCard
                      logoUrl={localLogoUrl}
                      uploading={logoUploading}
                      onUpload={handleLogoUpload}
                      onRemove={handleLogoRemove}
                    />
                  )}
                  {visibleFields.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {visibleFields.map((field) => (
                        <PropertyFieldEditor
                          key={field.id}
                          field={field}
                          value={
                            overrides[field.themeField as keyof GarsonlessTheme] ??
                            entry.THEME_DEFAULTS[field.themeField as keyof GarsonlessTheme]
                          }
                          onChange={(v) => handleFieldChange(field, v)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      padding: '12px',
                      borderRadius: 8,
                      background: 'var(--surface-3)',
                      color: 'var(--text-3)',
                      fontSize: 12.5,
                      lineHeight: 1.45,
                    }}>
                      {activeGroupData?.label ?? 'Bu bölüm'} için {EDITOR_TABS.find((tab) => tab.id === effectiveEditorTab)?.label.toLowerCase()} sekmesinde ayar yok.
                    </div>
                  )}
                </PropertySection>
                {effectiveEditorTab === 'design' && activeGroup !== THEME_GROUP_ID && (
                  <PropertySection title="Marka rengi" defaultOpen={false}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {['accent', 'cta'].map((key) => {
                        const field = schema.flatMap((g) => g.fields).find((f) => f.themeField === key)
                        if (!field) return null
                        return (
                          <PropertyFieldEditor
                            key={field.id}
                            field={field}
                            value={
                              overrides[field.themeField as keyof GarsonlessTheme] ??
                              entry.THEME_DEFAULTS[field.themeField as keyof GarsonlessTheme]
                            }
                            onChange={(v) => handleFieldChange(field, v)}
                          />
                        )
                      })}
                    </div>
                  </PropertySection>
                )}
              </>
            )}
          </div>

          <div style={{
            minHeight: 44,
            borderTop: '1px solid var(--divider)',
            background: 'var(--surface-2)',
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <button type="button" style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-2)',
              textDecoration: 'underline',
              textUnderlineOffset: 2,
              fontSize: 12,
              cursor: 'pointer',
            }} onClick={handleResetCurrentSettings}>
              Varsayılana sıfırla
            </button>
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
              {selectedSection ? visibleSectionFields.length : visibleFields.length} özellik
            </span>
          </div>
        </div>
      </div>

      {templatePickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Şablonlar"
          onKeyDown={trapDialogFocus}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeTemplatePicker()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 210,
            background: 'rgba(17,17,19,.48)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{
            width: 'min(1160px, calc(100vw - 96px))',
            height: 'min(790px, calc(100vh - 72px))',
            borderRadius: 18,
            background: 'var(--surface)',
            boxShadow: '0 28px 74px rgba(0,0,0,.22)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '22px 28px 20px',
              borderBottom: '1px solid var(--divider)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 18,
            }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, lineHeight: 1.05, fontWeight: 850 }}>
                  Şablonlar
                </h2>
                <p style={{ margin: '8px 0 0', color: 'var(--text-3)', fontSize: 14 }}>
                  {templateEntries.length} hazır tasarım · aktif tasarımın en başta görünür
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                <div style={{
                  height: 38,
                  borderRadius: 999,
                  background: 'var(--surface-3)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px 0 10px',
                  color: 'var(--text-2)',
                  fontSize: 13,
                  fontWeight: 650,
                }}>
                  <span style={{
                    height: 24,
                    minWidth: 54,
                    borderRadius: 999,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'var(--positive-bg)',
                    color: 'var(--positive)',
                    fontSize: 13,
                    fontWeight: 850,
                  }}>
                    FREE
                  </span>
                  planındasın
                </div>
                <button
                  ref={templateCloseRef}
                  type="button"
                  aria-label="Kapat"
                  onClick={closeTemplatePicker}
                  style={{
                    width: 34,
                    height: 34,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    fontSize: 28,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              background: 'var(--surface-inset)',
              padding: '28px 28px 34px',
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 20,
                alignItems: 'start',
              }}>
                {templateEntries.map((templateEntry) => {
                  const isCurrent = templateEntry.id === templateId
                  const templateTheme = isCurrent ? previewTheme : templateEntry.THEME_DEFAULTS
                  const isActivating = activatingTemplateId === templateEntry.id
                  const copy = getTemplateCardCopy(templateEntry.id, templateEntry.name)
                  return (
                    <button
                      key={templateEntry.id}
                      type="button"
                      onClick={() => handleTemplateSelect(templateEntry.id)}
                      disabled={!!activatingTemplateId}
                      style={{
                        textAlign: 'left',
                        border: `1.5px solid ${isCurrent ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 14,
                        background: 'var(--surface)',
                        overflow: 'hidden',
                        cursor: activatingTemplateId ? 'wait' : 'pointer',
                        padding: 0,
                        boxShadow: isCurrent
                          ? '0 0 0 4px var(--accent-soft), 0 18px 40px rgba(20,25,31,.12)'
                          : '0 2px 8px rgba(20,25,31,.06)',
                      }}
                    >
                      <div style={{ position: 'relative', height: 390, borderBottom: '1px solid var(--divider)', background: 'linear-gradient(180deg,#fff 0%,#fbfbfc 100%)' }}>
                        <TemplateShowcasePreview id={templateEntry.id} theme={templateTheme} title={templateEntry.name} />
                        <span style={{
                          position: 'absolute',
                          left: 18,
                          top: 18,
                          borderRadius: 999,
                          padding: '7px 12px',
                          background: copy.tier === 'PRO' ? '#fff3df' : 'var(--positive-bg)',
                          color: copy.tier === 'PRO' ? '#b86408' : 'var(--positive)',
                          fontSize: 13,
                          fontWeight: 850,
                          letterSpacing: '.02em',
                        }}>
                          {copy.tier}
                        </span>
                        {isCurrent && (
                          <span style={{
                            position: 'absolute',
                            right: 18,
                            top: 18,
                            height: 32,
                            borderRadius: 999,
                            padding: '0 13px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 7,
                            background: 'var(--accent)',
                            color: '#fff',
                            fontSize: 13,
                            fontWeight: 850,
                            boxShadow: '0 10px 22px rgba(20,25,31,.14)',
                          }}>
                            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#fff' }} />
                            Aktif seçili
                          </span>
                        )}
                      </div>

                      <div style={{ padding: '17px 18px 19px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14 }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'var(--text)', fontSize: 18, fontWeight: 850, lineHeight: 1.15 }}>
                              {copy.title}
                            </div>
                            <div style={{ marginTop: 8, color: 'var(--text-3)', fontSize: 13.5, lineHeight: 1.35 }}>
                              {copy.description}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 5, flexShrink: 0, paddingTop: 3 }}>
                            {[templateTheme.accent, templateTheme.bg, templateTheme.cta, templateTheme.accentSoft].map((color, index) => (
                              <span
                                key={`${templateEntry.id}-${color}-${index}`}
                                style={{
                                  width: 16,
                                  height: 16,
                                  borderRadius: 4,
                                  background: color,
                                  border: '1px solid rgba(20,25,31,.10)',
                                }}
                              />
                            ))}
                          </div>
                        </div>

                        <div style={{
                          marginTop: 14,
                          paddingTop: 13,
                          borderTop: '1px solid var(--divider)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 14,
                        }}>
                          <span style={{
                            minWidth: 0,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            color: 'var(--text-3)',
                            fontSize: 12.5,
                          }}>
                            {copy.meta}
                          </span>
                          <span style={{
                            flexShrink: 0,
                            minWidth: 96,
                            height: 32,
                            borderRadius: 9,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: isCurrent ? 'var(--accent-soft)' : 'var(--text)',
                            color: isCurrent ? 'var(--accent)' : '#fff',
                            fontSize: 12,
                            fontWeight: 800,
                          }}>
                            {isCurrent ? 'Aktif' : isActivating ? 'Açılıyor...' : 'Şablonu aç'}
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{
              minHeight: 56,
              borderTop: '1px solid var(--divider)',
              background: 'var(--surface)',
              padding: '0 28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}>
              <span style={{ color: 'var(--text-3)', fontSize: 13.5 }}>
                Her şablon kendi özel componentleriyle gelir; uyguladıktan sonra renk, font ve detayları sağ panelden ayarlayabilirsin.
              </span>
              <button
                type="button"
                onClick={closeTemplatePicker}
                style={{
                  height: 38,
                  padding: '0 18px',
                  borderRadius: 9,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 650,
                }}
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}

      {sectionPickerOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bölüm ekle"
          onKeyDown={trapDialogFocus}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeSectionPicker()
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(17,17,19,.48)',
            backdropFilter: 'blur(9px)',
            WebkitBackdropFilter: 'blur(9px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <div style={{
            width: 'min(1360px, calc(100vw - 64px))',
            height: 'min(820px, calc(100vh - 64px))',
            borderRadius: 18,
            background: 'var(--surface)',
            boxShadow: '0 30px 80px rgba(0,0,0,.24)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div style={{
              padding: '24px 28px 22px',
              borderBottom: '1px solid var(--divider)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 18,
            }}>
              <div>
                <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 22, lineHeight: 1.1, fontWeight: 800 }}>
                  Bölüm ekle
                </h2>
                <p style={{ margin: '10px 0 0', color: 'var(--text-3)', fontSize: 15 }}>
                  {SECTION_LIBRARY.length} hazır komponent · {SECTION_GROUPS.length - 1} kategori
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <button
                  ref={sectionCloseRef}
                  type="button"
                  aria-label="Kapat"
                  onClick={closeSectionPicker}
                  style={{
                    width: 34,
                    height: 34,
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-3)',
                    cursor: 'pointer',
                    fontSize: 28,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            </div>

            <div style={{
              padding: '16px 28px',
              borderBottom: '1px solid var(--divider)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              overflow: 'hidden',
            }}>
              <div style={{
                width: 270,
                flexShrink: 0,
                height: 42,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '0 14px',
                background: 'var(--surface-3)',
                borderRadius: 10,
                color: 'var(--text-3)',
              }}>
                <SearchIcon />
                <input
                  value={sectionSearch}
                  onChange={(e) => setSectionSearch(e.target.value)}
                  placeholder="Komponent ara..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: 'var(--text)',
                    fontSize: 14,
                  }}
                />
              </div>
              <div style={{ display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 3 }}>
                {SECTION_GROUPS.map((group) => {
                  const count = group === 'Tümü'
                    ? SECTION_LIBRARY.length
                    : SECTION_LIBRARY.filter((section) => section.group === group).length
                  const active = sectionGroup === group
                  return (
                    <button
                      key={group}
                      type="button"
                      onClick={() => setSectionGroup(group)}
                      style={{
                        flexShrink: 0,
                        height: 38,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '0 15px',
                        borderRadius: 999,
                        border: active ? 'none' : '1px solid var(--border)',
                        background: active ? 'var(--text)' : 'var(--surface)',
                        color: active ? '#fff' : 'var(--text-2)',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 750,
                      }}
                    >
                      {group}
                      <span style={{
                        minWidth: 22,
                        height: 22,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 999,
                        background: active ? 'rgba(255,255,255,.18)' : 'var(--surface-3)',
                        color: active ? '#fff' : 'var(--text-3)',
                        fontSize: 12,
                      }}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              background: 'var(--surface-inset)',
              padding: 28,
            }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                gap: 18,
              }}>
                {filteredSections.map((section) => {
                  const exists = activeSections.includes(section.id)
                  return (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => handleAddSection(section.id)}
                      style={{
                        textAlign: 'left',
                        border: '1px solid var(--border)',
                        borderRadius: 14,
                        background: 'var(--surface)',
                        overflow: 'hidden',
                        cursor: 'pointer',
                        opacity: exists ? 0.82 : 1,
                        boxShadow: '0 1px 2px rgba(20,25,31,.05)',
                        padding: 0,
                        position: 'relative',
                      }}
                    >
                      <div style={{ padding: 10, borderBottom: '1px solid var(--divider)', background: 'var(--surface-2)', position: 'relative' }}>
                        <SectionMiniPreview id={section.id} />
                        <PlanBadge plan={section.plan} />
                      </div>
                      <div style={{ padding: '16px 16px 18px' }}>
                        {exists && (
                          <div style={{ color: 'var(--text-3)', fontSize: 12, fontWeight: 750, marginBottom: 7 }}>
                            Eklendi
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                          <span style={{ width: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)' }}>{section.icon}</span>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'var(--text)', fontSize: 17, fontWeight: 850, lineHeight: 1.18, letterSpacing: '-0.01em' }}>
                              {section.label}
                            </div>
                            <div style={{ marginTop: 5, color: 'var(--text-3)', fontSize: 13.5, lineHeight: 1.35 }}>
                              {section.sub}
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{
              minHeight: 58,
              borderTop: '1px solid var(--divider)',
              background: 'var(--surface)',
              padding: '0 24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
            }}>
              <span style={{ color: 'var(--text-3)', fontSize: 13 }}>
                Her component eklendikten sonra sağ panelden detaylı olarak özelleştirilebilir.
              </span>
              <button
                type="button"
                onClick={closeSectionPicker}
                style={{
                  height: 38,
                  padding: '0 18px',
                  borderRadius: 9,
                  border: '1px solid var(--border-strong)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: 650,
                }}
              >
                Vazgeç
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
          position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--text)', color: '#fff',
          padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          boxShadow: '0 4px 16px rgba(0,0,0,0.18)', zIndex: 100,
          pointerEvents: 'none',
        }}>
          {toast}
        </div>
      )}
    </div>
  )
}

function PhoneFrame({ restaurantName: _restaurantName, restaurantLogoUrl: _restaurantLogoUrl, children, mode = 'mobile', scale = 1 }: {
  restaurantName: string
  restaurantLogoUrl: string | null
  children: React.ReactNode
  mode?: 'mobile' | 'desktop'
  scale?: number
}) {
  const W = mode === 'desktop' ? 1040 : 390
  const H = mode === 'desktop' ? 720 : 760
  const outerWidth = mode === 'desktop' ? W : W
  const outerHeight = mode === 'desktop' ? H : H
  return (
    <div style={{
      width: outerWidth * scale,
      height: outerHeight * scale,
      flexShrink: 0,
      position: 'relative',
    }}>
      <div style={{
        width: outerWidth,
        height: outerHeight,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        borderRadius: mode === 'desktop' ? 20 : 44,
        background: mode === 'desktop' ? 'var(--surface)' : '#0b0b0d',
        padding: mode === 'desktop' ? 0 : 10,
        boxShadow: mode === 'desktop'
          ? '0 30px 80px -28px rgba(0,0,0,.28), 0 0 0 1px var(--border)'
          : '0 30px 60px -20px rgba(0,0,0,.25), 0 0 0 .5px #0b0b0d',
      }}>
        <div style={{
          width: '100%',
          height: mode === 'desktop' ? '100%' : H - 20,
          borderRadius: mode === 'desktop' ? 20 : 34,
          overflow: 'hidden',
          position: 'relative',
          background: '#fff',
        }}>
          {children}
        </div>
      </div>
    </div>
  )
}

function buildEditorNav(schema: SettingsGroup[], themeName: string) {
  const iconFor = (id: string) => {
    if (id.includes('header') || id.includes('topbar')) return <HeaderIcon />
    if (id.includes('cat') || id.includes('menu')) return <ListIcon />
    if (id.includes('card') || id.includes('dish')) return <CardIcon />
    if (id.includes('cart') || id.includes('payment')) return <CartSmallIcon />
    if (id.includes('color') || id.includes('surface')) return <DropletIcon />
    if (id.includes('type') || id.includes('welcome')) return <TypeIcon />
    if (id.includes('layout') || id.includes('spacing')) return <LayoutIcon />
    return <PageIcon />
  }
  const subFor = (id: string, label: string) => {
    if (id.includes('surface')) return 'Arka plan, renkler'
    if (id.includes('topbar')) return 'Logo, navigasyon'
    if (id.includes('welcome')) return 'Giriş metni'
    if (id.includes('menu')) return 'Kaydırılabilir kartlar'
    if (id.includes('dish')) return 'Ürün listesi'
    if (id.includes('payment')) return 'Alt ödeme akışı'
    if (id === 'colors') return 'Marka renkleri'
    if (id === 'typography') return 'Font ve ölçek'
    if (id === 'layout') return 'Izgara ve boşluk'
    return label
  }
  const visibleSchema = schema.filter((group) => !THEME_GROUP_SOURCE_IDS.has(group.id))
  const structure = visibleSchema.slice(0, Math.ceil(visibleSchema.length / 2)).map((group) => ({
    id: group.id,
    label: group.label,
    sub: subFor(group.id, group.label),
    icon: iconFor(group.id),
  }))
  const style = [
    ...(schema.some((group) => THEME_GROUP_SOURCE_IDS.has(group.id))
      ? [{
          id: THEME_GROUP_ID,
          label: 'Tema',
          sub: 'Renkler ve tipografi',
          icon: <ThemeIcon />,
        }]
      : []),
    ...visibleSchema.slice(Math.ceil(visibleSchema.length / 2)).map((group) => ({
    id: group.id,
    label: group.label,
    sub: subFor(group.id, group.label),
    icon: iconFor(group.id),
    })),
  ]
  return [
    { title: 'Sayfa Yapısı', items: structure.length ? structure : [] },
    { title: 'Genel Stil', items: style.length ? style : [] },
  ].filter((group) => group.items.length > 0 || themeName)
}

function buildThemeGroup(schema: SettingsGroup[]): SettingsGroup {
  const sourceGroups = schema.filter((group) => THEME_GROUP_SOURCE_IDS.has(group.id))
  return {
    id: THEME_GROUP_ID,
    label: 'Tema',
    fields: sourceGroups.flatMap((group) => group.fields),
  }
}

function getAvailableEditorTabs(fields: SettingField[], groupId = '') {
  return EDITOR_TABS.filter((tab) => fields.some((field) => getFieldEditorTab(field, groupId) === tab.id))
}

function getAvailableSectionTabs(fields: SectionSettingField[]) {
  return EDITOR_TABS.filter((tab) => fields.some((field) => field.editorTab === tab.id))
}

function getGroupHint(id?: string) {
  if (!id) return 'Tüm sayfalara uygulanır'
  if (id === THEME_GROUP_ID) return 'Renkler ve yazı sistemi'
  if (id.includes('surface')) return 'Tüm sayfalara uygulanır'
  if (id.includes('topbar')) return 'Sayfa üstündeki marka alanı'
  if (id.includes('welcome')) return 'Karşılama bloğu'
  if (id.includes('menu')) return 'Kategori ve menü kartları'
  if (id.includes('dish')) return 'Tüm ürünlere uygulanır'
  if (id.includes('payment')) return 'Sepet ve ödeme akışı'
  return 'Bu tema bölümüne uygulanır'
}

function getTemplateCardCopy(id: string, name: string) {
  const copy: Record<string, { title: string; description: string; meta: string; tier: 'FREE' | 'PRO' }> = {
    default: {
      title: 'Classic',
      description: 'Aktif klasik menü tasarımı · kategori pilleri, ürün kartları ve sabit sepet',
      meta: 'Kafe · Restoran · Masa siparişi',
      tier: 'FREE',
    },
    spain: {
      title: 'Taste of Spain',
      description: 'Mediterranean digital menu · zengin giriş, yatay menüler ve fotoğraflı ürün akışı',
      meta: 'Fine dining · Tapas · Çoklu menü',
      tier: 'FREE',
    },
    obsidian: {
      title: 'Obsidian',
      description: 'Kontrast siyah sahne · premium ürün kartları ve güçlü marka vurgusu',
      meta: 'Bar · Steakhouse · Gece konsepti',
      tier: 'PRO',
    },
    kiosk: {
      title: 'Kiosk Express',
      description: 'Hızlı seçim · büyük CTA ve self servis akışı',
      meta: 'Quick service · Kiosk · Yoğun operasyon',
      tier: 'FREE',
    },
    shio: {
      title: 'Shio Minimal',
      description: 'Dingin yüzeyler · sade listeleme ve premium boşluk',
      meta: 'Sushi · Ramen · Modern restoran',
      tier: 'FREE',
    },
    sofra: {
      title: 'Sofra Sıcak',
      description: 'Yumuşak tonlar · okunaklı kategori ve ürün düzeni',
      meta: 'Aile restoranı · Kahvaltı · Yerel mutfak',
      tier: 'FREE',
    },
    midnight: {
      title: 'Midnight Club',
      description: 'Koyu sahne · neon vurgu ve güçlü sepet aksiyonu',
      meta: 'Lounge · Kokteyl · Gece menüsü',
      tier: 'PRO',
    },
    bloom: {
      title: 'Bloom Patisserie',
      description: 'Canlı pembe tonlar · tatlı ve butik kafe deneyimi',
      meta: 'Patisserie · Coffee shop · Butik',
      tier: 'FREE',
    },
  }
  return copy[id] ?? {
    title: name,
    description: `${name} teması · kendi renk, tipografi ve bileşen yapısıyla gelir`,
    meta: 'Özelleştirilebilir şablon',
    tier: 'FREE',
  }
}

function TemplateShowcasePreview({ id, theme, title }: { id: string; theme: GarsonlessTheme; title: string }) {
  if (id === 'default') return <ClassicTemplatePhone theme={theme} />
  if (id === 'spain') return <SpainTemplatePhone theme={theme} />
  return <GenericTemplatePhone theme={theme} title={title} />
}

function ShowcasePhone({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div style={{
      position: 'absolute',
      left: '50%',
      bottom: 20,
      transform: 'translateX(-50%)',
      width: 202,
      height: 348,
      borderRadius: 30,
      border: dark ? '7px solid #1d1e24' : '7px solid #0d0d0f',
      background: dark ? '#232442' : '#fff',
      overflow: 'hidden',
      boxShadow: '0 28px 54px rgba(20,25,31,.18)',
    }}>
      {children}
    </div>
  )
}

function ClassicTemplatePhone({ theme }: { theme: GarsonlessTheme }) {
  const dark = theme.bg === '#0a0a0a' || theme.bg === '#0f172a'
  return (
    <ShowcasePhone dark={dark}>
      <div style={{ height: '100%', background: theme.bg, color: dark ? '#fff' : '#15171c', fontFamily: fontCssValue(theme.bodyFont) }}>
        <div style={{ padding: 15, background: theme.headerBg, borderBottom: '1px solid rgba(46,125,82,.13)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{
              color: theme.accent,
              fontFamily: fontCssValue(theme.displayFont, true),
              fontSize: 25,
              lineHeight: .88,
              fontWeight: 850,
            }}>
              MAF Cafe<br />Lounge
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: dark ? 'rgba(255,255,255,.72)' : '#6b7280', fontSize: 9, paddingTop: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.cta }} />
              Masa 12
            </div>
          </div>
        </div>
        <div style={{ padding: '12px 15px 78px' }}>
          <div style={{ display: 'flex', gap: 7, overflow: 'hidden', marginBottom: 18 }}>
            {['Kahvaltı', 'Kahveler', 'Tatlılar'].map((item, index) => (
              <span key={item} style={{
                flexShrink: 0,
                borderRadius: 999,
                padding: '8px 11px',
                background: index === 0 ? theme.accent : '#fff',
                color: index === 0 ? '#fff' : theme.accent,
                border: index === 0 ? 'none' : '1px solid rgba(20,25,31,.09)',
                fontSize: 9,
                fontWeight: 850,
              }}>
                {item}
              </span>
            ))}
          </div>
          <h3 style={{
            margin: '0 0 14px',
            color: theme.accent,
            fontFamily: fontCssValue(theme.displayFont, true),
            fontSize: 21,
            lineHeight: 1,
            fontWeight: 850,
          }}>
            Kahvaltı
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <TemplateProductTile theme={theme} title="Serpme Kahvaltı" price="₺380" tone={theme.accentSoft} />
            <TemplateProductTile theme={theme} title="Menemen" price="₺180" tone="#f7d89a" />
            <TemplateProductTile theme={theme} title="Avokado Toast" price="₺220" tone="#e8ecef" />
            <TemplateProductTile theme={theme} title="Türk Kahvesi" price="₺85" tone="#e9f3ee" />
          </div>
        </div>
        <div style={{
          position: 'absolute',
          left: 18,
          right: 18,
          bottom: 14,
          height: 34,
          borderRadius: 999,
          background: dark ? '#fff' : '#1c1d20',
          color: dark ? '#111' : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 15px',
          fontSize: 10,
          fontWeight: 850,
          boxShadow: '0 14px 28px rgba(20,25,31,.22)',
        }}>
          <span>Sepeti gör</span>
          <span>₺380</span>
        </div>
      </div>
    </ShowcasePhone>
  )
}

function SpainTemplatePhone({ theme: _theme }: { theme: GarsonlessTheme }) {
  return (
    <ShowcasePhone>
      <div style={{ height: '100%', background: '#fff', padding: 14, color: '#17191d' }}>
        <div style={{ fontSize: 9, fontWeight: 800, marginBottom: 22 }}>9:41</div>
        <div style={{ height: 72, borderRadius: 18, background: '#fbf8f3', padding: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 999, background: '#17191d', color: '#fff', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900 }}>Bo</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 900 }}>Bowlicious</div>
            <div style={{ marginTop: 4, width: 92, height: 8, borderRadius: 999, background: '#e9e5df' }} />
            <div style={{ marginTop: 4, width: 76, height: 8, borderRadius: 999, background: '#efebe6' }} />
          </div>
          <div style={{ width: 44, height: 44, borderRadius: 999, background: 'linear-gradient(135deg,#ff6b43,#ffd08a)', display: 'grid', placeItems: 'center', fontSize: 20 }}>●</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 14 }}>
          {['Teslimat', 'Paket', 'Salon'].map((item, index) => (
            <div key={item} style={{ height: 24, borderRadius: 999, background: index === 0 ? '#17191d' : '#f0f0f1', color: index === 0 ? '#fff' : '#6b6f78', display: 'grid', placeItems: 'center', fontSize: 8, fontWeight: 800 }}>{item}</div>
          ))}
        </div>
        <div style={{ height: 26, borderRadius: 999, border: '1px solid #e3e4e7', marginTop: 12 }} />
        <div style={{ display: 'flex', gap: 7, marginTop: 12 }}>
          {['Bowls', 'Salad', 'Soup'].map((item, index) => (
            <span key={item} style={{ fontSize: 8, borderRadius: 999, padding: '5px 9px', background: index === 0 ? '#17191d' : '#fff', color: index === 0 ? '#fff' : '#6b6f78' }}>{item}</span>
          ))}
        </div>
        <div style={{ marginTop: 12, fontSize: 11, fontWeight: 900 }}>Bowls</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
          {['Shrimp Poke Bowl', 'Hawaiian Bowl'].map((item, index) => (
            <div key={item} style={{ height: 106, borderRadius: 11, border: '1px solid #ececef', overflow: 'hidden', background: '#fff' }}>
              <div style={{ height: 72, background: '#fff2dc', display: 'grid', placeItems: 'center', fontSize: 20 }}>{index === 0 ? '●' : '◐'}</div>
              <div style={{ padding: '6px 7px', fontSize: 7, fontWeight: 850 }}>{item}</div>
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, height: 28, borderRadius: 999, border: '2px solid #ff6b43', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', fontSize: 8, fontWeight: 850 }}>
          <span>Sipariş detayı</span>
          <span>₺365</span>
        </div>
      </div>
    </ShowcasePhone>
  )
}

function GenericTemplatePhone({ theme, title }: { theme: GarsonlessTheme; title: string }) {
  const dark = theme.bg === '#0a0a0a' || theme.bg === '#0f172a'
  return (
    <ShowcasePhone dark={dark}>
      <div style={{ height: '100%', background: theme.bg, color: dark ? '#fff' : '#15171c' }}>
        <div style={{ padding: 16, background: theme.headerBg, borderBottom: '1px solid rgba(20,25,31,.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: theme.accent, fontSize: 20, lineHeight: 1, fontWeight: 900 }}>{title.split(' ')[0]}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <span style={{ width: 22, height: 22, borderRadius: 999, background: theme.accentSoft }} />
              <span style={{ width: 22, height: 22, borderRadius: 999, background: theme.accentSoft }} />
            </div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['Kahvaltı', 'Kahveler', 'Tatlılar'].map((item, index) => (
              <span key={item} style={{ borderRadius: 999, padding: '8px 11px', background: index === 0 ? theme.accent : '#fff', color: index === 0 ? '#fff' : theme.accent, fontSize: 9, fontWeight: 850 }}>{item}</span>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ height: 118, borderRadius: 12, background: '#fff', overflow: 'hidden', boxShadow: '0 10px 22px rgba(20,25,31,.08)' }}>
              <div style={{ height: 58, background: `linear-gradient(135deg, ${theme.accentSoft}, ${theme.accent})` }} />
              <div style={{ padding: 10, color: theme.accent, fontSize: 10, fontWeight: 900 }}>Serpme</div>
            </div>
            <div style={{ height: 118, borderRadius: 12, background: '#fff', overflow: 'hidden', boxShadow: '0 10px 22px rgba(20,25,31,.08)' }}>
              <div style={{ height: 58, background: `linear-gradient(135deg, ${theme.cta}, ${theme.accentSoft})` }} />
              <div style={{ padding: 10, color: theme.accent, fontSize: 10, fontWeight: 900 }}>Menemen</div>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 18, right: 18, bottom: 16, height: 34, borderRadius: 999, background: dark ? '#fff' : '#1c1d20', color: dark ? '#111' : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 13px', fontSize: 10, fontWeight: 850 }}>
          <span>Sepeti gör</span>
          <span>₺380</span>
        </div>
      </div>
    </ShowcasePhone>
  )
}

function TemplateProductTile({ theme, title, price, tone }: { theme: GarsonlessTheme; title: string; price: string; tone: string }) {
  return (
    <div style={{
      height: 92,
      borderRadius: 12,
      overflow: 'hidden',
      background: '#fff',
      boxShadow: '0 10px 22px rgba(20,25,31,.08)',
      border: '1px solid rgba(20,25,31,.06)',
    }}>
      <div style={{ height: 40, background: `linear-gradient(135deg, ${tone}, ${theme.accent})`, opacity: .55 }} />
      <div style={{ padding: '8px 9px', display: 'grid', gap: 5 }}>
        <div style={{ color: theme.accent, fontSize: 10, fontWeight: 900, lineHeight: 1.05, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#15171c', fontSize: 10, fontWeight: 900 }}>
          <span>{price}</span>
          <span style={{ width: 20, height: 20, borderRadius: 999, background: theme.cta, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, lineHeight: 1 }}>+</span>
        </div>
      </div>
    </div>
  )
}

function PropertySection({ title, children, defaultOpen = true }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderBottom: '1px solid var(--divider)' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 750, color: 'var(--text)' }}>{title}</span>
        <span style={{
          color: 'var(--text-3)',
          transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          transition: 'transform 120ms',
        }}>
          <ChevronDownIcon />
        </span>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function PropertyFieldEditor({ field, value, onChange }: {
  field: SettingField
  value: unknown
  onChange: (v: unknown) => void
}) {
  const controlId = `theme-field-${sanitizeId(field.id)}`
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '96px 1fr',
      alignItems: field.type === 'toggle' ? 'center' : 'start',
      gap: 10,
      minHeight: 32,
    }}>
      <label htmlFor={controlId} style={{ paddingTop: field.type === 'toggle' ? 0 : 6, fontSize: 12.5, color: 'var(--text-2)' }}>
        {field.label}
      </label>
      <PropertyControl field={field} value={value} onChange={onChange} controlId={controlId} />
    </div>
  )
}

function SectionSettingsEditor({ fields, values, menuCategories, menuItems, menuHref, onChange }: {
  fields: SectionSettingField[]
  values: Record<string, string>
  menuCategories: Array<{ id: string; name: string }>
  menuItems: Array<{ id: string; name: string; categoryId: string; categoryName: string }>
  menuHref?: string
  onChange: (key: string, value: string) => void
}) {
  const targetType = values['targetType'] || 'none'
  const comboCount = Number(values['comboCount'] || 3)
  const comboIconCounts = {
    combo1: Number(values['combo1IconCount'] || 2),
    combo2: Number(values['combo2IconCount'] || 2),
    combo3: Number(values['combo3IconCount'] || 2),
  }
  const isPromoSlider = fields.some((f) => f.key === 'couponHeading')
  const promoSlideOn = (prefix: string, fallback: boolean) => {
    const v = values[`${prefix}Enabled`]
    if (v === 'true') return true
    if (v === 'false') return false
    return fallback
  }
  const promoSlides: Array<{ prefix: string; defaultOn: boolean }> = [
    { prefix: 'coupon', defaultOn: true },
    { prefix: 'flash', defaultOn: true },
    { prefix: 'freebie', defaultOn: false },
    { prefix: 'loyalty', defaultOn: false },
    { prefix: 'combo', defaultOn: true },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {fields.map((field) => {
        if (field.key === 'targetId' && targetType !== 'category' && targetType !== 'product') return null
        if (field.key === 'targetUrl' && targetType !== 'link') return null
        if (isPromoSlider) {
          const slide = promoSlides.find((s) =>
            field.key.startsWith(s.prefix) &&
            field.key !== `${s.prefix}Heading` &&
            field.key !== `${s.prefix}Enabled`,
          )
          if (slide && !promoSlideOn(slide.prefix, slide.defaultOn)) return null
        }
        if (field.type === 'heading') {
          return (
            <div key={field.key} style={{
              marginTop: 8,
              paddingTop: 12,
              borderTop: '1px solid var(--border-strong)',
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '.06em',
              color: 'var(--text-3)',
              textTransform: 'uppercase',
            }}>{field.label}</div>
          )
        }
        if (field.key.startsWith('combo2') && comboCount < 2) return null
        if (field.key.startsWith('combo3') && comboCount < 3) return null
        if (field.key === 'combo1Icon2' && comboIconCounts.combo1 < 2) return null
        if (field.key === 'combo1Icon3' && comboIconCounts.combo1 < 3) return null
        if (field.key === 'combo2Icon2' && comboIconCounts.combo2 < 2) return null
        if (field.key === 'combo2Icon3' && comboIconCounts.combo2 < 3) return null
        if (field.key === 'combo3Icon2' && comboIconCounts.combo3 < 2) return null
        if (field.key === 'combo3Icon3' && comboIconCounts.combo3 < 3) return null

        const controlId = `section-field-${sanitizeId(field.key)}`
        return (
          <div
            key={field.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr',
              alignItems: 'start',
              gap: 10,
              minHeight: 32,
            }}
          >
            <label htmlFor={controlId} style={{ paddingTop: 6, fontSize: 12.5, color: 'var(--text-2)' }}>
              {field.key === 'targetId'
                ? targetType === 'category' ? 'Kategori' : 'Ürün'
                : field.label}
            </label>
            <SectionSettingControl
              field={field}
              value={
                isPromoSlider && field.key.endsWith('Enabled') && !values[field.key]
                  ? (promoSlides.find((s) => field.key === `${s.prefix}Enabled`)?.defaultOn ? 'true' : 'false')
                  : (values[field.key] ?? '')
              }
              controlId={controlId}
              targetType={targetType}
              menuCategories={menuCategories}
              menuItems={menuItems}
              {...(menuHref ? { menuHref } : {})}
              onChange={(value) => onChange(field.key, value)}
            />
          </div>
        )
      })}
    </div>
  )
}

function SectionSettingControl({ field, value, controlId, targetType, menuCategories, menuItems, menuHref, onChange }: {
  field: SectionSettingField
  value: string
  controlId: string
  targetType?: string
  menuCategories?: Array<{ id: string; name: string }>
  menuItems?: Array<{ id: string; name: string; categoryId: string; categoryName: string }>
  menuHref?: string
  onChange: (value: string) => void
}) {
  if (field.type === 'product-select') {
    const items = menuItems ?? []
    const grouped = items.reduce<Record<string, Array<{ id: string; name: string }>>>((acc, item) => {
      const cat = item.categoryName
      if (!acc[cat]) acc[cat] = []
      acc[cat].push({ id: item.id, name: item.name })
      return acc
    }, {})
    const menuLinkStyle = {
      fontSize: 11.5,
      color: 'var(--text-2)',
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      textDecoration: 'underline',
      fontFamily: 'inherit',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
    } as const
    if (items.length === 0 && menuHref) {
      return (
        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>
          Henüz ürün yok —{' '}
          <button type="button" style={menuLinkStyle} onClick={() => window.open(menuHref, '_blank', 'noopener')}>
            Menü&apos;den ekle <I.arrow size={11} />
          </button>
        </div>
      )
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <select
          id={controlId}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%', height: 36,
            borderRadius: 7,
            border: '1px solid var(--border-strong)',
            background: 'var(--surface)',
            color: value ? 'var(--text)' : 'var(--text-3)',
            fontSize: 12.5, padding: '0 9px', cursor: 'pointer',
          }}
        >
          <option value="">— Ürün seç —</option>
          {Object.entries(grouped).map(([cat, catItems]) => (
            <optgroup key={cat} label={cat}>
              {catItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {value && menuHref && (
          <button
            type="button"
            style={{ ...menuLinkStyle, alignSelf: 'flex-start' }}
            onClick={() => window.open(menuHref, '_blank', 'noopener')}
          >
            Düzenle <I.arrow size={11} />
          </button>
        )}
      </div>
    )
  }

  if (field.type === 'category-select') {
    return (
      <select
        id={controlId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%', height: 36,
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: value ? 'var(--text)' : 'var(--text-3)',
          fontSize: 12.5, padding: '0 9px', cursor: 'pointer',
        }}
      >
        <option value="">— Kategori seç —</option>
        {(menuCategories ?? []).map((category) => (
          <option key={category.id} value={category.id}>{category.name}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'heading') return null

  if (field.key === 'targetId' && (targetType === 'category' || targetType === 'product')) {
    const options = targetType === 'category'
      ? (menuCategories ?? []).map((category) => ({
          value: category.id,
          label: category.name,
          meta: 'Kategori',
        }))
      : (menuItems ?? []).map((item) => ({
          value: item.id,
          label: item.name,
          meta: item.categoryName,
        }))

    return (
      <select
        id={controlId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 32,
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: value ? 'var(--text)' : 'var(--text-3)',
          fontSize: 12.5,
          padding: '0 9px',
          cursor: 'pointer',
        }}
      >
        <option value="">
          {targetType === 'category' ? 'Kategori seç' : 'Ürün seç'}
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}{opt.meta ? ` · ${opt.meta}` : ''}
          </option>
        ))}
      </select>
    )
  }

  if (field.type === 'color') {
    const colorValue = value || field.placeholder || '#000000'
    return (
      <div style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        border: '1px solid var(--border-strong)',
        borderRadius: 7,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}>
        <input
          id={`${controlId}-color`}
          type="color"
          value={colorValue}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 34, height: 32, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
        />
        <input
          id={controlId}
          type="text"
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={sectionInputStyle}
        />
      </div>
    )
  }

  if (field.type === 'range' && 'themeField' in field && field.themeField === 'cols') {
    const numVal = Number(value || 2)
    const options = [
      {
        value: 1, label: '1',
        icon: (
          <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
            <rect x="3" y="3" width="22" height="16" rx="2.5" fill="currentColor" opacity="0.85" />
          </svg>
        ),
      },
      {
        value: 2, label: '2',
        icon: (
          <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
            <rect x="3" y="3" width="10" height="16" rx="2.5" fill="currentColor" opacity="0.85" />
            <rect x="15" y="3" width="10" height="16" rx="2.5" fill="currentColor" opacity="0.85" />
          </svg>
        ),
      },
      {
        value: 3, label: '3',
        icon: (
          <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
            <rect x="2" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" />
            <rect x="10.5" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" />
            <rect x="19" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" />
          </svg>
        ),
      },
    ]
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map((opt) => {
          const active = numVal === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              title={`${opt.value} sütun`}
              onClick={() => onChange(String(opt.value))}
              style={{
                flex: 1,
                height: 44,
                border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                borderRadius: 9,
                background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                cursor: 'pointer',
                transition: 'border-color 120ms, background 120ms, color 120ms',
              }}
            >
              {opt.icon}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'range') {
    const fallback = field.min ?? 0
    const numVal = Number(value || fallback)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32 }}>
        <input
          id={controlId}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={numVal}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, accentColor: 'var(--text)' }}
        />
        <span style={{
          minWidth: 50,
          textAlign: 'right',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 6px',
          color: 'var(--text-2)',
          fontSize: 12,
        }}>
          {numVal}{field.unit ?? ''}
        </span>
      </div>
    )
  }

  if (field.type === 'select' && 'themeField' in field && field.themeField === 'logoShape') {
    const current = (value as string) || 'rounded'
    const shapes = [
      { value: 'square', label: 'Kare', rx: 2 },
      { value: 'rounded', label: 'Yuvarlak', rx: 8 },
      { value: 'circle', label: 'Daire', rx: 18 },
    ]
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {shapes.map((s) => {
          const active = current === s.value
          return (
            <button
              key={s.value}
              type="button"
              title={s.label}
              onClick={() => onChange(s.value)}
              style={{
                flex: 1, height: 44,
                border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                borderRadius: 9,
                background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                cursor: 'pointer',
                transition: 'border-color 120ms, background 120ms, color 120ms',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <rect x="4" y="4" width="20" height="20" rx={s.rx} fill="currentColor" opacity="0.85" />
              </svg>
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'select') {
    return (
      <select
        id={controlId}
        value={value || field.options?.[0]?.value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 32,
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 12.5,
          padding: '0 9px',
          cursor: 'pointer',
        }}
      >
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }

  if (field.type === 'toggle') {
    const boolVal = value === 'true'
    return (
      <button
        type="button"
        id={controlId}
        role="switch"
        aria-checked={boolVal}
        onClick={() => onChange(boolVal ? 'false' : 'true')}
        style={{
          width: 38,
          height: 22,
          justifySelf: 'start',
          borderRadius: 999,
          border: 'none',
          background: boolVal ? 'var(--text)' : 'var(--surface-3)',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: boolVal ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'left 150ms',
        }} />
      </button>
    )
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        id={controlId}
        value={value}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        style={{
          ...sectionInputStyle,
          height: 70,
          paddingTop: 8,
          resize: 'vertical',
          lineHeight: 1.35,
        }}
      />
    )
  }

  return (
    <input
      id={controlId}
      type={field.type === 'url' ? 'url' : 'text'}
      value={value}
      placeholder={field.placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={sectionInputStyle}
    />
  )
}

function PropertyControl({ field, value, onChange, controlId }: {
  field: SettingField
  value: unknown
  onChange: (v: unknown) => void
  controlId: string
}) {
  if (field.type === 'color') {
    return (
      <div style={{
        height: 32,
        display: 'flex',
        alignItems: 'center',
        border: '1px solid var(--border-strong)',
        borderRadius: 7,
        overflow: 'hidden',
        background: 'var(--surface)',
      }}>
        <input
          id={`${controlId}-color`}
          type="color"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 34, height: 32, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }}
        />
        <input
          id={controlId}
          type="text"
          value={value as string}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1,
            minWidth: 0,
            height: '100%',
            border: 'none',
            outline: 'none',
            borderLeft: '1px solid var(--border-strong)',
            padding: '0 9px',
            fontSize: 12.5,
            color: 'var(--text)',
            background: 'transparent',
          }}
        />
      </div>
    )
  }
  if (field.type === 'range' && field.themeField === 'cols') {
    const numVal = Number(value || 2)
    return (
      <div style={{ display: 'flex', gap: 6 }}>
        {([1, 2, 3] as const).map((col) => {
          const active = numVal === col
          return (
            <button
              key={col}
              type="button"
              title={`${col} sütun`}
              onClick={() => onChange(col)}
              style={{
                flex: 1, height: 44,
                border: active ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                borderRadius: 9,
                background: active ? 'var(--accent-soft)' : 'var(--surface-2)',
                color: active ? 'var(--accent)' : 'var(--text-3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                transition: 'border-color 120ms, background 120ms, color 120ms',
              }}
            >
              <svg width="28" height="22" viewBox="0 0 28 22" fill="none">
                {col === 1 && <rect x="3" y="3" width="22" height="16" rx="2.5" fill="currentColor" opacity="0.85" />}
                {col === 2 && <><rect x="3" y="3" width="10" height="16" rx="2.5" fill="currentColor" opacity="0.85" /><rect x="15" y="3" width="10" height="16" rx="2.5" fill="currentColor" opacity="0.85" /></>}
                {col === 3 && <><rect x="2" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" /><rect x="10.5" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" /><rect x="19" y="3" width="7" height="16" rx="2" fill="currentColor" opacity="0.85" /></>}
              </svg>
            </button>
          )
        })}
      </div>
    )
  }
  if (field.type === 'range') {
    const fallback = field.default ?? field.min ?? 0
    const parsed = Number(value ?? fallback)
    const numVal = Number.isFinite(parsed) ? parsed : Number(fallback) || 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 32 }}>
        <input
          id={controlId}
          type="range"
          min={field.min}
          max={field.max}
          step={field.step}
          value={numVal}
          onChange={(e) => onChange(Number(e.target.value))}
          style={{ flex: 1, accentColor: 'var(--text)' }}
        />
        <span style={{
          minWidth: 46,
          textAlign: 'right',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '3px 6px',
          color: 'var(--text-2)',
          fontSize: 12,
        }}>
          {numVal}{field.unit ?? ''}
        </span>
      </div>
    )
  }
  if (field.type === 'toggle') {
    const boolVal = Boolean(value)
    return (
      <button
        type="button"
        id={controlId}
        role="switch"
        aria-checked={boolVal}
        onClick={() => onChange(!boolVal)}
        style={{
          width: 38,
          height: 22,
          justifySelf: 'start',
          borderRadius: 999,
          border: 'none',
          background: boolVal ? 'var(--text)' : 'var(--surface-3)',
          position: 'relative',
          cursor: 'pointer',
        }}
      >
        <span style={{
          position: 'absolute',
          top: 3,
          left: boolVal ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.2)',
          transition: 'left 150ms',
        }} />
      </button>
    )
  }
  if (field.type === 'select' || field.type === 'font') {
    return (
      <select
        id={controlId}
        value={value as string}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: 32,
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 12.5,
          padding: '0 9px',
          cursor: 'pointer',
        }}
      >
        {(field.options ?? []).map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    )
  }
  if (field.type === 'text') {
    return (
      <input
        id={controlId}
        type="text"
        value={(value as string | undefined) ?? ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          minWidth: 0,
          height: 32,
          borderRadius: 7,
          border: '1px solid var(--border-strong)',
          background: 'var(--surface)',
          color: 'var(--text)',
          fontSize: 12.5,
          padding: '0 9px',
          outline: 'none',
        }}
      />
    )
  }
  return null
}

function SegmentButton({ active = false, icon, label, onClick }: {
  active?: boolean
  icon: React.ReactNode
  label: string
  onClick?: () => void
}) {
  return (
    <button type="button" onClick={onClick} style={{
      height: 30,
      border: 'none',
      borderRadius: 7,
      background: active ? 'var(--surface)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-2)',
      boxShadow: active ? 'var(--shadow-1)' : 'none',
      padding: '0 12px',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      fontSize: 13,
      fontWeight: 650,
      cursor: 'pointer',
    }}>
      {icon}
      {label}
    </button>
  )
}

function IconButton({ children, title, disabled = false, onClick }: {
  children: React.ReactNode
  title: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        border: 'none',
        background: 'transparent',
        color: disabled ? 'var(--text-4)' : 'var(--text-2)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {children}
    </button>
  )
}

function IconShell({ children, title, onClick }: {
  children: React.ReactNode
  title: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
      width: 26,
      height: 26,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 6,
      color: 'var(--text-3)',
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
    }}>
      {children}
    </button>
  )
}

function PlanBadge({ plan }: { plan: keyof typeof SECTION_PLAN_META }) {
  const meta = SECTION_PLAN_META[plan]
  return (
    <span style={{
      position: 'absolute',
      top: 14,
      left: 14,
      height: 24,
      padding: '0 12px',
      borderRadius: 999,
      background: meta.bg,
      color: meta.fg,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontSize: 12,
      fontWeight: 900,
      letterSpacing: '.03em',
      boxShadow: '0 1px 0 rgba(255,255,255,.75) inset',
      zIndex: 2,
    }}>
      {plan === 'pro' && (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5Zm-3 8V7a3 3 0 1 1 6 0v3H9Z" />
        </svg>
      )}
      {meta.label}
    </span>
  )
}

function SectionMiniPreview({ id }: { id: string }) {
  const shell: React.CSSProperties = {
    height: 124,
    border: '1px solid var(--divider)',
    borderRadius: 9,
    background: 'var(--surface)',
    overflow: 'hidden',
    position: 'relative',
  }
  if (id === 'hero-banner') return (
    <div style={{ ...shell, padding: 12, background: 'linear-gradient(135deg, #a13b7a, #d97757)', color: '#fff' }}>
      <div style={{ position: 'absolute', left: 18, bottom: 18 }}>
        <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' }}>GÜN ÖZEL</div>
        <div style={{ fontSize: 22, lineHeight: 1, fontWeight: 900 }}>Künefe<br />Tabağı</div>
        <div style={{ marginTop: 8, width: 88, height: 20, borderRadius: 999, background: '#fff' }} />
      </div>
    </div>
  )
  if (id === 'mode-tabs') return (
    <div style={{ ...shell, padding: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 22 }}>
        {['Salon', 'Paket', 'Teslimat'].map((label, index) => (
          <div key={label} style={{ height: 28, borderRadius: 999, background: index === 0 ? 'var(--text)' : 'var(--surface-3)', color: index === 0 ? '#fff' : 'var(--text-3)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 750 }}>{label}</div>
        ))}
      </div>
    </div>
  )
  if (id === 'address-bar' || id === 'search') return (
    <div style={{ ...shell, padding: 24 }}>
      <div style={{ height: 36, borderRadius: 10, border: '1px solid var(--border)', marginTop: 18, display: 'flex', alignItems: 'center', padding: '0 13px', color: 'var(--text-3)', fontSize: 12 }}>
        {id === 'search' ? 'Ürün ara...' : 'Bağdat Cd. No: 128/A'}
        <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>→</span>
      </div>
    </div>
  )
  if (id === 'promo-strip') return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center' }}>
      <div style={{ width: '100%', height: 34, background: '#1c1d20', color: '#ffd089', display: 'flex', alignItems: 'center', paddingLeft: 14, fontSize: 12, fontWeight: 850, whiteSpace: 'nowrap' }}>
        İLK SİPARİŞE %20 İNDİRİM · BUGÜNE ÖZEL
      </div>
    </div>
  )
  if (id.includes('cat') || id === 'quick-links') return (
    <div style={{ ...shell, padding: 22 }}>
      <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
        {['Tümü', 'Kahvaltı', 'Kahve'].map((label, index) => (
          <div key={label} style={{ height: id === 'cat-images' ? 54 : 28, minWidth: id === 'cat-images' ? 54 : 70, borderRadius: id === 'cat-underline' ? 0 : 999, borderBottom: id === 'cat-underline' && index === 0 ? '2px solid var(--text)' : undefined, background: index === 0 && id !== 'cat-underline' ? 'var(--accent)' : 'var(--surface-3)', color: index === 0 && id !== 'cat-underline' ? '#fff' : 'var(--text-2)', display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 750 }}>{label}</div>
        ))}
      </div>
    </div>
  )
  if (id === 'featured-scroll' || id === 'minimal-list') return (
    <div style={{ ...shell, padding: 18 }}>
      <div style={{ display: id === 'featured-scroll' ? 'flex' : 'grid', gap: 8, marginTop: 18 }}>
        {[0, 1, 2].map((item) => (
          <div key={item} style={{ width: id === 'featured-scroll' ? 72 : undefined, height: id === 'featured-scroll' ? 68 : 20, borderRadius: 8, background: item === 0 ? 'var(--accent-soft)' : 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
  if (id === 'chef-pick') return (
    <div style={{ ...shell, padding: 14, background: '#171717', color: '#fff' }}>
      <div style={{ width: 78, height: 10, borderRadius: 999, background: '#ffd089' }} />
      <div style={{ marginTop: 10, width: 130, height: 16, borderRadius: 999, background: 'rgba(255,255,255,.22)' }} />
      <div style={{ display: 'grid', gap: 7, marginTop: 14 }}>
        {[0, 1, 2].map((item) => (
          <div key={item} style={{ height: 20, borderRadius: 8, background: item === 0 ? 'rgba(255,208,137,.95)' : 'rgba(255,255,255,.14)' }} />
        ))}
      </div>
    </div>
  )
  if (id === 'combo-ribbon') return (
    <div style={{ ...shell, padding: 8, background: '#fff7c9' }}>
      <div style={{ height: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {[
          { color: '#8bbfb8', label: '-30%' },
          { color: '#c9776d', label: '-20%' },
          { color: '#ead294', label: '-15%' },
        ].map((item, index) => (
          <div
            key={item.color}
            style={{
              borderRadius: 6,
              background: item.color,
              color: '#fff',
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: 9,
              fontSize: 16,
              fontWeight: 900,
              overflow: 'hidden',
            }}
          >
            {index > 0 && (
              <span style={{
                position: 'absolute',
                top: -1,
                left: '50%',
                transform: 'translateX(-50%)',
                minWidth: 54,
                height: 17,
                borderRadius: 4,
                background: '#fff',
                color: item.color,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 8,
                fontWeight: 900,
                letterSpacing: '.04em',
              }}>
                COMBO
              </span>
            )}
            {item.label}
          </div>
        ))}
      </div>
    </div>
  )
  if (id === 'discount-badge') return (
    <div style={{ ...shell, padding: 14, display: 'grid', placeItems: 'center', background: 'var(--surface)' }}>
      <div style={{
        width: 68,
        height: 68,
        borderRadius: 999,
        border: '2px solid #738779',
        color: '#738779',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}>
        <span style={{ fontSize: 9, fontWeight: 850, letterSpacing: '.04em' }}>FALL</span>
        <span style={{ fontSize: 21, fontWeight: 950, margin: '3px 0' }}>2x1</span>
        <span style={{ fontSize: 8, fontWeight: 850, letterSpacing: '.04em' }}>OFFER</span>
      </div>
    </div>
  )
  if (id === 'daily-special') return (
    <div style={{ ...shell, background: 'var(--surface)' }}>
      <div style={{ height: 72, background: 'linear-gradient(135deg,#b0447d,#e2785e)', padding: 12, color: '#fff' }}>
        <div style={{ width: 70, height: 16, borderRadius: 999, background: '#fff' }} />
        <div style={{ marginTop: 10, width: 118, height: 18, borderRadius: 7, background: 'rgba(255,255,255,.35)' }} />
      </div>
      <div style={{ padding: 12 }}>
        <div style={{ width: 120, height: 9, borderRadius: 999, background: 'var(--surface-3)' }} />
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center' }}>
          <div style={{ width: 42, height: 12, borderRadius: 999, background: 'var(--text)' }} />
          <div style={{ marginLeft: 'auto', width: 54, height: 20, borderRadius: 999, background: 'var(--accent)' }} />
        </div>
      </div>
    </div>
  )
  if (id === 'promo-slider') return (
    <div style={{ ...shell, padding: 12 }}>
      <div style={{ height: 84, borderRadius: 10, background: 'linear-gradient(120deg,#a13b7a,#d4477f)', padding: 11, position: 'relative', overflow: 'hidden' }}>
        <div style={{ width: 64, height: 7, borderRadius: 999, background: 'rgba(255,255,255,.5)' }} />
        <div style={{ marginTop: 8, width: 96, height: 14, borderRadius: 6, background: '#fff' }} />
        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
          <div style={{ flex: 1, height: 18, borderRadius: 6, border: '1.5px dashed rgba(255,255,255,.6)' }} />
          <div style={{ width: 42, height: 18, borderRadius: 6, background: '#fff' }} />
        </div>
        <div style={{ position: 'absolute', right: -8, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, borderRadius: 99, background: 'var(--surface)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 9 }}>
        <div style={{ width: 16, height: 5, borderRadius: 999, background: 'var(--accent)' }} />
        {[0, 1, 2].map((dot) => (
          <div key={dot} style={{ width: 5, height: 5, borderRadius: 999, background: 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
  if (id === 'gallery') return (
    <div style={{ ...shell, padding: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr .8fr', gap: 8 }}>
        <div style={{ height: 88, gridRow: 'span 2', borderRadius: 9, background: 'linear-gradient(135deg,var(--accent-soft),#fff)' }} />
        <div style={{ height: 40, borderRadius: 9, background: '#fce8d3' }} />
        <div style={{ height: 40, borderRadius: 9, background: '#dcf0e1' }} />
      </div>
      <div style={{ marginTop: 9, width: 110, height: 9, borderRadius: 999, background: 'var(--accent)' }} />
    </div>
  )
  return (
    <div style={{ ...shell, padding: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 18 }}>
        {[0, 1, 2, 3].map((item) => (
          <div key={item} style={{ height: 28, borderRadius: 8, background: item === 0 ? 'var(--accent-soft)' : 'var(--surface-3)' }} />
        ))}
      </div>
    </div>
  )
}

const topbarButtonStyle: React.CSSProperties = {
  height: 34,
  padding: '0 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 13,
  fontWeight: 650,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
}

const sectionInputStyle: React.CSSProperties = {
  width: '100%',
  minWidth: 0,
  height: 32,
  borderRadius: 7,
  border: '1px solid var(--border-strong)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12.5,
  padding: '0 9px',
  outline: 'none',
}

const navGroupLabelStyle: React.CSSProperties = {
  padding: '7px 10px 6px',
  fontSize: 11,
  fontWeight: 750,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-3)',
}

function formatTime(date: Date) {
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

function getMessageTargetOrigin(url: string) {
  try {
    return new URL(url).origin
  } catch {
    return '*'
  }
}

function sanitizeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, '-')
}

function useViewportWidth() {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  return width
}

function trapDialogFocus(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== 'Tab') return
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hasAttribute('disabled') && element.offsetParent !== null)

  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
    return
  }
  if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const zoomButtonStyle: React.CSSProperties = {
  width: 28,
  height: 28,
  border: 'none',
  background: 'transparent',
  color: 'var(--text-2)',
  cursor: 'pointer',
}

function PhoneIcon() { return <I.phone size={17} /> }
function DesktopIcon() { return <I.monitor size={17} /> }
function EyeIcon() { return <I.eye size={17} /> }
function SearchIcon() { return <I.search size={17} /> }
function PageIcon() { return <I.page size={17} /> }
function HeaderIcon() { return <I.header size={17} /> }
function ListIcon() { return <I.section size={17} /> }
function CardIcon() { return <I.card size={17} /> }
function CartSmallIcon() { return <I.cart size={17} /> }
function DropletIcon() { return <I.color size={17} /> }
function ThemeIcon() { return <I.palette size={17} /> }
function TypeIcon() { return <I.type size={17} /> }
function LayoutIcon() { return <I.layout size={17} /> }
function ChevronRightIcon() { return <I.chevRight size={17} /> }
function ChevronDownIcon() { return <I.chevDown size={17} /> }
function PlusIcon() { return <I.plus size={17} /> }
function GlobeIcon() { return <I.globe size={17} /> }
function CopyIcon() { return <I.copy size={17} /> }
function HistoryIcon() { return <I.history size={17} /> }
function UndoIcon() { return <I.undo size={17} /> }
function RedoIcon() { return <I.redo size={17} /> }

function LogoUploadCard({
  logoUrl,
  uploading,
  onUpload,
  onRemove,
}: {
  logoUrl: string | null
  uploading: boolean
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  return (
    <div style={{
      borderRadius: 10,
      border: '1.5px dashed var(--border-strong)',
      background: 'var(--surface-2)',
      padding: 12,
      marginBottom: 4,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
    }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={onUpload}
      />
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo"
          style={{
            height: 56,
            maxWidth: 160,
            objectFit: 'contain',
            borderRadius: 8,
          }}
        />
      ) : (
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'var(--surface-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, color: 'var(--text-3)',
        }}>
          <I.tag size={22} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, width: '100%' }}>
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          style={{
            flex: 1,
            height: 32,
            border: '1px solid var(--border-strong)',
            borderRadius: 7,
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 12,
            fontWeight: 500,
            cursor: uploading ? 'not-allowed' : 'pointer',
            opacity: uploading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {uploading ? 'Yükleniyor…' : logoUrl ? 'Değiştir' : 'Logo yükle'}
        </button>
        {logoUrl && (
          <button
            type="button"
            disabled={uploading}
            onClick={onRemove}
            style={{
              height: 32,
              padding: '0 10px',
              border: '1px solid var(--critical-bg, #fee2e2)',
              borderRadius: 7,
              background: 'var(--critical-bg, #fff5f5)',
              color: 'var(--critical, #dc2626)',
              fontSize: 12,
              fontWeight: 500,
              cursor: uploading ? 'not-allowed' : 'pointer',
              opacity: uploading ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            Kaldır
          </button>
        )}
      </div>
      <p style={{ margin: 0, fontSize: 11, color: 'var(--text-3)', textAlign: 'center', lineHeight: 1.4 }}>
        PNG, SVG veya WEBP · Maks 2MB
      </p>
    </div>
  )
}
