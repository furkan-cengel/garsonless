import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <style>{`
        [data-scope="auth"] {
          --bg:       #fdfaf5;
          --bg-2:     #f8f3eb;
          --surface:  #ffffff;
          --ink:      #1c1814;
          --ink-2:    #4a443e;
          --ink-3:    #7a7166;
          --ink-4:    #a89e91;
          --line:     #e8dfd0;
          --brand:    #a13b7a;
          --brand-soft:#f5e8f0;
          --accent:   #d97757;
          --accent-2: #ffd089;
          --night:    #1a1612;
          --positive: #137a4d;
          --positive-bg: #e6f4ec;
          --critical: #b42318;
          --critical-bg: #fde7e5;
        }
        [data-scope="auth"] .font-display {
          font-family: 'Fraunces', Georgia, serif;
        }
        @keyframes float {
          0%, 100% { transform: translateY(0) rotate(var(--rot,0deg)); }
          50%       { transform: translateY(-10px) rotate(var(--rot,0deg)); }
        }
        @keyframes pulse-soft {
          0%, 100% { opacity: 1; }
          50%       { opacity: .4; }
        }
        @media (max-width: 900px) {
          [data-scope="auth"] .auth-page {
            min-width: 0;
          }
          [data-scope="auth"] .auth-visual-panel {
            display: none !important;
          }
          [data-scope="auth"] .auth-main {
            min-width: 0;
            padding: 32px 18px !important;
            align-items: flex-start !important;
          }
          [data-scope="auth"] .auth-top-link {
            display: none !important;
          }
        }
      `}</style>
      <div
        data-scope="auth"
        style={{
          background: 'var(--bg)',
          minHeight: '100vh',
          fontFamily: "'Geist', system-ui, -apple-system, sans-serif",
          fontSize: 15,
          lineHeight: 1.55,
          color: 'var(--ink)',
        }}
      >
        {children}
      </div>
    </>
  )
}
