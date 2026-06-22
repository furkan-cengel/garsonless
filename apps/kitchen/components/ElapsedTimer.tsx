'use client'

import { useState, useEffect } from 'react'

interface ElapsedTimerProps {
  createdAt: string
}

function formatElapsed(ms: number): string {
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export default function ElapsedTimer({ createdAt }: ElapsedTimerProps) {
  const [elapsed, setElapsed] = useState(() => Date.now() - new Date(createdAt).getTime())

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Date.now() - new Date(createdAt).getTime())
    }, 1000)
    return () => clearInterval(id)
  }, [createdAt])

  const minutes = elapsed / 60000
  const colorClass =
    minutes >= 15 ? 'text-danger' : minutes >= 7 ? 'text-warning' : 'text-success'

  return (
    <span className={`text-xs font-mono font-bold tabular-nums ${colorClass}`}>
      {formatElapsed(elapsed)}
    </span>
  )
}
