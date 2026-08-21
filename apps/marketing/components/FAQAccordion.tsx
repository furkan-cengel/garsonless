'use client'

import { useId, useState } from 'react'
import { MI } from '../lib/icons'

export interface FAQAccordionItem {
  question: string
  answer: string
}

function FAQItem({
  item,
  open,
  onClick,
}: {
  item: FAQAccordionItem
  open: boolean
  onClick: () => void
}) {
  const id = useId()
  const panelId = `faq-panel-${id}`
  const buttonId = `faq-button-${id}`

  return (
    <article className="faq-item" data-open={open}>
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onClick}
        >
          <span>{item.question}</span>
          <i aria-hidden="true"><MI.plus size={15} /></i>
        </button>
      </h3>
      <div
        id={panelId}
        className="faq-item__answer"
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
      >
        <div className="faq-item__answer-inner">
          <p>{item.answer}</p>
        </div>
      </div>
    </article>
  )
}

export function FAQAccordion({ items }: { items: readonly FAQAccordionItem[] }) {
  const [open, setOpen] = useState(-1)

  return (
    <div className="faq-list">
      {items.map((item, index) => (
        <FAQItem
          key={item.question}
          item={item}
          open={open === index}
          onClick={() => setOpen(open === index ? -1 : index)}
        />
      ))}
    </div>
  )
}
