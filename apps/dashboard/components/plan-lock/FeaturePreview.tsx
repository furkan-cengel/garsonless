'use client'

import { useEffect, useRef } from 'react'
import type { BillableFeature } from '@garsonless/domain/entitlements'
import { Badge } from '../ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table'
import OrderCard from '../orders/OrderCard'
import type { Order } from '../orders/useOrdersRealtime'
import { getPlanLockPresentation } from './presentation'

const demoNow = Date.parse('2026-09-08T12:00:00Z')
const orders: Order[] = ['pending', 'preparing', 'ready'].map((status, index) => ({
  id: `preview-order-${index}`, restaurant_id: 'preview', table_id: `preview-table-${index}`,
  status: status as Order['status'], source: 'staff', customer_tier: null, paid_at: null,
  items: [{ name: 'Latte', price: 150, quantity: 2 }, { name: 'Cheesecake', price: 240, quantity: 1 }],
  total: 540, created_at: new Date(demoNow - (index + 2) * 60_000).toISOString(),
}))

function PreviewTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return <Card className="gap-0 py-0"><Table><TableHeader><TableRow>{columns.map(column => <TableHead key={column}>{column}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.map((row, index) => <TableRow key={index}>{row.map((cell, column) => <TableCell key={column}>{cell}</TableCell>)}</TableRow>)}</TableBody></Table></Card>
}

function QrPreview() {
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let active = true
    void import('qr-code-styling').then(({ default: QRCodeStyling }) => {
      if (!active || !host.current) return
      host.current.replaceChildren()
      new QRCodeStyling({ width: 220, height: 220, type: 'svg', data: 'https://menu.masabu.co', margin: 12, dotsOptions: { color: '#2f6f4e', type: 'rounded' } }).append(host.current)
    }).catch(() => undefined)
    return () => { active = false }
  }, [])
  return <Card><CardHeader><CardTitle>Masa 04</CardTitle><CardDescription>Masaya özel QR kod</CardDescription></CardHeader><CardContent className="flex flex-col items-center gap-4"><div ref={host} /><Badge variant="secondary">Dijital menü</Badge></CardContent></Card>
}

function FeatureContent({ feature }: { feature: BillableFeature }) {
  if (feature === 'staff_orders' || feature === 'kitchen_display') return <div className="grid gap-3">{orders.map((order, index) => <OrderCard key={order.id} order={order} tableLabel={`Masa ${String(index + 4).padStart(2, '0')}`} now={demoNow} />)}</div>
  if (feature === 'table_management') return <div className="grid grid-cols-2 gap-3">{['04', '05', '06', '07', '08', '09'].map((table, index) => <Card key={table}><CardHeader><CardDescription>ANA SALON</CardDescription><CardTitle>Masa {table}</CardTitle></CardHeader><CardContent className="flex items-center justify-between"><Badge variant={index % 3 ? 'warning' : 'secondary'}>{index % 3 ? 'Hesap açık' : 'Müsait'}</Badge><span className="font-mono text-sm">{index % 3 ? '₺540' : '4 kişi'}</span></CardContent></Card>)}</div>
  if (feature === 'customer_accounts' || feature === 'loyalty') return <><div className="mb-4 grid grid-cols-2 gap-3"><Card><CardHeader><CardDescription>Sadakat programı</CardDescription><CardTitle>Puan kazanımı</CardTitle></CardHeader><CardContent><Badge variant="positive">Aktif</Badge></CardContent></Card><Card><CardHeader><CardDescription>Müşteri segmentleri</CardDescription><CardTitle>Yeni · Düzenli · VIP</CardTitle></CardHeader></Card></div><PreviewTable columns={['Müşteri', 'Seviye', 'Ziyaret', 'Puan']} rows={[["Örnek müşteri 01", 'VIP', '24', '480'], ['Örnek müşteri 02', 'Düzenli', '12', '240'], ['Örnek müşteri 03', 'Yeni', '2', '40']]} /></>
  if (feature === 'qr_studio') return <QrPreview />
  if (feature === 'theme_editor') return <><Card className="mb-4"><CardHeader><CardTitle>Görünüm</CardTitle><CardDescription>Menünüzün marka kimliği</CardDescription></CardHeader><CardContent className="grid gap-4"><div className="flex items-center justify-between"><span>Yazı tipi</span><Badge variant="secondary">Geist</Badge></div><div className="flex items-center justify-between"><span>Vurgu rengi</span><Badge variant="positive">Masabu yeşili</Badge></div><div className="flex items-center justify-between"><span>Kart düzeni</span><Badge variant="secondary">Izgara</Badge></div></CardContent></Card><MenuPreview /></>
  if (feature === 'team_management') return <PreviewTable columns={['Ekip üyesi', 'Rol', 'Durum']} rows={[["Örnek ekip üyesi 01", 'Yönetici', 'Aktif'], ['Örnek ekip üyesi 02', 'Garson', 'Aktif'], ['Örnek ekip üyesi 03', 'Mutfak', 'Davet edildi']]} />
  if (feature === 'online_payments') return <Card><CardHeader><CardTitle>İyzico Online Ödeme</CardTitle><CardDescription>Menü üzerinden ödeme</CardDescription></CardHeader><CardContent className="grid gap-5"><div className="flex justify-between"><span>Bağlantı durumu</span><Badge variant="positive">Bağlı</Badge></div><div className="flex justify-between"><span>Ödeme yöntemi</span><span>Kredi / banka kartı</span></div></CardContent></Card>
  if (feature === 'browser_notifications') return <PreviewTable columns={['Bildirim', 'Kanal', 'Durum']} rows={[["Yeni sipariş", 'Tarayıcı', 'Açık'], ['Servis çağrısı', 'Tarayıcı', 'Açık'], ['Sipariş hazır', 'Tarayıcı', 'Açık']]} />
  return <MenuPreview />
}
function MenuPreview() {
  return <PreviewTable columns={['Ürün', 'Kategori', 'Fiyat', 'Durum']} rows={[["Latte", 'Kahveler', '₺150', 'Yayında'], ['Americano', 'Kahveler', '₺120', 'Yayında'], ['Cheesecake', 'Tatlılar', '₺240', 'Yayında'], ['Limonata', 'Soğuk içecekler', '₺130', 'Yayında']]} />
}
export default function FeaturePreview({ feature }: { feature: BillableFeature }) {
  return <div style={{ padding: 24 }}><div style={{ marginBottom: 22 }}><h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{getPlanLockPresentation(feature).label}</h2><p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>İşletme görünümü</p></div><FeatureContent feature={feature} /></div>
}
