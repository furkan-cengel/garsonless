import Image from 'next/image'

export type CustomerProof = {
  businessName: string
  logo?: { src: string; width: number; height: number }
  testimonial?: string
  modules?: readonly string[]
  metric?: { value: string; label: string; context: string }
}

// Populate only with verified customer data and permission to publish it.
const customerProofs: readonly CustomerProof[] = []

export function SocialProof({ customers = customerProofs }: { customers?: readonly CustomerProof[] }) {
  if (customers.length === 0) return null
  return <section className="conversion-section story-section" aria-labelledby="customer-proof-title">
    <div className="story-container">
      <div className="story-heading conversion-heading"><h2 id="customer-proof-title">Masabu kullanan işletmelerden.</h2></div>
      <div className="conversion-grid">
        {customers.map((customer) => <article className="conversion-card" key={customer.businessName}>
          {customer.logo && <Image {...customer.logo} alt={`${customer.businessName} logosu`} className="conversion-customer-logo" />}
          <h3>{customer.businessName}</h3>
          {customer.testimonial && <blockquote>{customer.testimonial}</blockquote>}
          {!!customer.modules?.length && <p>Kullanılan modüller: {customer.modules.join(', ')}</p>}
          {customer.metric && <p><strong>{customer.metric.value} {customer.metric.label}</strong><br />{customer.metric.context}</p>}
        </article>)}
      </div>
    </div>
  </section>
}
