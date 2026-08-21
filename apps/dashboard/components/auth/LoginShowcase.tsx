'use client'

import type { ReactElement } from 'react'
import styles from './LoginShowcase.module.css'

type ShowcaseMotion = 'forward' | 'backward'

interface ShowcaseCard {
  src: string
  label: string
  width: number
  height: number
}

interface ShowcaseLane {
  id: string
  motion: ShowcaseMotion
  cards: ShowcaseCard[]
}

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

/**
 * New menu captures are added to this manifest in the order they arrive.
 * Columns distribute the captures automatically, so the layout does not need
 * to be rebuilt for every new image.
 */
const cards: ShowcaseCard[] = [
  {
    src: '/auth/showcase/01-menu-overview-transparent.png',
    label: 'Menü ana görünümü',
    width: 673,
    height: 1310,
  },
  {
    src: '/auth/showcase/02-cart-drawer-transparent.png',
    label: 'Sepet ve ödeme görünümü',
    width: 672,
    height: 1310,
  },
  {
    src: '/auth/showcase/03-service-request-transparent.png',
    label: 'Servis çağrısı görünümü',
    width: 673,
    height: 1309,
  },
  {
    src: '/auth/showcase/04-order-confirmation-transparent.png',
    label: 'Sipariş onayı görünümü',
    width: 668,
    height: 1305,
  },
  {
    src: '/auth/showcase/05-product-customization-transparent.png',
    label: 'Ürün özelleştirme görünümü',
    width: 670,
    height: 1306,
  },
  {
    src: '/auth/showcase/06-allergen-upsell-transparent.png',
    label: 'Alerjen ve tamamlayıcı ürün görünümü',
    width: 672,
    height: 1309,
  },
  {
    src: '/auth/showcase/07-featured-business-info-transparent.png',
    label: 'Öne çıkanlar ve işletme bilgileri görünümü',
    width: 672,
    height: 1309,
  },
  {
    src: '/auth/showcase/08-campaign-offers-transparent.png',
    label: 'Kampanya ve özel teklifler görünümü',
    width: 672,
    height: 1301,
  },
  {
    src: '/auth/showcase/09-guest-signup-transparent.png',
    label: 'Misafir hesap oluşturma görünümü',
    width: 672,
    height: 1309,
  },
  {
    src: '/auth/showcase/10-bundle-offers-transparent.png',
    label: 'Birlikte ürün teklifleri görünümü',
    width: 673,
    height: 1309,
  },
]

// The visible capacity of the diagonal lanes is 2–3–4–4–3–2 cards. Each lane
// therefore gets a different pool at that exact depth, while neighbouring
// pools remain disjoint so equal captures can never align side by side.
const LANE_CARD_ORDERS = [
  [3, 8],
  [0, 7, 5],
  [1, 3, 8, 9],
  [0, 4, 6, 7],
  [2, 8, 9],
  [1, 5],
] as const

function buildLaneCards(laneIndex: number): ShowcaseCard[] {
  const laneOrder = LANE_CARD_ORDERS[laneIndex]!

  return Array.from({ length: 12 }, (_, index) => cards[laneOrder[index % laneOrder.length]!]!)
}

const lanes: ShowcaseLane[] = Array.from({ length: 6 }, (_, index) => ({
  id: `showcase-lane-${index + 1}`,
  motion: index % 2 === 0 ? 'forward' : 'backward',
  cards: buildLaneCards(index),
}))

function CardImage({ card }: { card: ShowcaseCard }): ReactElement {
  return (
    <div
      className={styles.card}
      data-showcase-card={card.label}
      style={{ aspectRatio: `${card.width} / ${card.height}` }}
    >
      <picture>
        <source media="(min-width: 900px)" srcSet={card.src} />
        {/* The data pixel prevents desktop showcase assets from being requested on mobile. */}
        <img
          src={TRANSPARENT_PIXEL}
          alt=""
          width={card.width}
          height={card.height}
          loading="eager"
          decoding="async"
        />
      </picture>
    </div>
  )
}

function ShowcaseLaneView({ lane }: { lane: ShowcaseLane }): ReactElement {
  return (
    <div className={styles.lane} data-motion={lane.motion}>
      <div className={styles.track}>
        {lane.cards.map((card, cardIndex) => (
          <CardImage key={`${lane.id}-${cardIndex}`} card={card} />
        ))}
      </div>
    </div>
  )
}

export default function LoginShowcase(): ReactElement {
  return (
    <aside className={styles.showcase} aria-hidden="true" data-login-showcase>
      <div className={styles.canvas}>
        {lanes.map((lane) => (
          <ShowcaseLaneView key={lane.id} lane={lane} />
        ))}
      </div>
    </aside>
  )
}
