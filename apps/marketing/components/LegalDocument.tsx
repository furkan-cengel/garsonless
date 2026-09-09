import type { ReactNode } from 'react'
import { LEGAL_DOCS_APPROVED, LEGAL_DOCUMENT_VERSION } from '../lib/legal-identity'
import { MarketingPage, PageHero } from './MarketingPage'

export type LegalSection = {
  title: string
  content: ReactNode
}

export function LegalDocument({
  title,
  description,
  sections,
  version = LEGAL_DOCUMENT_VERSION,
  canonical,
}: {
  title: string
  description: string
  sections: LegalSection[]
  version?: string
  canonical?: string
}) {
  return (
    <MarketingPage breadcrumbs={canonical ? [{ name: 'Yasal metinler', path: '/yasal' }, { name: title, path: canonical }] : undefined}>
      <PageHero eyebrow="Yasal" title={title} description={description} />
      <section className="legal-document-section">
        <div className="container legal-document-grid">
          <aside className="legal-document-meta" aria-label="Belge bilgileri">
            <strong>Sürüm</strong>
            <span>{version}</span>
            <strong>Durum</strong>
            <span>{LEGAL_DOCS_APPROVED ? 'Yürürlükte' : 'Hukuk ve aktarım incelemesi bekleniyor'}</span>
            <a href="/yasal">Tüm yasal metinler</a>
          </aside>
          <article className="legal-document">
            {!LEGAL_DOCS_APPROVED && (
              <div className="legal-review-notice" role="note">
                Bu taslak resmî kaynaklar ve mevcut ürün akışları temel alınarak hazırlanmıştır. Yayından önce hukuk danışmanı onayı ile yurt dışı aktarım envanterinin tamamlanması gerekir.
              </div>
            )}
            {sections.map((section, index) => (
              <section key={section.title} id={`bolum-${index + 1}`}>
                <h2>{section.title}</h2>
                <div>{section.content}</div>
              </section>
            ))}
          </article>
        </div>
      </section>
    </MarketingPage>
  )
}
