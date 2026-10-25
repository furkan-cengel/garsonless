'use client'
import { MediaInput } from '../media-library/MediaInput'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Tables } from '@garsonless/db/types'
import { updateRestaurant } from '../../lib/actions/restaurant'
import { uploadLogo } from '../../lib/dashboard-media-upload-client'
import { I } from '../../lib/ui'
import { Alert, AlertDescription } from '../ui/alert'
import { Attachment, AttachmentMedia } from '../ui/attachment'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Spinner } from '../ui/spinner'
import { FormRow, SCard } from './primitives'
import { notifySettingsSaved, useSettingsDirtyState } from './settings-dirty-state'

export default function WorkspaceSection({ restaurant }: { restaurant: Tables<'restaurants'> }) {
  const router = useRouter()
  const identitySnapshotRef = useRef({ name: restaurant.name, slug: restaurant.slug })
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(restaurant.name)
  const [slug, setSlug] = useState(restaurant.slug)
  const [logoUrl, setLogoUrl] = useState(restaurant.logo_url)
  const [error, setError] = useState('')
  const [logoFeedback, setLogoFeedback] = useState('')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isLogoPending, startLogoTransition] = useTransition()
  const identityDirty = name !== identitySnapshotRef.current.name || slug !== identitySnapshotRef.current.slug
  useSettingsDirtyState('workspace:identity', identityDirty)

  function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    setSaved(false)
    startTransition(async () => {
      const formData = new FormData()
      formData.append('id', restaurant.id)
      formData.append('name', name)
      formData.append('slug', slug)
      const result = await updateRestaurant(formData)
      if ('error' in result) {
        setError(result.error)
        return
      }
      identitySnapshotRef.current = { name, slug }
      setSaved(true)
      notifySettingsSaved('workspace:identity')
    })
  }

  function handleLogoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    event.target.value = ''
    setError('')
    setLogoFeedback('')
    startLogoTransition(async () => {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadLogo(restaurant.id, formData)
      if ('error' in result) {
        setError(result.error)
        return
      }
      setLogoUrl(`${result.url}${result.url.includes('?') ? '&' : '?'}v=${Date.now()}`)
      setLogoFeedback('✓ Logo güncellendi')
      notifySettingsSaved()
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSave} aria-busy={isPending || isLogoPending}>
      <SCard
        title="Mağaza kimliği"
        subtitle="Müşterilere ve sisteme gösterilen temel bilgiler"
        footer={(
          <>
            <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
              {isPending
                ? 'Mağaza bilgileri kaydediliyor…'
                : saved
                  ? '✓ Mağaza bilgileri güncellendi'
                  : identityDirty
                    ? 'Kaydedilmemiş değişiklik var'
                    : 'Mağaza bilgileri güncel'}
            </span>
            <Button type="submit" aria-busy={isPending} disabled={isPending || !identityDirty}>
              {isPending ? <Spinner data-icon="inline-start" /> : <I.check data-icon="inline-start" />}
              {isPending ? 'Kaydediliyor…' : 'Kaydet'}
            </Button>
          </>
        )}
      >
        <FormRow label="Mağaza adı" hint="Müşteri menüsü ve faturalarda görünür">
          <Input
            value={name}
            onChange={event => { setName(event.target.value); setSaved(false) }}
            autoComplete="organization"
            className="w-72 max-w-full"
            required
          />
        </FormRow>
        <FormRow label="URL slug" hint={`menu.masabu.co/${slug}`}>
          <Input
            value={slug}
            onChange={event => { setSlug(event.target.value.replace(/[^a-z0-9-]/g, '')); setSaved(false) }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-72 max-w-full font-mono"
            required
          />
        </FormRow>
      </SCard>

      <SCard title="Mağaza logosu" subtitle="Müşteri menüsü ve QR ekranlarında görünür" style={{ marginTop: 16 }}>
        <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
          <MediaInput context="settings" purpose="logo" onMedia={async rows => { if(!rows[0]) return; const data = new FormData(); data.set('assetId',rows[0].asset.id); const result = await uploadLogo(restaurant.id,data); if('error' in result) throw new Error(result.error); setLogoUrl(result.url); setLogoFeedback('Logo güncellendi'); router.refresh(); }}
            ref={logoInputRef}
            accept="image/png,image/jpeg,image/webp"
            hidden
            onChange={handleLogoChange}
            disabled={isLogoPending}
          />
          <Attachment
            state={isLogoPending ? 'uploading' : logoUrl ? 'done' : 'idle'}
            size="sm"
            orientation="vertical"
            className="size-32 shrink-0 overflow-hidden p-0!"
            aria-busy={isLogoPending}
          >
            <AttachmentMedia variant={logoUrl ? 'image' : 'icon'} className="size-full! rounded-none! bg-background">
              {logoUrl
                ? <img src={logoUrl} alt="Mağaza logosu" className="size-full object-cover!" />
                : isLogoPending
                  ? <Spinner />
                  : <I.cutlery />}
            </AttachmentMedia>
          </Attachment>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">
                {isLogoPending ? 'Logo yükleniyor…' : logoFeedback || (logoUrl ? 'Logo yüklendi' : 'Henüz logo yüklenmedi')}
              </div>
              <div className="text-sm leading-relaxed text-muted-foreground">
                Logo önizleme alanını tamamen doldurur. Farklı oranlardaki görseller kenarlardan kırpılabilir. PNG, JPG veya WEBP · en fazla 2 MB.
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              disabled={isLogoPending}
              data-guide="workspace-logo"
              onClick={() => logoInputRef.current?.click()}
            >
              {isLogoPending ? <Spinner data-icon="inline-start" /> : <I.image data-icon="inline-start" />}
              {isLogoPending ? 'Yükleniyor…' : logoUrl ? 'Logoyu değiştir' : 'Logo yükle'}
            </Button>
          </div>
        </div>
      </SCard>

      {error && (
        <Alert variant="destructive" className="mt-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  )
}
