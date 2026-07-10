'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StepRestaurantInfo from '../../../components/onboarding/StepRestaurantInfo'
import StepTemplateSelect from '../../../components/onboarding/StepTemplateSelect'
import StepLogoUpload from '../../../components/onboarding/StepLogoUpload'

const STEPS = [
  { label: 'Restaurant info', short: '1' },
  { label: 'Choose theme',    short: '2' },
  { label: 'Upload logo',     short: '3' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [restaurantId, setRestaurantId] = useState('')

  function handleCreated(id: string) {
    setRestaurantId(id)
    setStep(1)
  }

  function handleTemplateSelected(id: string) {
    void id
    setStep(2)
  }

  function handleFinish() {
    router.push(`/dashboard/${restaurantId}/menu`)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
    }}>
      {/* Logo mark — real wordmark on the light onboarding surface. */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center' }}>
        <img src="/brand/masabu-logo-transparent.svg" alt="Masabu" style={{ height: 24, width: 'auto', display: 'block' }} />
      </div>

      <div style={{ width: '100%', maxWidth: 480 }}>
        {/* Step header */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
            Set up your restaurant
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--text-3)', marginTop: 6 }}>
            Just a few steps to get your menu live.
          </p>
        </div>

        {/* Step indicators */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 4, marginBottom: 24,
        }}>
          {STEPS.map((s, i) => {
            const done    = i < step
            const current = i === step
            return (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: done || current ? 'var(--text)' : 'var(--surface-3)',
                    color: done || current ? 'var(--bg)' : 'var(--text-3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700,
                    transition: 'background 200ms',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{
                    fontSize: 12.5, fontWeight: current ? 600 : 400,
                    color: current ? 'var(--text)' : 'var(--text-3)',
                    transition: 'color 200ms',
                  }}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div style={{
                    width: 20, height: 1,
                    background: i < step ? 'var(--text-3)' : 'var(--divider)',
                    marginLeft: 4,
                    transition: 'background 200ms',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Card */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '28px 28px',
          boxShadow: 'var(--shadow-2)',
        }}>
          {step === 0 && <StepRestaurantInfo onCreated={handleCreated} />}
          {step === 1 && (
            <StepTemplateSelect
              restaurantId={restaurantId}
              onSelected={handleTemplateSelected}
            />
          )}
          {step === 2 && (
            <StepLogoUpload
              restaurantId={restaurantId}
              onFinish={handleFinish}
            />
          )}
        </div>
      </div>
    </div>
  )
}
