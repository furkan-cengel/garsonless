'use client'

import { useEffect, useRef, useState } from 'react'
import { removeUnusedMenuImage } from '../../lib/actions/menu'
import { uploadMenuImage } from '../../lib/dashboard-media-upload-client'
import { prepareMenuImage } from '../../lib/menu-image-client'
import { validateMenuImageMetadata } from '../../lib/menu-image-policy'

export function useMenuImageDraft(initial: string[], restaurantId: string, itemId: string) {
  const [images, setImages] = useState(initial)
  const fileRef = useRef<File | null>(null)
  const previewRef = useRef<string | null>(null)
  const uploadedRef = useRef<string | null>(null)
  const ownedRef = useRef(new Set<string>())
  const baseline = useRef(initial)
  function revokePreview() {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    previewRef.current = null
  }
  function cleanUnused() {
    for (const url of ownedRef.current) void removeUnusedMenuImage(restaurantId, url).catch(() => {})
    ownedRef.current.clear()
  }
  useEffect(() => () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current)
    for (const url of ownedRef.current) void removeUnusedMenuImage(restaurantId, url).catch(() => {})
  }, [restaurantId])
  function select(file: File) {
    const metadata = validateMenuImageMetadata({ size: file.size, type: file.type })
    if (!metadata.ok) throw new Error(metadata.error)
    revokePreview()
    previewRef.current = URL.createObjectURL(file)
    fileRef.current = file
    uploadedRef.current = null
    setImages([previewRef.current, ...images.slice(1)])
  }
  function selectExisting(url: string) {
    revokePreview(); fileRef.current = null; uploadedRef.current = null; setImages([url, ...images.slice(1)])
  }
  function remove() {
    revokePreview()
    fileRef.current = null
    uploadedRef.current = null
    setImages([])
  }
  async function resolve() {
    if (!fileRef.current) return images
    if (!uploadedRef.current) {
      const prepared = await prepareMenuImage(fileRef.current)
      const data = new FormData()
      data.append('restaurantId', restaurantId)
      data.append('entityId', itemId)
      data.append('kind', 'items')
      data.append('file', prepared)
      const result = await uploadMenuImage(data)
      if ('error' in result) throw new Error(result.error)
      uploadedRef.current = result.url
      ownedRef.current.add(result.url)
    }
    return [uploadedRef.current, ...images.slice(1)]
  }
  function commit(saved: string[]) {
    saved.forEach((url) => ownedRef.current.delete(url))
    baseline.current = saved
    fileRef.current = null
    uploadedRef.current = null
    revokePreview()
    cleanUnused()
    setImages(saved)
  }
  function discard() {
    remove()
    setImages(baseline.current)
    cleanUnused()
  }
  return { images, select, selectExisting, remove, resolve, commit, discard }
}
