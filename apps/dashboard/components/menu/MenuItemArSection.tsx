'use client'

import { useCallback, useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Box } from 'lucide-react'
import type { MenuArItemState } from '@garsonless/application/menu-ar'
import { AR_MODEL_MIME } from '@garsonless/domain/ar-model'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { MediaInput } from '../media-library/MediaInput'
import type { SelectedMedia } from '../media-library/MediaLibrary'
import {
  publishMenuItemArAction,
  readMenuItemArAction,
  saveMenuItemArDraftAction,
  unpublishMenuItemArAction,
} from '../../lib/actions/menu-ar'
import { S } from '../../lib/ui'
import {
  MENU_AR_STATUS_COPY,
  isMenuArFormDirty,
  menuArDraftSizes,
  menuArFormFromVersion,
  menuArPosterUrl,
  menuArStatus,
  type MenuArForm,
  type MenuArSizeField,
} from './menu-item-ar-model'

const MenuArModelPreview = dynamic(() => import('./MenuArModelPreview').then((m) => m.MenuArModelPreview), { ssr: false })

const SIZE_FIELDS: { field: MenuArSizeField; label: string }[] = [
  { field: 'width', label: 'Genişlik' },
  { field: 'depth', label: 'Derinlik' },
  { field: 'height', label: 'Yükseklik' },
]

/**
 * 3D model and AR for one product. Versions are saved and published on their
 * own, apart from the product form: a model change never rides along with a
 * price edit, and publishing always follows an explicit visual check.
 */
export function MenuItemArSection({ restaurantId, itemId, itemName, imageUrl }: {
  restaurantId: string
  itemId: string
  itemName: string
  imageUrl: string | null
}) {
  const id = useId()
  const [state, setState] = useState<MenuArItemState | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [form, setForm] = useState<MenuArForm>(() => menuArFormFromVersion(null))
  const [error, setError] = useState<string | null>(null)
  const [sizeError, setSizeError] = useState<{ field: MenuArSizeField; error: string } | null>(null)
  const [checked, setChecked] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const glbInput = useRef<HTMLInputElement>(null)
  const usdzInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    setLoadError(null)
    const result = await readMenuItemArAction({ restaurantId, menuItemId: itemId })
    if (!result.ok) {
      setLoadError(result.error)
      return
    }
    setState(result.value)
    setForm(menuArFormFromVersion(result.value.draft))
    setChecked(false)
  }, [restaurantId, itemId])

  useEffect(() => { void load() }, [load])

  if (loadError) {
    return (
      <Wrapper>
        <div role="status" className="grid gap-2 text-[11.5px] text-muted-foreground">
          <span>{loadError}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>Yeniden dene</Button>
        </div>
      </Wrapper>
    )
  }
  if (!state) return null
  const status = menuArStatus(state)
  // Restaurants outside the pilot see nothing unless a model is still live.
  if (!state.accessEnabled && !state.publishedVersionId) return null

  const dirty = isMenuArFormDirty(form, state.draft)
  const poster = menuArPosterUrl(imageUrl, restaurantId)
  const copy = MENU_AR_STATUS_COPY[status]

  function pick(kind: 'glb' | 'usdz', rows: SelectedMedia[]) {
    const row = rows[0]
    if (!row) return
    if (row.asset.mime !== AR_MODEL_MIME[kind]) {
      setError(kind === 'glb' ? 'Bu alan için GLB dosyası seçin.' : 'Bu alan için USDZ dosyası seçin.')
      return
    }
    setError(null)
    setNotice(null)
    setForm((current) => kind === 'glb'
      ? { ...current, glbAssetId: row.asset.id, glbUrl: row.url, glbName: row.asset.name }
      : { ...current, usdzAssetId: row.asset.id, usdzName: row.asset.name })
  }

  function save() {
    if (!form.glbAssetId) {
      setError('Önce GLB modelini seçin.')
      return
    }
    const sizes = menuArDraftSizes(form)
    if (!sizes.ok) {
      setSizeError(sizes)
      return
    }
    setSizeError(null)
    setError(null)
    startTransition(async () => {
      const result = await saveMenuItemArDraftAction({
        restaurantId,
        menuItemId: itemId,
        glbAssetId: form.glbAssetId!,
        usdzAssetId: form.usdzAssetId,
        posterUrl: poster,
        widthMm: sizes.widthMm,
        depthMm: sizes.depthMm,
        heightMm: sizes.heightMm,
        portionNote: form.portionNote.trim() || null,
      })
      if (!result.ok) {
        setError(result.error)
        return
      }
      await load()
      setNotice('Taslak kaydedildi. Önizlemeyi ve ölçüleri kontrol edip yayınlayın.')
    })
  }

  function publish() {
    if (!state?.draft) return
    const versionId = state.draft.id
    setError(null)
    startTransition(async () => {
      const result = await publishMenuItemArAction({ restaurantId, menuItemId: itemId, versionId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setState((current) => current && { ...current, publishedVersionId: versionId })
      setChecked(false)
      setNotice('Model menüde yayında. Misafirler ürün kartında “3D incele” görür.')
    })
  }

  function unpublish() {
    setError(null)
    startTransition(async () => {
      const result = await unpublishMenuItemArAction({ restaurantId, menuItemId: itemId })
      if (!result.ok) {
        setError(result.error)
        return
      }
      setState((current) => current && { ...current, publishedVersionId: null })
      setNotice('Model menüden kaldırıldı. Taslak saklanıyor.')
    })
  }

  return (
    <Wrapper badge={<Badge variant={copy.tone}>{copy.label}</Badge>}>
      <div className="grid gap-3 text-[12px]">
        {!state.accessEnabled && (
          <Alert>
            <AlertDescription>3D ve AR bu işletmede kapatıldı; model misafirlere gösterilmiyor. İsterseniz menüden kaldırabilirsiniz.</AlertDescription>
          </Alert>
        )}

        {state.accessEnabled && (
          <>
            <ModelRow
              title="GLB · 3D görünüm ve Android"
              name={form.glbName}
              empty="Henüz seçilmedi"
              onPick={() => glbInput.current?.click()}
              disabled={pending}
            />
            <ModelRow
              title="USDZ · iPhone’da masada gör"
              name={form.usdzName}
              empty="İsteğe bağlı. Yoksa iPhone için GLB’den otomatik dönüştürülür; en iyi sonuç için ekleyin."
              onPick={() => usdzInput.current?.click()}
              onRemove={form.usdzAssetId ? () => setForm((current) => ({ ...current, usdzAssetId: null, usdzName: '' })) : undefined}
              disabled={pending}
            />
            <MediaInput ref={glbInput} className="sr-only" tabIndex={-1} aria-hidden restaurantId={restaurantId} context="menu" purpose="model" onMedia={(rows) => pick('glb', rows)} />
            <MediaInput ref={usdzInput} className="sr-only" tabIndex={-1} aria-hidden restaurantId={restaurantId} context="menu" purpose="model" onMedia={(rows) => pick('usdz', rows)} />

            {form.glbUrl && <MenuArModelPreview src={form.glbUrl} poster={poster} label={`${itemName} 3D modeli`} />}

            <div>
              <div className="mb-1 text-[11.5px] text-muted-foreground">Gerçek ölçü (cm) · tabak veya bardak dahil. AR’da ürün bu boyutta görünür.</div>
              <div className="grid grid-cols-3 gap-2">
                {SIZE_FIELDS.map(({ field, label }) => (
                  <Field key={field} data-invalid={sizeError?.field === field} className="gap-1">
                    <FieldLabel htmlFor={`${id}-${field}`} className="text-[11px] font-normal text-muted-foreground">{label}</FieldLabel>
                    <Input
                      id={`${id}-${field}`}
                      inputMode="decimal"
                      value={form[field]}
                      aria-invalid={sizeError?.field === field}
                      onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))}
                      className="h-8"
                    />
                  </Field>
                ))}
              </div>
              {sizeError && <FieldError className="mt-1">{sizeError.error}</FieldError>}
            </div>

            <Field className="gap-1">
              <FieldLabel htmlFor={`${id}-portion`} className="text-[11px] font-normal text-muted-foreground">Porsiyon notu</FieldLabel>
              <Input
                id={`${id}-portion`}
                maxLength={120}
                placeholder="Örn. 2 kişilik, 26 cm tabakta"
                value={form.portionNote}
                onChange={(event) => setForm((current) => ({ ...current, portionNote: event.target.value }))}
                className="h-8"
              />
            </Field>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {poster
                ? 'Model yüklenirken ürünün ilk fotoğrafı kapak olarak gösterilir.'
                : 'Ürüne fotoğraf eklerseniz model yüklenirken kapak olarak gösterilir.'}
            </p>
          </>
        )}

        {error && <Alert variant="destructive" role="alert"><AlertDescription>{error}</AlertDescription></Alert>}
        {notice && !error && <p role="status" className="text-[11.5px] text-[var(--positive)]">{notice}</p>}

        <div className="grid gap-2">
          {state.accessEnabled && dirty && (
            <Button type="button" size="sm" onClick={save} disabled={pending || !form.glbAssetId}>
              {pending && <Spinner className="size-3.5" />}Taslağı kaydet
            </Button>
          )}
          {state.accessEnabled && !dirty && state.draft && status !== 'live' && (
            <>
              <label className="flex items-start gap-2 text-[11.5px] leading-snug">
                <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} className="mt-0.5" />
                <span>Görünümü ve ölçüyü kontrol ettim. Model gerçek ürünle aynı porsiyonu gösteriyor.</span>
              </label>
              <Button type="button" size="sm" onClick={publish} disabled={pending || !checked}>
                {pending && <Spinner className="size-3.5" />}Menüde yayınla
              </Button>
            </>
          )}
          {(status === 'live' || status === 'live-changed') && (
            <Button type="button" size="sm" variant="outline" onClick={unpublish} disabled={pending}>
              Menüden kaldır
            </Button>
          )}
        </div>
      </div>
    </Wrapper>
  )
}

function Wrapper({ badge, children }: { badge?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--divider)' }}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div style={S.label}>3D ve AR</div>
        {badge}
      </div>
      {children}
    </div>
  )
}

function ModelRow({ title, name, empty, onPick, onRemove, disabled }: {
  title: string
  name: string
  empty: string
  onPick: () => void
  onRemove?: () => void
  disabled: boolean
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border p-2.5">
      <Box className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="font-medium">{title}</span>
        <span className="truncate text-[11.5px] text-muted-foreground" title={name || undefined}>{name || empty}</span>
      </div>
      <div className="flex shrink-0 gap-1">
        {onRemove && <Button type="button" size="xs" variant="ghost" onClick={onRemove} disabled={disabled}>Kaldır</Button>}
        <Button type="button" size="xs" variant="outline" onClick={onPick} disabled={disabled}>{name ? 'Değiştir' : 'Seç'}</Button>
      </div>
    </div>
  )
}
