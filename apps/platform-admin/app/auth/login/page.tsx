import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return <main className="auth-wrap"><section className="auth-card"><p className="eyebrow"><span style={{ textTransform: 'none' }}>masabu</span> Platform</p><h1>Yetkili operasyon girişi</h1><p>Bu alan restoran panelinden ayrıdır ve iki adımlı doğrulama gerektirir.</p><LoginForm /></section></main>
}
