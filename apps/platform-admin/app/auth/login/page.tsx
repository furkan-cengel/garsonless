import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return <main className="auth-wrap"><section className="auth-card"><p className="eyebrow">Masabu Platform</p><h1>Yetkili operasyon girişi</h1><p>Bu alan restoran panelinden ayrıdır ve çok faktörlü doğrulama gerektirir.</p><LoginForm /></section></main>
}
