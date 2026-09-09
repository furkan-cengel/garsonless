import type { ReactNode } from 'react'
import Link from 'next/link'
import { I } from '../../lib/ui'
import styles from '../PlanLockedPanel.module.css'

export default function PlanLockCard({ title, description, benefits, returnHref, returnLabel, children }: {
  title: string
  description: string
  benefits: readonly string[]
  returnHref?: string
  returnLabel?: string
  children: ReactNode
}) {
  const icons = [I.clipboard, I.chart, I.clock, I.check]
  return <div className={styles.shell}>
    <section className={styles.card} aria-label={title}>
      <div className={styles.valuePanel}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.description}>{description}</p>
        <h2 className={styles.benefitsTitle}>Bu bölümde neler var?</h2>
        <ul className={styles.benefitList}>{benefits.map((benefit, index) => {
          const Icon = icons[index % icons.length] ?? I.check
          return <li key={benefit}><Icon size={18} aria-hidden="true" /><span>{benefit}</span></li>
        })}</ul>
        <div className={styles.purchasePanel}>{children}</div>
      </div>
      {returnHref && <Link className={styles.returnLink} href={returnHref} aria-label={returnLabel} title={returnLabel}><I.close size={18} /></Link>}
    </section>
  </div>
}
