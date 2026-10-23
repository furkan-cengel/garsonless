'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  translationFieldStatus,
  type TranslationMode,
  type TranslationSnapshot,
} from '@garsonless/domain/menu-translation'
import { currentEnglish, publishableDrafts, typedEnglishChanges } from './menu-item-translation-model'
import { menuTranslationAction } from '../../lib/actions/menu-translation'
import { translationErrorText } from '../../lib/menu-translation-errors'

/* English for one product, from inside its panel. The queue, quota, review and
   publish rules of the translations page stay as they are: one button queues an
   AI draft for every field of the product, the panel waits for the worker, and
   Kaydet publishes what the owner reviewed. */

const POLL_MS = 4000
const POLL_LIMIT_MS = 180_000

export type ItemTranslationState = 'loading' | 'ready' | 'translating' | 'locked' | 'unavailable'

const pendingJobs = (snapshot: TranslationSnapshot) => snapshot.jobs.some((job) => job.status === 'queued' || job.status === 'running')

/** `keyPrefix` names the record: `item/<id>/` for a product, `category/<id>/` for a category. */
export function useMenuItemTranslation(restaurantId: string, keyPrefix: string) {
  const [snapshot, setSnapshot] = useState<TranslationSnapshot | null>(null)
  const [state, setState] = useState<ItemTranslationState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [edits, setEdits] = useState<Record<string, string>>({})
  // Drafts produced from this panel; older drafts waiting on the translations page are not this panel's unsaved work.
  const [generated, setGenerated] = useState(false)
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false }, [])

  const call = useCallback(async (mode: TranslationMode, payload: Record<string, unknown> = {}): Promise<{ error: string } | { data: TranslationSnapshot } | null> => {
    const result = await menuTranslationAction({ restaurantId, mode, ...(mode === 'snapshot' ? {} : { requestId: crypto.randomUUID() }), payload })
    if (!alive.current) return null
    if (!result.ok) return { error: result.error }
    setSnapshot(result.data)
    return { data: result.data }
  }, [restaurantId])

  useEffect(() => {
    // An empty prefix means a record that does not exist yet (a new category): nothing to translate.
    if (!keyPrefix) return
    void call('snapshot').then((result) => {
      if (!result) return
      if ('error' in result) { setState(result.error === 'forbidden' ? 'locked' : 'unavailable'); return }
      setState(result.data.allowed ? 'ready' : 'locked')
    }).catch(() => { if (alive.current) setState('unavailable') })
  }, [call, keyPrefix])

  const prefix = keyPrefix
  const fields = useMemo(() => snapshot?.fields.filter((field) => field.key.startsWith(prefix)) ?? [], [snapshot, prefix])
  const field = (name: 'name' | 'description') => fields.find((entry) => entry.key === `${prefix}${name}`)
  const english = (name: 'name' | 'description') => edits[`${prefix}${name}`] ?? currentEnglish(field(name))
  const setEnglish = (name: 'name' | 'description', text: string) => setEdits((current) => ({ ...current, [`${prefix}${name}`]: text }))
  // Unpublished work: a typed edit, or an AI draft that has not been published yet.
  const dirty = Object.entries(edits).some(([key, text]) => text !== currentEnglish(fields.find((entry) => entry.key === key)))
    || (generated && fields.some((entry) => translationFieldStatus(entry) === 'draft'))
  const otherFieldCount = fields.filter((entry) => entry.key !== `${prefix}name` && entry.key !== `${prefix}description`).length

  /** Queues an AI draft for every field of the product and waits for the worker. */
  const translate = useCallback(async () => {
    if (!fields.length) return
    setError(null)
    setState('translating')
    try {
      const queued = await call('generate', { keys: fields.map((entry) => entry.key), regenerate: true })
      if (!queued) return
      if ('error' in queued) { setError(translationErrorText(queued.error)); setState('ready'); return }
      const started = Date.now()
      let latest = queued.data
      while (alive.current && pendingJobs(latest) && Date.now() - started < POLL_LIMIT_MS) {
        await new Promise((resolve) => setTimeout(resolve, POLL_MS))
        const polled = await call('snapshot')
        if (!polled || 'error' in polled) break
        latest = polled.data
      }
      if (!alive.current) return
      // A fresh AI draft replaces what was typed for this product.
      setEdits({})
      setGenerated(true)
      if (pendingJobs(latest)) setError('Çeviri hâlâ sırada. Panel açık kalırsa birazdan görünür; Çeviriler sayfasından da takip edebilirsin.')
      else if (latest.jobs[0]?.status === 'failed') setError('Çeviri hazırlanamadı. Metni elle yazabilir ya da yeniden deneyebilirsin.')
      setState('ready')
    } catch {
      if (alive.current) { setError(translationErrorText('unavailable')); setState('ready') }
    }
  }, [call, fields])

  /**
   * Publishes the reviewed English after the product itself was saved. Runs a
   * fresh snapshot first so Turkish changes from the same save are synced.
   */
  const publish = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true
    setError(null)
    try {
      const synced = await call('snapshot')
      if (!synced || 'error' in synced) { setError(translationErrorText(synced?.error ?? 'unavailable')); return false }
      const live = synced.data.fields.filter((entry) => entry.key.startsWith(prefix))
      const typed = typedEnglishChanges(live, edits)
      let current = live
      if (typed.length) {
        const saved = await call('save', { fields: typed })
        if (!saved || 'error' in saved) { setError(translationErrorText(saved?.error ?? 'unavailable')); return false }
        current = saved.data.fields.filter((entry) => entry.key.startsWith(prefix))
      }
      const ready = publishableDrafts(current)
      if (ready.length) {
        const published = await call('publish', { fields: ready })
        if (!published || 'error' in published) { setError(translationErrorText(published?.error ?? 'unavailable')); return false }
      }
      setEdits({})
      setGenerated(false)
      return true
    } catch {
      setError(translationErrorText('unavailable'))
      return false
    }
  }, [call, dirty, edits, prefix])

  const discard = useCallback(() => { setEdits({}); setGenerated(false); setError(null) }, [])

  return {
    state,
    error,
    enabled: snapshot?.enabled ?? false,
    available: fields.length > 0,
    status: (name: 'name' | 'description') => { const entry = field(name); return entry ? translationFieldStatus(entry) : null },
    english,
    setEnglish,
    hasField: (name: 'name' | 'description') => Boolean(field(name)),
    otherFieldCount,
    dirty,
    translate,
    publish,
    discard,
  }
}

export type MenuItemTranslation = ReturnType<typeof useMenuItemTranslation>
