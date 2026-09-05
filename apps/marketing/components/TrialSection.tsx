import Image from 'next/image'
import type { CSSProperties } from 'react'
import { MI } from '../lib/icons'

const DASHBOARD_URL = process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'http://localhost:3000'

const QR_SIZE = 350
const ARTWORK_WIDTH = 570
const MOBILE_ARTWORK_HEIGHT = 500
const MOBILE_QR_OFFSET_X = (ARTWORK_WIDTH - QR_SIZE) / 2
const PARTICLE_COUNT = 70

type ParticleStyle = CSSProperties & {
  '--trial-particle-left': string
  '--trial-particle-top': string
  '--trial-particle-width': string
  '--trial-particle-height': string
  '--trial-particle-dx': string
  '--trial-particle-dy': string
  '--trial-particle-static-dx': string
  '--trial-particle-static-dy': string
  '--trial-particle-mobile-left': string
  '--trial-particle-mobile-top': string
  '--trial-particle-mobile-width': string
  '--trial-particle-mobile-height': string
  '--trial-particle-mobile-dx': string
  '--trial-particle-mobile-dy': string
  '--trial-particle-mobile-static-dx': string
  '--trial-particle-mobile-static-dy': string
}

type TrialParticle = {
  id: number
  src: string
  style: ParticleStyle
}

function mulberry32(seed: number) {
  return () => {
    const value = seed |= 0
    seed = value + 0x6D2B79F5 | 0
    let mixed = Math.imul(seed ^ seed >>> 15, 1 | seed)
    mixed = mixed + Math.imul(mixed ^ mixed >>> 7, 61 | mixed) ^ mixed
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296
  }
}

function particleAsset(value: number) {
  if (value < 0.46) return '/marketing/trial-particle-ivory.png'
  if (value < 0.7) return '/marketing/trial-particle-mint.png'
  if (value < 0.9) return '/marketing/trial-particle-sage.png'
  return '/marketing/trial-particle-green.png'
}

const trialParticles: TrialParticle[] = (() => {
  const random = mulberry32(99)

  return Array.from({ length: PARTICLE_COUNT }, (_, id) => {
    const size = 6 + Math.round(random() * 8)
    const sourceY = QR_SIZE * (0.12 + 0.74 * random())
    const sourceX = random() * 40
    const travelX = 55 + random() * 165
    const travelY = ((sourceY / QR_SIZE) - 0.5) * 120 + (random() - 0.5) * 46
    const duration = 2.4 + random() * 3
    const delay = -random() * duration
    const mobileRandom = mulberry32(9100 + id)
    const mobileSourceX = QR_SIZE * (0.14 + 0.72 * mobileRandom())
    const mobileSourceY = QR_SIZE + mobileRandom() * 24
    const mobileTravelX = ((mobileSourceX / QR_SIZE) - 0.5) * 50 + (mobileRandom() - 0.5) * 42
    const mobileTravelY = 55 + mobileRandom() * 130

    return {
      id,
      src: particleAsset(random()),
      style: {
        '--trial-particle-left': `${((QR_SIZE + sourceX) / ARTWORK_WIDTH) * 100}%`,
        '--trial-particle-top': `${(sourceY / QR_SIZE) * 100}%`,
        '--trial-particle-width': `${(size / ARTWORK_WIDTH) * 100}%`,
        '--trial-particle-height': `${(size / QR_SIZE) * 100}%`,
        '--trial-particle-dx': `${(travelX / size) * 100}%`,
        '--trial-particle-dy': `${(travelY / size) * 100}%`,
        '--trial-particle-static-dx': `${((travelX * 0.48) / size) * 100}%`,
        '--trial-particle-static-dy': `${((travelY * 0.48) / size) * 100}%`,
        '--trial-particle-mobile-left': `${((MOBILE_QR_OFFSET_X + mobileSourceX) / ARTWORK_WIDTH) * 100}%`,
        '--trial-particle-mobile-top': `${(mobileSourceY / MOBILE_ARTWORK_HEIGHT) * 100}%`,
        '--trial-particle-mobile-width': `${(size / ARTWORK_WIDTH) * 100}%`,
        '--trial-particle-mobile-height': `${(size / MOBILE_ARTWORK_HEIGHT) * 100}%`,
        '--trial-particle-mobile-dx': `${(mobileTravelX / size) * 100}%`,
        '--trial-particle-mobile-dy': `${(mobileTravelY / size) * 100}%`,
        '--trial-particle-mobile-static-dx': `${((mobileTravelX * 0.48) / size) * 100}%`,
        '--trial-particle-mobile-static-dy': `${((mobileTravelY * 0.48) / size) * 100}%`,
        animationDuration: `${duration}s`,
        animationDelay: `${delay}s`,
      },
    }
  })
})()

function TrialQrMotion() {
  return (
    <div className="trial-qr-motion" aria-hidden="true">
      <Image
        className="trial-qr-motion__code"
        src="/marketing/trial-qr-code.png"
        alt=""
        width={700}
        height={700}
        sizes="(max-width: 700px) 220px, 264px"
      />
      {trialParticles.map((particle) => (
        <Image
          key={particle.id}
          className="trial-qr-motion__particle"
          src={particle.src}
          alt=""
          width={28}
          height={28}
          style={particle.style}
          unoptimized
        />
      ))}
    </div>
  )
}

export function TrialSection() {
  return (
    <section id="ucretsiz-deneme" className="trial-section story-section">
      <div className="story-container">
        <div className="trial-band">
          <div className="trial-band__artwork" aria-hidden="true">
            <TrialQrMotion />
          </div>
          <div className="trial-band__content">
            <span className="trial-band__eyebrow"><MI.sparkles size={16} /> 14 günlük Pro denemesi</span>
            <h2 className="font-display">QR’ı masaya koyun.<br />Servis akmaya başlasın.</h2>
            <p>Menünüzü, siparişlerinizi ve masalarınızı<br />14 gün boyunca gerçek işletmenizde deneyin.</p>
            <a href={`${DASHBOARD_URL}/auth/signup`}>14 gün ücretsiz dene <MI.arrow size={17} /></a>
          </div>
        </div>
      </div>
    </section>
  )
}
