import { signOut } from '../../actions'

export default function DeniedPage() {
  return <main className="auth-wrap"><section className="auth-card"><p className="eyebrow">Erişim reddedildi</p><h1>Platform yetkin bulunmuyor.</h1><p>Restoran sahibi veya ekip üyesi olmak bu kontrol düzlemine erişim sağlamaz. Yetkinin platform güvenlik sorumlusu tarafından ayrıca atanması gerekir.</p><form action={signOut}><button className="button primary form-button" type="submit">Güvenli çıkış</button></form></section></main>
}
