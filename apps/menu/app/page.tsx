export const metadata = { robots: { index: false, follow: true } }

export default function MenuRootPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <p className="text-text-muted">Scan a QR code to view a restaurant menu.</p>
    </main>
  )
}
