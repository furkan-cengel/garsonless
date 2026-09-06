'use client'

import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import type {
  CampaignAudienceContactPage,
  CampaignAudienceInput,
  CampaignAudiencePreview,
  CampaignDeliveryLog,
  CampaignEmailContentMode,
  CampaignEmailDesign,
  CampaignEmailTemplateId,
  CampaignSummary,
  SavedCampaignEmailTemplate,
} from '@garsonless/domain/campaigns'
import {
  DEFAULT_CAMPAIGN_EMAIL_DESIGN,
  EMAIL_CAMPAIGN_TEMPLATES,
  campaignEmailDesignToPlainText,
  normalizeCampaignEmailDesign,
  renderCampaignBuilderEmail,
  renderCampaignTemplateEmail,
} from '@garsonless/domain/campaigns'
import {
  type CustomerSegment,
  type SavedCustomerSegment
} from '@garsonless/domain/customers'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import {
  deleteCampaignEmailTemplateAction,
  getCampaignDeliveryLogAction,
  listCampaignAudienceContactsAction,
  previewCampaignAudienceAction,
  previewCampaignEmailAction,
  saveCampaignEmailTemplateAction,
  sendCampaignAction,
} from '../../lib/actions/campaigns'
import { I, S } from '../../lib/ui'

import { useDashboardDraft, useDashboardDrafts } from '../overlays/DashboardDraftProvider'
import { isCampaignAudienceReady } from './customer-save-policy'


const SEGMENTS: { id: CustomerSegment | ''; label: string }[] = [
  { id: '', label: 'Tümü' },
  { id: 'new', label: 'Yeni müşteriler' },
  { id: 'frequent', label: 'Sık gelenler' },
  { id: 'lapsed', label: 'Uzun süredir gelmeyen' },
  { id: 'consented', label: 'İzinli' },
]
const CampaignEmailBuilder = dynamic(() => import('./CampaignEmailBuilder'), {
  loading: () => <div role="status" className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground"><Spinner aria-hidden="true" />Tasarımcı yükleniyor…</div>,
})
type CampaignTargetValue = 'all' | `builtin:${string}` | `custom:${string}`

function targetToAudience(target: CampaignTargetValue): CampaignAudienceInput {
  if (target.startsWith('builtin:')) {
    const builtinSegment = target.slice('builtin:'.length)
    if (builtinSegment === 'new' || builtinSegment === 'frequent' || builtinSegment === 'lapsed' || builtinSegment === 'consented') {
      return { segmentKind: 'builtin', builtinSegment }
    }
  }
  if (target.startsWith('custom:')) return { segmentKind: 'custom', customSegmentId: target.slice('custom:'.length) }
  return { segmentKind: 'all' }
}

export default function CampaignModal({
  restaurantId,
  restaurantName,
  savedSegments,
  campaigns,
  emailTemplates,
  emailDeliveryEnabled,
  campaignReplyToEmail,
  resendWebhookEnabled,
  initialTarget,
  onClose,
  onSent,
  onEmailTemplatesChange,
}: {
  restaurantId: string
  restaurantName: string
  savedSegments: SavedCustomerSegment[]
  campaigns: CampaignSummary[]
  emailTemplates: SavedCampaignEmailTemplate[]
  emailDeliveryEnabled: boolean
  campaignReplyToEmail: string | null
  resendWebhookEnabled: boolean
  initialTarget: CampaignTargetValue
  onClose: () => void
  onSent: (campaign: CampaignSummary) => void
  onEmailTemplatesChange: (templates: SavedCampaignEmailTemplate[]) => void
}) {
  const [target, setTarget] = useState<CampaignTargetValue>(initialTarget)
  const [name, setName] = useState('Geri kazanım e-postası')
  const [subject, setSubject] = useState('Sizi yeniden aramızda görmek isteriz')
  const [message, setMessage] = useState('Merhaba,\n\nSize özel fırsatlarımız hazır. Menüyü açıp ödüllerinizi kontrol edebilirsiniz.')
  const [contentMode, setContentMode] = useState<Exclude<CampaignEmailContentMode, 'plain'>>('template')
  const [templateId, setTemplateId] = useState<CampaignEmailTemplateId>('announcement')
  const [emailDesign, setEmailDesign] = useState<CampaignEmailDesign>(() => normalizeCampaignEmailDesign(DEFAULT_CAMPAIGN_EMAIL_DESIGN))
  const [customHtml, setCustomHtml] = useState('<div style="padding:32px;background-color:#ffffff;color:#171719"><h1 style="font-size:28px;margin:0 0 16px">{{restaurant_name}}</h1><p style="font-size:16px;line-height:1.6;margin:0">Kampanya içeriğinizi buraya yazın.</p></div>')
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [designPreviewing, setDesignPreviewing] = useState(false)
  const [preview, setPreview] = useState<CampaignAudiencePreview | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(true)
  const [previewTarget, setPreviewTarget] = useState<CampaignTargetValue | null>(null)
  const [sending, setSending] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [audienceContacts, setAudienceContacts] = useState<CampaignAudienceContactPage | null>(null)
  const [audienceContactsLoading, setAudienceContactsLoading] = useState(false)
  const [deliveryLog, setDeliveryLog] = useState<CampaignDeliveryLog | null>(null)
  const [deliveryLogLoading, setDeliveryLogLoading] = useState(false)
  const [emailTemplateName, setEmailTemplateName] = useState('')
  const [emailTemplateSaving, setEmailTemplateSaving] = useState(false)
  const sendRequestId = useRef<string | null>(null)
  const sendLock = useRef(false)
  const templateLock = useRef(false)
  const contactsSequence = useRef(0)
  const logSequence = useRef(0)
  const { requestExit } = useDashboardDrafts()
  const draft = JSON.stringify({ target, name, subject, message, contentMode, templateId, emailDesign, customHtml, emailTemplateName })
  const [savedDraft, setSavedDraft] = useState(draft)
  useDashboardDraft(draft !== savedDraft, sending || emailTemplateSaving, () => {})
  const requestClose = () => requestExit(onClose)

  useEffect(() => {
    let alive = true
    contactsSequence.current += 1
    setAudienceContacts(null)
    setAudienceContactsLoading(false)
    setPreview(null)
    setPreviewTarget(null)
    setPreviewing(true)
    setError(null)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const res = await previewCampaignAudienceAction(restaurantId, targetToAudience(target))
          if (!alive) return
          if ('error' in res) {
            setPreview(null)
            setError(res.error)
          } else {
            setPreview(res)
            setPreviewTarget(target)
          }
        } catch {
          if (alive) { setPreview(null); setError('Alıcı sayısı hesaplanamadı') }
        } finally {
          if (alive) setPreviewing(false)
        }
      })()
    }, 180)
    return () => { alive = false; clearTimeout(timer) }
  }, [restaurantId, target])

  const activeContent = contentMode === 'html'
    ? customHtml
    : contentMode === 'builder'
      ? campaignEmailDesignToPlainText(emailDesign)
      : message

  useEffect(() => {
    let alive = true
    if (contentMode === 'template') {
      setPreviewError(null)
      setDesignPreviewing(false)
      setPreviewHtml(renderCampaignTemplateEmail({
        templateId,
        content: activeContent,
        restaurantName,
      }))
      return () => { alive = false }
    }
    if (contentMode === 'builder') {
      setPreviewError(null)
      setDesignPreviewing(false)
      setPreviewHtml(renderCampaignBuilderEmail({ design: emailDesign, restaurantName }))
      return () => { alive = false }
    }
    setDesignPreviewing(true)
    setPreviewError(null)
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await previewCampaignEmailAction(restaurantId, {
            contentMode,
            templateId: null,
            content: activeContent,
          })
          if (!alive) return
          if ('error' in result) {
            setPreviewHtml('')
            setPreviewError(result.error)
          } else {
            setPreviewHtml(result.html)
          }
        } catch {
          if (alive) { setPreviewHtml(''); setPreviewError('E-posta önizlemesi oluşturulamadı') }
        } finally {
          if (alive) setDesignPreviewing(false)
        }
      })()
    }, 260)
    return () => { alive = false; clearTimeout(timer) }
  }, [activeContent, contentMode, emailDesign, restaurantId, restaurantName, templateId])

  const canSend = emailDeliveryEnabled && !sending && !emailTemplateSaving && isCampaignAudienceReady(target, previewTarget, previewing, preview?.eligibleRecipients ?? 0) && !designPreviewing && !previewError && name.trim().length > 0 && subject.trim().length > 0 && activeContent.trim().length >= 5 && Boolean(previewHtml) && Boolean(preview?.eligibleRecipients)
  const selectedTargetLabel = target === 'all'
    ? 'Tüm müşteriler'
    : target.startsWith('builtin:')
      ? SEGMENTS.find((segment) => segment.id === target.slice('builtin:'.length))?.label ?? 'Segment'
      : `Kayıtlı: ${savedSegments.find((segment) => segment.id === target.slice('custom:'.length))?.name ?? 'Segment'}`

  async function loadAudienceContacts() {
    const sequence = ++contactsSequence.current
    setAudienceContactsLoading(true)
    setError(null)
    try {
      const result = await listCampaignAudienceContactsAction(restaurantId, targetToAudience(target))
      if (sequence !== contactsSequence.current) return
      if ('error' in result) setError(result.error)
      else setAudienceContacts(result)
    } catch {
      if (sequence === contactsSequence.current) setError('Alıcı e-postaları yüklenemedi')
    } finally {
      if (sequence === contactsSequence.current) setAudienceContactsLoading(false)
    }
  }

  async function loadDeliveryLog(campaignId: string) {
    const sequence = ++logSequence.current
    setDeliveryLogLoading(true)
    setDeliveryLog(null)
    setError(null)
    try {
      const result = await getCampaignDeliveryLogAction(restaurantId, campaignId)
      if (sequence !== logSequence.current) return
      if ('error' in result) setError(result.error)
      else setDeliveryLog(result)
    } catch {
      if (sequence === logSequence.current) setError('Gönderim günlüğü yüklenemedi')
    } finally {
      if (sequence === logSequence.current) setDeliveryLogLoading(false)
    }
  }

  async function saveReusableTemplate() {
    const trimmedName = emailTemplateName.trim()
    if (!trimmedName) { setError('Şablon adı gerekli'); return }
    if (templateLock.current || sendLock.current) return
    templateLock.current = true
    setEmailTemplateSaving(true)
    setError(null)
    try {
      const result = await saveCampaignEmailTemplateAction(restaurantId, {
        name: trimmedName,
        subject,
        design: emailDesign,
      })
      if ('error' in result) setError(result.error)
      else {
        onEmailTemplatesChange([result.template, ...emailTemplates.filter((template) => template.id !== result.template.id && template.name.toLocaleLowerCase('tr-TR') !== result.template.name.toLocaleLowerCase('tr-TR'))])
        setEmailTemplateName('')
        setNotice('E-posta şablonu kaydedildi')
      }
    } catch {
      setError('Şablon kaydedilemedi')
    } finally {
      templateLock.current = false
      setEmailTemplateSaving(false)
    }
  }

  async function removeReusableTemplate(templateId: string) {
    if (templateLock.current || sendLock.current) return
    templateLock.current = true
    setEmailTemplateSaving(true)
    setError(null)
    try {
      const result = await deleteCampaignEmailTemplateAction(restaurantId, templateId)
      if ('error' in result) setError(result.error)
      else onEmailTemplatesChange(emailTemplates.filter((template) => template.id !== templateId))
    } catch {
      setError('Şablon silinemedi')
    } finally {
      templateLock.current = false
      setEmailTemplateSaving(false)
    }
  }

  async function handleSend() {
    if (sendLock.current || !canSend) return
    sendLock.current = true
    if (!emailDeliveryEnabled) { setError('E-posta gönderimi yapılandırılmadı'); return }
    setSending(true)
    setError(null)
    setNotice(null)
    const requestId = sendRequestId.current ?? crypto.randomUUID()
    sendRequestId.current = requestId
    try {
      const res = await sendCampaignAction(restaurantId, {
        requestId,
        name,
        subject,
        message: activeContent,
        contentMode,
        templateId: contentMode === 'template' ? templateId : null,
        emailDesign: contentMode === 'builder' ? emailDesign : null,
        audience: targetToAudience(target),
      })
      if ('error' in res) {
        setError(res.error)
        if (res.preview) setPreview(res.preview)
        return
      }
      setPreview(res.preview)
      sendRequestId.current = null
      setSavedDraft(draft)
      onSent(res.campaign)
      setNotice(res.replayed ? 'Bu kampanya isteği daha önce güvenle kuyruğa alınmıştı' : 'Kampanya güvenle kuyruğa alındı')
    } catch {
      setError('Kampanya sonucu doğrulanamadı. Aynı istek güvenle yeniden denenebilir.')
    } finally {
      sendLock.current = false
      setSending(false)
      setConfirming(false)
    }
  }

  return (
    <>
    <Dialog open onOpenChange={(open) => { if (!open) requestClose() }}>
      <DialogContent showCloseButton={!sending && !emailTemplateSaving} className="customer-campaign-dialog max-h-[92dvh] min-h-0 grid-rows-[minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-[940px]">
      <fieldset disabled={sending || emailTemplateSaving} className="customer-campaign-panel" style={{ minWidth: 0, minHeight: 0, margin: 0, padding: 0, border: 0, maxHeight: '92dvh', overflow: 'hidden', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) 300px' }}>
        <div className="customer-campaign-main" style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', maxHeight: 'min(760px, 92dvh)' }}>
          <DialogHeader className="border-b px-5 py-4 pr-12">
            <DialogTitle id="customer-campaign-title">E-posta kampanyası</DialogTitle>
            <DialogDescription id="customer-campaign-description">Yalnız güncel pazarlama izni ve geçerli e-posta adresi olan müşterilere gönderilir.</DialogDescription>
          </DialogHeader>

          <div className="customer-campaign-content" style={{ padding: 18, overflow: 'auto', display: 'grid', gap: 14 }}>
            {!emailDeliveryEnabled && (
              <Alert role="status" className="border-warning/30 bg-warning/10 text-warning"><I.warn size={16} /><AlertDescription className="text-inherit">E-posta gönderimi için Resend yapılandırması eksik. Hedef kitle önizlemesi kullanılabilir; kampanya gönderilemez.</AlertDescription></Alert>
            )}
            <Alert role="status" className={campaignReplyToEmail ? '' : 'border-warning/30 bg-warning/10 text-warning'}>
              <I.mail size={16} />
              <AlertDescription className={campaignReplyToEmail ? undefined : 'text-inherit'}>
                <strong>Gönderen: {restaurantName}</strong>
                {campaignReplyToEmail
                  ? <> · Müşteri yanıtları <strong>{campaignReplyToEmail}</strong> adresine gelir.</>
                  : <> · Yanıt adresi ayarlanmamış. Ayarlar → Mağaza bölümüne işletme e-postası ekleyin.</>}
              </AlertDescription>
            </Alert>
            <Field>
              <FieldLabel>E-posta tasarımı</FieldLabel>
              <ToggleGroup
                variant="outline"
                value={[contentMode]}
                onValueChange={(values) => {
                  const value = values[0]
                  if (value === 'template' || value === 'builder' || value === 'html') {
                    sendRequestId.current = null
                    setContentMode(value)
                  }
                }}
                aria-label="E-posta tasarım modu"
                className="w-full justify-stretch"
              >
                <ToggleGroupItem value="template" className="flex-1">Hazır şablon</ToggleGroupItem>
                <ToggleGroupItem value="builder" className="flex-1">Tasarımcı</ToggleGroupItem>
                <ToggleGroupItem value="html" className="flex-1">Özel HTML</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>Renk, tipografi, görsel, buton ve grid elementleriyle tasarlayın; isterseniz güvenli özel HTML kullanın.</FieldDescription>
            </Field>

            {contentMode === 'template' ? (
              <div className="customer-email-template-grid" role="radiogroup" aria-label="E-posta şablonları">
                {EMAIL_CAMPAIGN_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    role="radio"
                    aria-checked={templateId === template.id}
                    className="customer-email-template-card"
                    onClick={() => { sendRequestId.current = null; setTemplateId(template.id) }}
                  >
                    <span className={`customer-email-template-swatch customer-email-template-swatch-${template.id}`} aria-hidden="true" />
                    <strong>{template.label}</strong>
                    <span>{template.description}</span>
                  </button>
                ))}
              </div>
            ) : null}
            {contentMode === 'builder' ? (
              <div className="grid gap-3">
                <Card className="p-3">
                  <div className="mb-2 text-sm font-semibold">İşletme şablonları</div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                    <Input value={emailTemplateName} onChange={(event) => setEmailTemplateName(event.target.value.slice(0, 80))} placeholder="Şablon adı" aria-label="Kaydedilecek şablon adı" />
                    <Button type="button" variant="outline" size="sm" aria-busy={emailTemplateSaving} disabled={emailTemplateSaving || !emailTemplateName.trim()} onClick={() => { void saveReusableTemplate() }}>{emailTemplateSaving && <Spinner aria-hidden="true" />}Şablonu kaydet</Button>
                  </div>
                  {emailTemplates.length > 0 ? (
                    <div className="mt-3 grid gap-2" role="list" aria-label="Kayıtlı işletme e-posta şablonları">
                      {emailTemplates.map((template) => (
                        <div key={template.id} role="listitem" className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border p-2">
                          <span className="min-w-0 truncate text-sm font-medium">{template.name}</span>
                          <Button type="button" variant="ghost" size="xs" onClick={() => {
                            sendRequestId.current = null
                            setEmailDesign(normalizeCampaignEmailDesign(template.design))
                            if (template.subject) setSubject(template.subject)
                            setNotice(`“${template.name}” şablonu yüklendi`)
                          }}>Yükle</Button>
                          <Button type="button" variant="ghost" size="xs" disabled={emailTemplateSaving} onClick={() => { void removeReusableTemplate(template.id) }} aria-label={`${template.name} şablonunu sil`}>Sil</Button>
                        </div>
                      ))}
                    </div>
                  ) : <FieldDescription className="mt-2">Henüz işletmeye özel kayıtlı şablon yok.</FieldDescription>}
                </Card>
                <CampaignEmailBuilder design={emailDesign} onChange={(next) => { sendRequestId.current = null; setEmailDesign(normalizeCampaignEmailDesign(next)) }} />
              </div>
            ) : null}
            <div className="customer-campaign-fields" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 12 }}>
              <Field><FieldLabel htmlFor="customer-campaign-name">Kampanya adı</FieldLabel><Input id="customer-campaign-name" value={name} onChange={(e) => { sendRequestId.current = null; setName(e.target.value) }} maxLength={80} /></Field>
              <Field><FieldLabel>Hedef segment</FieldLabel>
                <Select value={target} onValueChange={(value) => { if (value && value !== target) { sendRequestId.current = null; contactsSequence.current += 1; setPreview(null); setPreviewTarget(null); setPreviewing(true); setTarget(value as CampaignTargetValue) } }}>
                  <SelectTrigger className="w-full" aria-label="Hedef segment"><SelectValue>{selectedTargetLabel}</SelectValue></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tüm müşteriler</SelectItem>
                    {SEGMENTS.filter((sg) => sg.id).map((sg) => <SelectItem key={sg.id} value={`builtin:${sg.id}`}>{sg.label}</SelectItem>)}
                    {savedSegments.map((sg) => <SelectItem key={sg.id} value={`custom:${sg.id}`}>Kayıtlı: {sg.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field>
              <FieldLabel htmlFor="customer-campaign-subject">E-posta konusu</FieldLabel>
              <Input id="customer-campaign-subject" value={subject} onChange={(e) => { sendRequestId.current = null; setSubject(e.target.value.slice(0, 150)) }} maxLength={150} />
              <FieldDescription className="text-right tabular-nums">{subject.length}/150</FieldDescription>
            </Field>

            <div className="customer-campaign-audience" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 10 }}>
              <AudienceBox label="Segment" value={previewing ? '…' : (preview?.totalCandidates ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Uygun alıcı" value={previewing ? '…' : (preview?.eligibleRecipients ?? 0).toLocaleString('tr-TR')} tone="positive" />
              <AudienceBox label="İzin yok" value={previewing ? '…' : (preview?.skippedNoMarketingConsent ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="E-posta yok/geçersiz" value={previewing ? '…' : (preview?.skippedInvalidContact ?? 0).toLocaleString('tr-TR')} />
              <AudienceBox label="Tekrar e-posta" value={previewing ? '…' : (preview?.skippedDuplicateContact ?? 0).toLocaleString('tr-TR')} />
            </div>
            <div>
              <Button type="button" variant="outline" size="sm" aria-busy={audienceContactsLoading} disabled={audienceContactsLoading || previewing || !preview?.eligibleRecipients} onClick={() => { void loadAudienceContacts() }}>
                {audienceContactsLoading && <Spinner aria-hidden="true" />}{audienceContactsLoading ? 'Alıcılar yükleniyor…' : 'Alıcı e-postalarını göster'}
              </Button>
              {audienceContacts && (
                <Card className="mt-3 overflow-hidden">
                  <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
                    <strong className="text-sm">{selectedTargetLabel} · {audienceContacts.totalEligible.toLocaleString('tr-TR')} izinli alıcı</strong>
                    <Button type="button" variant="ghost" size="xs" onClick={() => setAudienceContacts(null)}>Gizle</Button>
                  </div>
                  <div className="customer-campaign-recipient-list" role="list" aria-label="İzinli kampanya alıcıları">
                    {audienceContacts.contacts.map((contact) => (
                      <div key={contact.customerId} role="listitem" className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-3 border-b px-3 py-2 text-xs last:border-0">
                        <span className="truncate font-medium">{contact.name || 'İsimsiz müşteri'}</span>
                        <span className="truncate font-mono text-muted-foreground">{contact.email}</span>
                      </div>
                    ))}
                  </div>
                  {audienceContacts.truncated && <div className="border-t px-3 py-2 text-xs text-muted-foreground">İlk {audienceContacts.contacts.length.toLocaleString('tr-TR')} alıcı gösteriliyor.</div>}
                </Card>
              )}
            </div>

            {contentMode === 'template' ? (
              <Field>
                <FieldLabel htmlFor="customer-campaign-message">Mesaj</FieldLabel>
                <Textarea id="customer-campaign-message"
                  value={message}
                  onChange={(e) => { sendRequestId.current = null; setMessage(e.target.value.slice(0, 5_000)) }}
                  rows={5}
                  className="min-h-32"
                />
                <FieldDescription className="text-right tabular-nums">{message.length}/5.000</FieldDescription>
              </Field>
            ) : contentMode === 'html' ? (
              <Field>
                <FieldLabel htmlFor="customer-campaign-html">HTML içeriği</FieldLabel>
                <Textarea
                  id="customer-campaign-html"
                  value={customHtml}
                  onChange={(event) => { sendRequestId.current = null; setCustomHtml(event.target.value.slice(0, 100_000)) }}
                  rows={12}
                  spellCheck={false}
                  className="min-h-64 font-mono text-xs"
                />
                <FieldDescription className="flex flex-wrap justify-between gap-2">
                  <span>Kullanılabilir değişken: {'{{restaurant_name}}'}</span>
                  <span className="tabular-nums">{customHtml.length.toLocaleString('tr-TR')}/100.000</span>
                </FieldDescription>
              </Field>
            ) : null}

            {previewError && <Alert variant="destructive" role="alert"><AlertDescription>{previewError}</AlertDescription></Alert>}

            {(error || notice) && (
              <Alert variant={error ? 'destructive' : 'default'} role={error ? 'alert' : 'status'} aria-live="polite"><AlertDescription>{error ?? notice}</AlertDescription></Alert>
            )}
          </div>

          <div className="customer-campaign-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid var(--divider)', background: 'var(--surface)' }}>
            <Button type="button" variant="outline" onClick={requestClose} disabled={sending || emailTemplateSaving}>Kapat</Button>
            <Button type="button" aria-busy={sending} disabled={!canSend} onClick={() => setConfirming(true)}>
              {sending ? <Spinner aria-hidden="true" /> : <I.mail size={13} />}{sending ? 'Gönderiliyor…' : 'Kampanyayı gönder'}
            </Button>
          </div>
        </div>

        <aside aria-label="E-posta önizlemesi ve kampanya geçmişi" className="customer-campaign-history" style={{ borderLeft: '1px solid var(--divider)', background: 'var(--surface-2)', padding: 16, overflow: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-3)', letterSpacing: '.05em', marginBottom: 10 }}>ÖNİZLEME</div>
          <div className="customer-email-preview" aria-busy={designPreviewing}>
            {designPreviewing ? (
              <div role="status" className="customer-email-preview-status"><Spinner aria-hidden="true" />Önizleme hazırlanıyor…</div>
            ) : previewHtml ? (
              <iframe title="E-posta önizlemesi" sandbox="" referrerPolicy="no-referrer" srcDoc={previewHtml} />
            ) : (
              <div className="customer-email-preview-status">Önizleme kullanılamıyor</div>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 750, color: 'var(--text-3)', letterSpacing: '.05em', margin: '18px 0 10px' }}>SON GÖNDERİMLER</div>
          {!resendWebhookEnabled && <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-2 text-[11px] leading-relaxed text-warning">Teslim, açılma ve tıklama takibi için production Resend webhook&apos;u henüz etkin değil. Sağlayıcının kabul ettiği gönderimler yine listelenir.</div>}
          {deliveryLogLoading ? (
            <div role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Spinner aria-hidden="true" />Gönderim günlüğü yükleniyor…</div>
          ) : deliveryLog ? (
            <div>
              <Button type="button" variant="ghost" size="xs" className="mb-2" onClick={() => setDeliveryLog(null)}>← Kampanyalara dön</Button>
              <div className="mb-2 text-sm font-semibold">{deliveryLog.campaignName}</div>
              {deliveryLog.subject && <div className="mb-3 text-xs text-muted-foreground">{deliveryLog.subject}</div>}
              <div className="customer-campaign-log-list grid gap-2" role="list" aria-label="Kampanya gönderim günlüğü">
                {deliveryLog.recipients.map((recipient) => (
                  <div key={recipient.id} role="listitem" className="rounded-lg border bg-background p-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <strong className="min-w-0 truncate text-xs">{recipient.name || 'İsimsiz müşteri'}</strong>
                      <DeliveryStatusPill status={recipient.status} />
                    </div>
                    <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{recipient.email}</div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{recipient.lastEventAt ? new Date(recipient.lastEventAt).toLocaleString('tr-TR') : recipient.sentAt ? new Date(recipient.sentAt).toLocaleString('tr-TR') : 'Gönderim bekleniyor'}</div>
                    {recipient.error && <div className="mt-1 text-[11px] text-destructive">{campaignDeliveryErrorLabel(recipient.error)}</div>}
                  </div>
                ))}
              </div>
              {deliveryLog.truncated && <div className="mt-2 text-xs text-muted-foreground">İlk {deliveryLog.recipients.length.toLocaleString('tr-TR')} kayıt gösteriliyor.</div>}
            </div>
          ) : campaigns.filter((campaign) => campaign.channel === 'email').length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.45 }}>Henüz e-posta kampanyası yok.</div>
          ) : (
            <div style={{ display: 'grid', gap: 9 }}>
              {campaigns.filter((campaign) => campaign.channel === 'email').map((campaign) => (
                <button type="button" key={campaign.id} onClick={() => { void loadDeliveryLog(campaign.id) }} className="customer-campaign-history-card" style={{ border: '1px solid var(--border)', borderRadius: 11, background: 'var(--surface)', padding: 11, textAlign: 'left', cursor: 'pointer' }} aria-label={`${campaign.name} gönderim günlüğünü aç`}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ minWidth: 0, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{campaign.name}</div>
                    <StatusPill status={campaign.status} />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-3)' }}>
                    {campaign.sentCount}/{campaign.recipientCount} gönderildi
                    {campaign.failedCount ? ` · ${campaign.failedCount} hata` : ''}
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>
      </fieldset>
      <style>{`
        .customer-email-template-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
        .customer-email-template-card{min-width:0;min-height:108px;padding:10px;border:1px solid var(--border);border-radius:12px;background:var(--surface);color:var(--text);display:flex;flex-direction:column;gap:5px;text-align:left;cursor:pointer}
        .customer-email-template-card[aria-checked="true"]{border-color:var(--text);box-shadow:0 0 0 1px var(--text)}
        .customer-email-template-card:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
        .customer-email-template-card>span:last-child{font-size:11px;line-height:1.35;color:var(--text-2)}
        .customer-email-template-swatch{height:30px;border-radius:7px;border:1px solid var(--border);background:var(--surface-2)}
        .customer-email-template-swatch-announcement{background:linear-gradient(180deg,#171719 0 40%,#fff 40%)}
        .customer-email-template-swatch-offer{background:linear-gradient(180deg,#f5f5f4 0 18%,#171719 18% 55%,#fff 55%)}
        .customer-email-preview{height:370px;border:1px solid var(--border);border-radius:12px;background:#fff;overflow:hidden}
        .customer-email-preview iframe{width:100%;height:100%;border:0;background:#fff}
        .customer-email-preview-status{height:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:18px;color:var(--text-2);font-size:12px;text-align:center}
        .customer-campaign-recipient-list,.customer-campaign-log-list{max-height:260px;overflow:auto}
        .customer-campaign-history-card:hover{background:var(--surface-3)!important}.customer-campaign-history-card:focus-visible{outline:2px solid var(--focus);outline-offset:2px}
        @media (max-width:760px){.customer-campaign-dialog{max-height:calc(100dvh - 20px)!important}.customer-campaign-panel{display:block!important;max-height:calc(100dvh - 20px)!important;grid-template-columns:1fr!important;overflow-y:auto!important}.customer-campaign-main{max-height:none!important}.customer-campaign-content{overflow:visible!important}.customer-campaign-fields{grid-template-columns:1fr!important}.customer-campaign-audience{grid-template-columns:repeat(2,minmax(0,1fr))!important}.customer-email-template-grid{grid-template-columns:1fr!important}.customer-email-template-card{min-height:88px}.customer-campaign-footer{position:sticky!important;bottom:0!important;z-index:2}.customer-campaign-history{border-left:0!important;border-top:1px solid var(--divider)!important;overflow:visible!important}}
        @media (prefers-reduced-motion:reduce){.customer-email-template-card{transition:none!important}}
      `}</style>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirming} onOpenChange={(open) => { if (!sending) setConfirming(open) }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>E-posta kampanyası gönderilsin mi?</AlertDialogTitle>
          <AlertDialogDescription>{selectedTargetLabel}: {preview?.eligibleRecipients.toLocaleString('tr-TR') ?? 0} izinli alıcıya “{subject}” konulu e-posta gönderilecek. Gönderim başladıktan sonra geri alınamaz.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={sending}>Vazgeç</AlertDialogCancel>
          <AlertDialogAction aria-busy={sending} disabled={!canSend} onClick={(event) => { event.preventDefault(); void handleSend() }}>
            {sending && <Spinner aria-hidden="true" />} {sending ? 'Gönderiliyor…' : 'Gönderimi onayla'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
}

function AudienceBox({ label, value, tone }: { label: string; value: string; tone?: 'positive' }) {
  return (
    <Card size="sm" className={tone === 'positive' ? 'bg-emerald-50 text-emerald-800' : 'bg-muted/40'}>
      <CardHeader><CardTitle className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</CardTitle></CardHeader>
      <CardContent><div className="text-xl font-semibold tabular-nums" style={S.mono}>{value}</div></CardContent>
    </Card>
  )
}

function StatusPill({ status }: { status: CampaignSummary['status'] }) {
  const meta = status === 'sent'
    ? { label: 'Gönderildi', variant: 'positive' as const }
    : status === 'failed'
      ? { label: 'Hata', variant: 'destructive' as const }
      : status === 'sending'
        ? { label: 'Gönderiliyor', variant: 'warning' as const }
        : { label: status, variant: 'secondary' as const }
  return <Badge variant={meta.variant}>{meta.label}</Badge>
}

function campaignDeliveryErrorLabel(error: string): string {
  if (error === 'configuration_unavailable') return 'E-posta sağlayıcısı yapılandırılmadı'
  if (error === 'provider_rejected') return 'Sağlayıcı gönderimi reddetti'
  if (error === 'delivery_unknown') return 'Gönderim sonucu doğrulanamadı'
  return 'Gönderim başarısız'
}

function DeliveryStatusPill({ status }: { status: CampaignDeliveryLog['recipients'][number]['status'] }) {
  const labels: Record<typeof status, string> = {
    pending: 'Kuyrukta', processing: 'Gönderiliyor', accepted: 'Kabul edildi', delivered: 'Teslim edildi',
    delayed: 'Gecikti', opened: 'Açıldı', clicked: 'Tıklandı', bounced: 'Geri döndü',
    complained: 'Spam bildirimi', suppressed: 'Baskılandı', failed: 'Hata',
  }
  const variant = status === 'failed' || status === 'bounced' || status === 'complained'
    ? 'destructive' as const
    : status === 'delivered' || status === 'opened' || status === 'clicked'
      ? 'positive' as const
      : status === 'delayed' || status === 'suppressed'
        ? 'warning' as const
        : 'secondary' as const
  return <Badge variant={variant}>{labels[status]}</Badge>
}

