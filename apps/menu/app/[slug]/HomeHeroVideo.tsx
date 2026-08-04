'use client'

import { useEffect, useRef, useState } from 'react'
import { AppIcons as I } from '@garsonless/ui/icons'

export function HomeHeroVideo({ src, poster }: { src: string; poster: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [posterOnly, setPosterOnly] = useState(true)
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
    setPosterOnly(reduced || saveData)
    if (!reduced && !saveData) void ref.current?.play().then(() => setPlaying(true)).catch(() => setPlaying(false))
  }, [])
  return <div className="home-video"><video ref={ref} muted playsInline loop preload="none" poster={poster} aria-label="Hero videosu">{!posterOnly && <source src={src} />}</video><button type="button" aria-label={playing ? 'Videoyu duraklat' : 'Videoyu oynat'} onClick={() => { const video = ref.current; if (!video) return; if (video.paused) void video.play().then(() => setPlaying(true)); else { video.pause(); setPlaying(false) } }}>{playing ? <I.pause size={18} /> : <I.play size={18} />}</button></div>
}
