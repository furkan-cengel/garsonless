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
import { campaignDesignIssue } from './campaign-composer-policy'
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
  const [step, setStep] = useState(0)
  const [sideView, setSideView] = useState<'preview' | 'history'>('preview')
  const [previewSize, setPreviewSize] = useState<'wide' | 'mobile'>('wide')
  const [audienceRetry, setAudienceRetry] = useState(0)
  const [queuedDraft, setQueuedDraft] = useState<string | null>(null)
  const [previewSource, setPreviewSource] = useState('')
  const stepHeading = useRef<HTMLHeadingElement>(null)
  const editorScroll = useRef<HTMLDivElement>(null)
  const workspaceScroll = useRef<HTMLDivElement>(null)
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
  const payloadSignature = JSON.stringify({ target, name, subject, message, contentMode, templateId, emailDesign, customHtml })
  const previewSignature = JSON.stringify({ contentMode, templateId, message, emailDesign, customHtml, restaurantName })
  useEffect(() => { editorScroll.current?.scrollTo({ top: 0 }); workspaceScroll.current?.scrollTo({ top: 0 }); stepHeading.current?.focus({ preventScroll: true }) }, [step])
  useEffect(() => { setNotice(null) }, [payloadSignature])
  useEffect(() => { if (queuedDraft) stepHeading.current?.focus({ preventScroll: true }) }, [queuedDraft])

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
  }, [restaurantId, target, audienceRetry])

  const activeContent = contentMode === 'html'
    ? customHtml
    : contentMode === 'builder'
      ? campaignEmailDesignToPlainText(emailDesign)
      : message

  useEffect(() => {
    let alive = true
    setPreviewSource('')
    if (contentMode === 'template') {
      setPreviewError(null)
      setDesignPreviewing(false)
      setPreviewSource(previewSignature)
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
      setPreviewSource(previewSignature)
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
            setPreviewSource(previewSignature)
          }
        } catch {
          if (alive) { setPreviewHtml(''); setPreviewError('E-posta önizlemesi oluşturulamadı') }
        } finally {
          if (alive) setDesignPreviewing(false)
        }
      })()
    }, 260)
    return () => { alive = false; clearTimeout(timer) }
  }, [activeContent, contentMode, emailDesign, restaurantId, restaurantName, templateId, previewSignature])

  const designIssue = contentMode === 'builder' ? campaignDesignIssue(emailDesign) : null
  const canSend = emailDeliveryEnabled && !designIssue && payloadSignature !== queuedDraft && previewSource === previewSignature && !sending && !emailTemplateSaving && isCampaignAudienceReady(target, previewTarget, previewing, preview?.eligibleRecipients ?? 0) && !designPreviewing && !previewError && name.trim().length > 0 && subject.trim().length > 0 && activeContent.trim().length >= 5 && Boolean(previewHtml) && Boolean(preview?.eligibleRecipients)
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
    if (designIssue) { setError(designIssue); return }
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
      setQueuedDraft(payloadSignature)
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
      <DialogContent showCloseButton={!sending && !emailTemplateSaving} className="customer-campaign-dialog min-h-0 gap-0 overflow-hidden p-0 sm:max-w-[1120px]">
        <fieldset disabled={sending || emailTemplateSaving} className="customer-campaign-panel">
          <DialogHeader className="customer-campaign-header">
            <span className="customer-campaign-eyebrow">Müşteriler / E-posta</span>
            <DialogTitle id="customer-campaign-title" className="text-[22px] font-semibold leading-tight">E-posta kampanyası</DialogTitle>
            <DialogDescription id="customer-campaign-description">Müşterilerinize yeniden merhaba deyin.</DialogDescription>
          </DialogHeader>
          <nav aria-label="Kampanya hazırlama adımları" className="customer-campaign-steps">
            {['Alıcılar', 'İçerik', 'Kontrol'].map((label, index) => (
              <button type="button" key={label} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>
                <span aria-hidden="true">{index + 1}</span>{label}
              </button>
            ))}
          </nav>
          <div ref={workspaceScroll} className="customer-campaign-workspace">
            <div ref={editorScroll} className="customer-campaign-main">
              <div className="customer-campaign-content">
                <div className="customer-campaign-section-heading">
                  <h3 ref={stepHeading} tabIndex={-1}>{['Kime ulaşmak istersiniz?', 'Mesajınızı hazırlayın', 'Göndermeden önce son bir bakış'][step]}</h3>
                  <p>{['Kampanyanızı adlandırın ve hedef kitlenizi seçin.', 'Bir şablon seçin; mesajınızın son halini yanında görün.', 'Alıcıları, içeriği ve gönderim durumunu kontrol edin.'][step]}</p>
                </div>
                {step === 0 && <>
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


                <section className="customer-campaign-audience-section" aria-label="Alıcı uygunluğu" aria-busy={previewing}>
                  <div className="customer-campaign-section-label"><strong>Alıcı uygunluğu</strong><span>İzinler otomatik kontrol edilir</span></div>
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


                  {!previewing && !preview && <Button type="button" variant="outline" onClick={() => setAudienceRetry(value => value + 1)}>Alıcıları yeniden hesapla</Button>}
                  {!previewing && preview && preview.eligibleRecipients === 0 && <Alert role="status"><AlertDescription>Bu segmentte gönderime uygun alıcı yok. Başka bir segment seçin veya müşteri e-posta izinlerini kontrol edin.</AlertDescription></Alert>}
                </section>
            <Alert role="status" className={campaignReplyToEmail ? '' : 'border-warning/30 bg-warning/10 text-warning'}>
              <I.mail size={16} />
              <AlertDescription className={campaignReplyToEmail ? undefined : 'text-inherit'}>
                <strong>Gönderen: {restaurantName}</strong>
                {campaignReplyToEmail
                  ? <> · Müşteri yanıtları <strong>{campaignReplyToEmail}</strong> adresine gelir.</>
                  : <> · Yanıt adresi ayarlanmamış. Ayarlar → Mağaza bölümüne işletme e-postası ekleyin.</>}
              </AlertDescription>
            </Alert>

                </>}
                {step === 1 && <>
            <Field>
              <FieldLabel htmlFor="customer-campaign-subject">E-posta konusu</FieldLabel>
              <Input id="customer-campaign-subject" value={subject} onChange={(e) => { sendRequestId.current = null; setSubject(e.target.value.slice(0, 150)) }} maxLength={150} />
              <FieldDescription className="text-right tabular-nums">{subject.length}/150</FieldDescription>
            </Field>


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
              <FieldDescription>Hazır bir tasarımla başlayın veya kendi e-postanızı oluşturun.</FieldDescription>
            </Field>

            {contentMode === 'template' ? (
              <div className="customer-email-template-grid" role="radiogroup" aria-label="E-posta şablonları">
                {EMAIL_CAMPAIGN_TEMPLATES.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    role="radio"
                    aria-checked={templateId === template.id}
                    tabIndex={templateId === template.id ? 0 : -1}
                    onKeyDown={(event) => {
                      const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End']
                      if (!keys.includes(event.key)) return
                      event.preventDefault()
                      const current = EMAIL_CAMPAIGN_TEMPLATES.findIndex(item => item.id === templateId)
                      const next = event.key === 'Home' ? 0 : event.key === 'End' ? EMAIL_CAMPAIGN_TEMPLATES.length - 1 : (current + (event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1) + EMAIL_CAMPAIGN_TEMPLATES.length) % EMAIL_CAMPAIGN_TEMPLATES.length
                      sendRequestId.current = null
                      setTemplateId(EMAIL_CAMPAIGN_TEMPLATES[next]!.id)
                      const radios = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=radio]')
                      radios?.[next]?.focus()
                    }}
                    className="customer-email-template-card"
                    onClick={() => { sendRequestId.current = null; setTemplateId(template.id) }}
                  >
                    <span className={`customer-email-template-swatch customer-email-template-swatch-${template.id}`} aria-hidden="true" />
                    <strong>{template.label}<span aria-hidden="true">{templateId === template.id ? '✓' : ''}</span></strong>
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
                    <Button type="button" variant="outline" size="sm" aria-busy={emailTemplateSaving} disabled={emailTemplateSaving || !emailTemplateName.trim() || Boolean(designIssue)} onClick={() => { void saveReusableTemplate() }}>{emailTemplateSaving && <Spinner aria-hidden="true" />}Şablonu kaydet</Button>
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
                <CampaignEmailBuilder design={emailDesign} onChange={(next) => { sendRequestId.current = null; setEmailDesign(next) }} />
              </div>
            ) : null}

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


                </>}
                {step === 2 && <>
                  <div className="customer-campaign-review">
                    <div><span>Kampanya</span><strong>{name.trim() || 'Kampanya adı gerekli'}</strong><Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)}>Düzenle</Button></div>
                    <div><span>Alıcılar</span><strong>{previewing ? 'Hesaplanıyor…' : `${preview?.eligibleRecipients.toLocaleString('tr-TR') ?? 0} izinli alıcı`}<small>{selectedTargetLabel}</small></strong><Button type="button" variant="ghost" size="sm" onClick={() => setStep(0)}>Düzenle</Button></div>
                    <div><span>Konu</span><strong>{subject.trim() || 'E-posta konusu gerekli'}</strong><Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>Düzenle</Button></div>
                    <div><span>Tasarım</span><strong>{contentMode === 'builder' ? 'Tasarımcı' : contentMode === 'html' ? 'Özel HTML' : EMAIL_CAMPAIGN_TEMPLATES.find(t => t.id === templateId)?.label}<small>{designPreviewing || (!previewError && previewSource !== previewSignature) ? 'Önizleme hazırlanıyor…' : previewError ? 'İçeriği kontrol edin' : designIssue ? 'İçeriği kontrol edin' : activeContent.trim().length < 5 ? 'En az 5 karakter içerik gerekli' : 'Önizleme hazır'}</small></strong><Button type="button" variant="ghost" size="sm" onClick={() => setStep(1)}>Düzenle</Button></div>
                  </div>
            <Alert role="status" className={campaignReplyToEmail ? '' : 'border-warning/30 bg-warning/10 text-warning'}>
              <I.mail size={16} />
              <AlertDescription className={campaignReplyToEmail ? undefined : 'text-inherit'}>
                <strong>Gönderen: {restaurantName}</strong>
                {campaignReplyToEmail
                  ? <> · Müşteri yanıtları <strong>{campaignReplyToEmail}</strong> adresine gelir.</>
                  : <> · Yanıt adresi ayarlanmamış. Ayarlar → Mağaza bölümüne işletme e-postası ekleyin.</>}
              </AlertDescription>
            </Alert>

                  <div className="customer-campaign-send-note"><I.mail size={18} /><div><strong>{payloadSignature === queuedDraft ? 'Kampanya kuyruğa alındı' : canSend ? 'Gönderime hazır' : 'Birkaç bilgi daha gerekiyor'}</strong><p>{payloadSignature === queuedDraft ? 'Gönderim durumunu Son gönderimler bölümünden takip edebilirsiniz.' : canSend ? 'Yalnız güncel pazarlama izni ve geçerli e-posta adresi olan müşterilere gönderilir. Sonraki adımda gönderimi onaylayacaksınız.' : 'Kampanya adı, konu, geçerli içerik, uygun alıcı ve etkin e-posta gönderimi gereklidir.'}</p></div></div>
                </>}
                {designIssue && <Alert role="status" className="border-warning/30 bg-warning/10"><AlertDescription>{designIssue}</AlertDescription></Alert>}
                {previewError && <Alert variant="destructive" role="alert"><AlertDescription>{previewError}</AlertDescription></Alert>}
              </div>
            </div>
            <aside aria-label="E-posta önizlemesi ve kampanya geçmişi" className="customer-campaign-history">
              <div className="customer-campaign-side-tabs" role="group" aria-label="Önizleme ve geçmiş">
                <button type="button" aria-pressed={sideView === 'preview'} onClick={() => setSideView('preview')}>Önizleme</button>
                <button type="button" aria-pressed={sideView === 'history'} onClick={() => setSideView('history')}>Son gönderimler</button>
              </div>
              {sideView === 'preview' ? <>
                <div className="customer-campaign-preview-toolbar"><span>Gelen kutusu görünümü</span><div role="group" aria-label="Önizleme genişliği"><button type="button" aria-pressed={previewSize === 'wide'} onClick={() => setPreviewSize('wide')}>Geniş</button><button type="button" aria-pressed={previewSize === 'mobile'} onClick={() => setPreviewSize('mobile')}>Mobil</button></div></div>
                <div className="customer-campaign-inbox"><div className="customer-campaign-avatar" aria-hidden="true">{restaurantName.slice(0, 1).toLocaleUpperCase('tr-TR')}</div><div><strong>{restaurantName}</strong><p>{subject || 'E-posta konusu'}</p></div><span>Şimdi</span></div>
                <div className="customer-email-preview" data-size={previewSize} aria-busy={designPreviewing || (!previewError && previewSource !== previewSignature)}>
                  {designPreviewing || (!previewError && previewSource !== previewSignature) ? <div role="status" className="customer-email-preview-status"><Spinner aria-hidden="true" />Önizleme hazırlanıyor…</div> : previewHtml ? <iframe title="E-posta önizlemesi" sandbox="" referrerPolicy="no-referrer" srcDoc={previewHtml} /> : <div className="customer-email-preview-status">Önizleme kullanılamıyor</div>}
                </div>
                <p className="customer-campaign-preview-caption">E-posta uygulamasına göre görünüm değişebilir.</p>
              </> : <div className="customer-campaign-history-content">
          {!resendWebhookEnabled && <div className="mb-3 rounded-lg border border-warning/30 bg-warning/10 p-2 text-[11px] leading-relaxed text-warning">Teslim, açılma ve tıklama takibi için teslimat takibi henüz etkin değil. Kabul edilen gönderimler listelenmeye devam eder.</div>}
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

              </div>}
            </aside>
          </div>
          {!emailDeliveryEnabled && <Alert role="status" className="customer-campaign-notice border-warning/30 bg-warning/10 text-warning"><I.warn size={16} /><AlertDescription className="text-inherit">E-posta gönderimi için Resend yapılandırması eksik. Kampanyanızı hazırlayabilirsiniz; gönderim şu anda kullanılamıyor.</AlertDescription></Alert>}
          {(error || notice) && <Alert className="customer-campaign-notice" variant={error ? 'destructive' : 'default'} role={error ? 'alert' : 'status'} aria-live="polite"><AlertDescription>{error ?? notice}</AlertDescription></Alert>}
          <div className="customer-campaign-footer">
            <span className="customer-campaign-footer-summary">{previewing ? 'Alıcılar hesaplanıyor…' : `${preview?.eligibleRecipients.toLocaleString('tr-TR') ?? 0} izinli alıcı`}<small>{selectedTargetLabel}</small></span>
            <div className="customer-campaign-footer-actions">
              <Button type="button" variant="outline" onClick={step === 0 ? requestClose : () => setStep(step - 1)} disabled={sending || emailTemplateSaving}>{step === 0 ? 'Kapat' : 'Geri'}</Button>
              {step < 2 ? <Button type="button" disabled={step === 0 ? !name.trim() || !isCampaignAudienceReady(target, previewTarget, previewing, preview?.eligibleRecipients ?? 0) : !subject.trim() || activeContent.trim().length < 5 || Boolean(designIssue) || designPreviewing || Boolean(previewError) || previewSource !== previewSignature} onClick={() => setStep(step + 1)}>{step === 0 ? 'İçeriğe geç' : 'Kontrole geç'} <span aria-hidden="true">→</span></Button> : <Button type="button" aria-busy={sending} disabled={!canSend} onClick={() => setConfirming(true)}>{sending ? <Spinner aria-hidden="true" /> : <I.mail size={14} />}{sending ? 'Gönderiliyor…' : payloadSignature === queuedDraft ? 'Kuyruğa alındı' : 'Kampanyayı gönder'}</Button>}
            </div>
          </div>
        </fieldset>
        <style>{CAMPAIGN_STYLES}</style>
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
        : { label: status === 'draft' ? 'Taslak' : status === 'cancelled' ? 'İptal edildi' : status, variant: 'secondary' as const }
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

const CAMPAIGN_STYLES = `
.customer-campaign-dialog{width:min(1120px,calc(100vw - 32px))!important;max-width:1120px!important;height:min(820px,92dvh);border-radius:16px!important}
.customer-campaign-panel{min-width:0;min-height:0;margin:0;padding:0;border:0;height:100%;overflow:hidden;display:flex;flex-direction:column}
.customer-campaign-header{padding:22px 56px 18px 24px;gap:5px!important;flex-shrink:0}
.customer-campaign-eyebrow{font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--text-2);margin-bottom:3px}
.customer-campaign-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 24px 18px;border-bottom:1px solid var(--border);flex-shrink:0}
.customer-campaign-steps button{display:flex;align-items:center;justify-content:center;gap:8px;height:40px;border:1px solid var(--border);border-radius:8px;background:var(--surface);font-size:12px;font-weight:600;color:var(--text-2);cursor:pointer}
.customer-campaign-steps button span{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--surface-3);font-size:11px}
.customer-campaign-steps button[aria-current=step]{background:var(--positive-bg);border-color:var(--positive);color:var(--positive)}
.customer-campaign-steps button[aria-current=step] span{background:var(--positive);color:white}
.customer-campaign-workspace{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(0,1fr);min-height:0;flex:1;overflow:hidden}
.customer-campaign-main{min-width:0;min-height:0;overflow:auto;overscroll-behavior:contain}
.customer-campaign-content{padding:24px;display:grid;gap:20px}
.customer-campaign-section-heading h3{font-size:17px;line-height:1.4;letter-spacing:-.02em;font-weight:600;margin:0;outline:none}
.customer-campaign-section-heading p{font-size:12px;line-height:1.6;color:var(--text-2);margin:5px 0 0}
.customer-campaign-section-label{display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;font-size:12px;margin:0 0 12px}.customer-campaign-section-label span{color:var(--text-2);font-size:11px}
.customer-campaign-audience{grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:8px!important;margin-bottom:12px}
.customer-campaign-audience>[data-slot=card]{grid-column:span 2;gap:8px;padding:12px 0;border-radius:10px;box-shadow:none}
.customer-campaign-audience>[data-slot=card]:nth-child(-n+2){grid-column:span 3}
.customer-campaign-audience [data-slot=card-header],.customer-campaign-audience [data-slot=card-content]{padding:0 12px}
.customer-campaign-audience [data-slot=card-title]{font-size:10px;letter-spacing:0;text-transform:none}
.customer-campaign-audience-section{min-width:0}.customer-campaign-audience-section [role=status]{margin-top:12px}
.customer-campaign-history{min-height:0;min-width:0;overflow:auto;overscroll-behavior:contain;border-left:1px solid var(--border);background:var(--surface-2);padding:20px;display:flex;flex-direction:column;gap:16px}
.customer-campaign-side-tabs{display:flex;border-bottom:1px solid var(--border);gap:20px;flex-shrink:0}
.customer-campaign-side-tabs button{min-height:36px;font-size:12px;padding:0 0 10px;border:0;border-bottom:2px solid transparent;background:none;color:var(--text-2);font-weight:500;cursor:pointer}
.customer-campaign-side-tabs button[aria-pressed=true]{border-bottom-color:var(--text);color:var(--text)}
.customer-campaign-preview-toolbar{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:11px;color:var(--text-2);flex-shrink:0}
.customer-campaign-preview-toolbar>div{display:flex;border:1px solid var(--border);padding:3px;border-radius:7px;background:var(--surface-3)}
.customer-campaign-preview-toolbar button{border:0;background:transparent;padding:4px 8px;border-radius:4px;font-size:10px;cursor:pointer;color:var(--text-2)}
.customer-campaign-preview-toolbar button[aria-pressed=true]{background:var(--surface);color:var(--text);box-shadow:var(--shadow-1)}
.customer-campaign-inbox{display:flex;align-items:center;gap:10px;min-width:0;flex-shrink:0}
.customer-campaign-avatar{display:grid;place-items:center;width:34px;height:34px;flex-shrink:0;border-radius:50%;background:var(--positive-bg);color:var(--positive);font-weight:600}
.customer-campaign-inbox>div:nth-child(2){min-width:0;flex:1}.customer-campaign-inbox strong{font-size:12px}.customer-campaign-inbox p{font-size:11px;color:var(--text-2);margin:2px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.customer-campaign-inbox>span{font-size:10px;color:var(--text-2)}
.customer-email-preview{width:100%;min-height:320px;height:400px;flex:1;border:1px solid var(--border);border-radius:12px;background:#fff;overflow:hidden;align-self:center}
.customer-email-preview[data-size=mobile]{width:min(100%,320px)}
.customer-email-preview iframe{width:100%;height:100%;border:0;background:#fff;display:block}
.customer-email-preview-status{height:100%;display:flex;align-items:center;justify-content:center;gap:8px;padding:18px;color:var(--text-2);font-size:12px;text-align:center}
.customer-campaign-preview-caption{font-size:10px;color:var(--text-2);text-align:center;margin:0;flex-shrink:0}
.customer-email-template-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
.customer-email-template-card{min-width:0;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);color:var(--text);display:flex;flex-direction:column;gap:7px;text-align:left;cursor:pointer;transition:background .12s,border-color .12s}
.customer-email-template-card[aria-checked=true]{border-color:var(--positive);background:var(--positive-bg);box-shadow:0 0 0 1px var(--positive)}
.customer-email-template-card>strong{display:flex;align-items:center;justify-content:space-between;font-size:12px}.customer-email-template-card>strong>span{color:var(--positive)}
.customer-email-template-card>span:last-child{font-size:10px;line-height:1.45;color:var(--text-2)}
.customer-email-template-swatch{height:60px;width:100%;border-radius:6px;border:1px solid var(--border);background:linear-gradient(var(--border),var(--border)) 12px 18px/55% 4px no-repeat,linear-gradient(var(--border),var(--border)) 12px 28px/75% 3px no-repeat,linear-gradient(var(--border),var(--border)) 12px 38px/60% 3px no-repeat,#fff}
.customer-email-template-swatch-announcement{background:linear-gradient(var(--border),var(--border)) 10px 12px/45% 7px no-repeat,linear-gradient(var(--border),var(--border)) 10px 34px/70% 3px no-repeat,linear-gradient(var(--border),var(--border)) 10px 43px/50% 3px no-repeat,#fff}
.customer-email-template-swatch-offer{background:linear-gradient(#171719,#171719) 0 0/100% 26px no-repeat,linear-gradient(var(--border),var(--border)) center 14px/65% 4px no-repeat,linear-gradient(var(--border),var(--border)) center 23px/45% 3px no-repeat,#fff}
.customer-campaign-review{border:1px solid var(--border);border-radius:12px;overflow:hidden}
.customer-campaign-review>div{display:grid;grid-template-columns:72px minmax(0,1fr) auto;align-items:center;gap:8px;padding:16px;border-bottom:1px solid var(--border)}.customer-campaign-review>div:last-child{border-bottom:0}
.customer-campaign-review>div>span{font-size:11px;color:var(--text-2)}.customer-campaign-review strong{font-size:12px;font-weight:500;overflow-wrap:anywhere}.customer-campaign-review small{display:block;color:var(--text-2);font-size:11px;font-weight:400;margin-top:3px}
.customer-campaign-send-note{display:flex;align-items:flex-start;gap:12px;border-radius:10px;background:var(--positive-bg);color:var(--positive);padding:16px}.customer-campaign-send-note svg{flex-shrink:0;margin-top:2px}.customer-campaign-send-note strong{font-size:12px}.customer-campaign-send-note p{font-size:11px;line-height:1.65;margin:4px 0 0}
.customer-campaign-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 24px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0}
.customer-campaign-footer-summary{font-size:12px;font-weight:500;color:var(--positive)}.customer-campaign-footer-summary small{display:block;font-size:10px;font-weight:400;color:var(--text-2);margin-top:2px}.customer-campaign-footer-actions{display:flex;gap:8px}.customer-campaign-footer button{min-height:38px}
.customer-campaign-notice{margin:0 16px 8px;width:auto;flex-shrink:0;font-size:12px}
.customer-campaign-recipient-list,.customer-campaign-log-list{max-height:260px;overflow:auto}
.customer-campaign-history-card:hover{background:var(--surface-3)!important}
.customer-campaign-panel button:not(:disabled):hover{filter:brightness(.98)}
.customer-campaign-panel button:focus-visible{outline:2px solid var(--positive);outline-offset:3px}
.customer-campaign-panel button:disabled{cursor:not-allowed}
@media (max-width:760px){
.customer-campaign-dialog{width:calc(100vw - 16px)!important;height:calc(100dvh - 20px);max-height:calc(100dvh - 20px)!important;border-radius:12px!important}
.customer-campaign-header{padding:16px 44px 14px 16px}.customer-campaign-header [data-slot=dialog-title]{font-size:19px}.customer-campaign-header [data-slot=dialog-description]{font-size:12px}
.customer-campaign-steps{padding:0 16px 14px;gap:6px}.customer-campaign-steps button{min-height:40px;gap:6px;font-size:11px}
.customer-campaign-workspace{display:block;overflow:auto;overscroll-behavior:contain}.customer-campaign-main{overflow:visible}.customer-campaign-content{padding:20px 16px;gap:18px}
.customer-campaign-fields{grid-template-columns:1fr!important}.customer-campaign-history{overflow:visible;border-left:0;border-top:1px solid var(--border);padding:20px 16px}
.customer-email-preview{height:400px;flex:none}.customer-campaign-review>div{grid-template-columns:56px minmax(0,1fr) auto;padding:12px 10px;gap:5px}
.customer-campaign-footer{padding:12px 16px;gap:8px}.customer-campaign-footer button{min-height:44px}.customer-campaign-footer-summary small{display:none}.customer-campaign-footer-summary{font-size:11px}.customer-campaign-preview-toolbar button{min-height:32px}
.customer-campaign-notice{margin:0 8px 8px;font-size:11px}.customer-email-template-card{padding:8px}.customer-email-template-card>span:last-child{display:none}
}
@media(max-width:380px){.customer-campaign-footer-summary{display:none}.customer-campaign-footer-actions{width:100%}.customer-campaign-footer-actions>button:last-child{flex:1}.customer-campaign-review>div{grid-template-columns:1fr auto}.customer-campaign-review>div>span{grid-column:1/-1}.customer-campaign-section-label span{display:none}}
@media(prefers-reduced-motion:reduce){.customer-email-template-card{transition:none!important}}
`
