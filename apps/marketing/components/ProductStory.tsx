'use client'

import Image from 'next/image'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { ArrowRight, ChartNoAxesColumnIncreasing, Check, ChefHat, Circle, CircleCheck, Clock3, Egg, MessageCircle, Milk, Minus, Plus, RotateCcw, UserRound, Wheat } from 'lucide-react'
import { nextStoryChapter } from './product-story-scroll'
import styles from './ProductStory.module.css'

const chapters = [
  { label: 'Misafir', title: 'Misafir seçer.', description: 'İçerik, alerjen ve tercihler elinin altında. Ne istediğine kendi karar verir.', Icon: UserRound },
  { label: 'Ekip', title: 'Ekip hazırlar.', description: 'Sipariş, tercihleriyle doğru istasyona ulaşır. Mutfak ve servis aynı bilgiden ilerler.', Icon: ChefHat },
  { label: 'İşletme', title: 'İşletme takip eder.', description: 'Masa, sipariş ve hesap tek yerde. Operasyonun tamamını bir bakışta takip eder.', Icon: ChartNoAxesColumnIncreasing },
]
const food = '/product/menemen-story.png'
const money = (quantity: number) => `₺${(quantity * 180).toLocaleString('tr-TR')},00`

function Allergens() {
  return <div className={styles.allergens} aria-label="Örnek ürünün içerdiği alerjenler">
    <span><Wheat size={15} aria-hidden="true" />Gluten</span>
    <span><Egg size={15} aria-hidden="true" />Yumurta</span>
    <span><Milk size={15} aria-hidden="true" />Süt</span>
  </div>
}

export function ProductStory() {
  const [active, setActive] = useState(0)
  const [quantity, setQuantity] = useState(1)
  const [noOnion, setNoOnion] = useState(true)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const sectionRef = useRef<HTMLElement>(null)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const chapterRefs = useRef<(HTMLButtonElement | null)[]>([])
  const stageRef = useRef<HTMLDivElement>(null)
  const manualSelection = useRef(false)

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 900px)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    const update = () => {
      frame = 0
      const bounds = sectionRef.current?.getBoundingClientRect()
      if (!bounds) return
      // Manual exploration lasts until this section has left the visible area.
      if (bounds.bottom <= 80 || bounds.top >= window.innerHeight) {
        manualSelection.current = false
        return
      }
      if (!desktop.matches || reducedMotion.matches || manualSelection.current || sectionRef.current?.contains(document.activeElement)) return
      const centers = chapterRefs.current.map(node => {
        const rect = node!.getBoundingClientRect()
        return rect.top + rect.height / 2
      })
      setActive(current => nextStoryChapter(current, centers, window.innerHeight * .48))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    desktop.addEventListener('change', schedule)
    reducedMotion.addEventListener('change', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      desktop.removeEventListener('change', schedule)
      reducedMotion.removeEventListener('change', schedule)
    }
  }, [])

  function select(index: number) {
    manualSelection.current = true
    // Move focus out of the outgoing panel before it becomes inert.
    const controls = window.matchMedia('(min-width: 900px)').matches ? chapterRefs : tabRefs
    controls.current[index]?.focus({ preventScroll: true })
    setActive(index)
  }

  function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % chapters.length
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index + chapters.length - 1) % chapters.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = chapters.length - 1
    else return
    event.preventDefault()
    select(next)
  }

  const panelProps = (index: number) => ({
    className: styles.panel,
    role: 'tabpanel',
    id: `story-panel-${index}`,
    'aria-label': chapters[index]!.title,
    'aria-hidden': active !== index,
    'data-active': active === index,
    'data-before': index < active,
    inert: active !== index,
    tabIndex: active === index ? 0 : -1,
  })

  return <section ref={sectionRef} id="urun-hikayesi" className={styles.section} aria-labelledby="product-story-title">
    <div className={styles.container}>
      <header className={styles.heading}>
        <h2 id="product-story-title">Üç bakış açısı.<br /><span>Tek akış.</span></h2>
        <p>Misafirden mutfağa, tüm ekip aynı sayfada.</p>
      </header>

      <div className={styles.chapters} role="tablist" aria-label="Ürün akışının bakış açısı" aria-orientation="vertical">
        {chapters.map(({ title, description, Icon }, index) => <button key={title} ref={node => { chapterRefs.current[index] = node }} className={styles.chapter} type="button" role="tab" id={`story-tab-${index}`} aria-selected={active === index} aria-controls={`story-panel-${index}`} tabIndex={active === index ? 0 : -1} onClick={() => select(index)} onKeyDown={event => navigateTabs(event, index)}>
          <span className={styles.chapterIcon}><Icon size={23} strokeWidth={1.7} aria-hidden="true" /></span>
          <span className={styles.chapterText}><strong>{title}</strong><span>{description}</span></span>
          <ArrowRight className={styles.chapterArrow} size={19} aria-hidden="true" />
        </button>)}
      </div>

      <div className={styles.stage} ref={stageRef}>
        <div className={styles.tabs} role="tablist" aria-label="Ürün akışının bakış açısı">
          {chapters.map(({ label, Icon }, index) => <button key={label} type="button" role="tab" id={`story-mobile-tab-${index}`} aria-controls={`story-panel-${index}`} aria-selected={active === index} tabIndex={active === index ? 0 : -1} ref={node => { tabRefs.current[index] = node }} onClick={() => select(index)} onKeyDown={event => navigateTabs(event, index)}>
            <Icon size={20} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span>
          </button>)}
        </div>

        <div className={styles.scene}>
          <div className={styles.sceneHeader}><span>Örnek sipariş</span><span>Masa 5</span></div>
          <div className={styles.summary}>
            <Image src={food} alt="Bakır tavada menemen" width={96} height={96} sizes="(max-width: 899px) 72px, 96px" />
            <div><h3>Menemen</h3><p>{quantity} ürün <span aria-hidden="true">·</span> {money(quantity)}</p></div>
          </div>

          <div className={styles.panels}>
            <div {...panelProps(0)}>
              <div><span className={styles.eyebrow}>Dijital menü</span><h4>Tam istediğin gibi.</h4><p className={styles.detail}>Domates, biber, yumurta, tereyağı.</p></div>
              <Allergens />
              <label className={styles.preference}><input type="checkbox" checked={noOnion} onChange={event => setNoOnion(event.target.checked)} /><span>Soğan olmasın</span></label>
              <div className={styles.orderActions}>
                <div className={styles.quantity}><button type="button" aria-label="Adedi azalt" disabled={quantity === 1} onClick={() => setQuantity(value => value - 1)}><Minus size={17} /></button><output aria-live="polite" aria-label="Adet">{quantity}</output><button type="button" aria-label="Adedi artır" disabled={quantity === 5} onClick={() => setQuantity(value => value + 1)}><Plus size={17} /></button></div>
                <button className={styles.primary} type="button" onClick={() => { setReady(false); select(1); setNotice('Örnek sipariş mutfak ekranına ulaştı.') }}>Sipariş ver <ArrowRight size={17} /></button>
              </div>
            </div>

            <div {...panelProps(1)}>
              <div><span className={styles.eyebrow}>Mutfak</span><h4>{ready ? 'Servise hazır.' : 'Tercihiyle birlikte ulaştı.'}</h4><p className={styles.detail}>Misafirin tercihi, ekibin ekranında.</p></div>
              <p className={styles.note}><MessageCircle size={18} aria-hidden="true" />{noOnion ? 'Soğan olmasın' : 'Standart hazırlansın'}</p>
              <ol className={styles.progress} aria-label="Hazırlık durumu">
                <li data-done="true"><CircleCheck size={24} /><span>Alındı</span></li>
                <li data-current={!ready} data-done={ready}>{ready ? <CircleCheck size={24} /> : <Clock3 size={24} />}<span>Hazırlanıyor</span></li>
                <li data-done={ready}>{ready ? <CircleCheck size={24} /> : <Circle size={24} />}<span>Hazır</span></li>
              </ol>
              <button type="button" className={styles.primary} onClick={() => { if (ready) select(2); else { setReady(true); setNotice('Örnek sipariş servise hazır olarak işaretlendi.') } }}>{ready ? <>İşletme görünümüne geç <ArrowRight size={17} /></> : 'Hazır olarak işaretle'}</button>
            </div>

            <div {...panelProps(2)}>
              <div><span className={styles.eyebrow}>İşletme</span><h4>Hesap tamamlandı.</h4><p className={styles.detail}>Siparişten ödemeye, aynı masa kaydı.</p></div>
              <dl className={styles.receipt}>
                <div><dt>Sipariş</dt><dd><Check size={16} />Servis edildi</dd></div>
                <div><dt>Hesap</dt><dd><Check size={16} />Ödeme alındı</dd></div>
                <div><dt>Toplam</dt><dd>{money(quantity)}</dd></div>
              </dl>
              <button className={`${styles.primary} ${styles.secondary}`} type="button" onClick={() => { setReady(false); setQuantity(1); setNoOnion(true); setNotice('Örnek sipariş sıfırlandı.'); select(0) }}><RotateCcw size={17} />Akışı yeniden dene</button>
            </div>
          </div>
        </div>
        <div className={styles.mobileCaptions}>
          {chapters.map(({ title, description }, index) => <div key={title} className={styles.caption} data-active={active === index} aria-hidden={active !== index}>
            <div><strong>{title}</strong><p>{description}</p></div>
          </div>)}
        </div>
        <p className="sr-only" role="status">{notice}</p>
      </div>

      <a href="#demo" className={styles.link}>Ürün akışını incele <ArrowRight size={20} aria-hidden="true" /></a>
    </div>
  </section>
}
