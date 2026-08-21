import { LEGAL_SERVICE_PROVIDERS } from '../lib/legal-service-providers'

export function LegalProviderList() {
  return (
    <ul className="legal-provider-list">
      {LEGAL_SERVICE_PROVIDERS.map((provider) => (
        <li key={provider.name}>
          <strong><a href={provider.href}>{provider.name}</a></strong>
          <span>{provider.purpose}</span>
          <small>{provider.data}</small>
        </li>
      ))}
    </ul>
  )
}

