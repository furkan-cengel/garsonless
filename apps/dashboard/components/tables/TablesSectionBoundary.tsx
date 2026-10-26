'use client'

import { Component, type ReactNode } from 'react'
import { AppIcons } from '@garsonless/ui/icons'

/* Keeps a failure inside one panel: the rest of the screen stays usable and the panel can be rebuilt in place. */
export class TablesSectionBoundary extends Component<{ title: string; description: string; className?: string; children: ReactNode }, { error: Error | null; attempt: number }> {
  state: { error: Error | null; attempt: number } = { error: null, attempt: 0 }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[tables-section-error]', { section: this.props.title, publicCode: 'MAS-UI-500' }, error)
  }

  render() {
    if (!this.state.error) return <div key={this.state.attempt} style={{ display: 'contents' }}>{this.props.children}</div>
    return (
      <div className={`tb-section-error ${this.props.className ?? ''}`} role="alert">
        <span aria-hidden="true"><AppIcons.warn size={22} /></span>
        <strong>{this.props.title}</strong>
        <p>{this.props.description}</p>
        <button type="button" onClick={() => this.setState(({ attempt }) => ({ error: null, attempt: attempt + 1 }))}>Yeniden çiz</button>
        <code>Hata kodu: MAS-UI-500 · {this.state.error.name}</code>
      </div>
    )
  }
}
