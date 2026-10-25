import { CheckIcon } from 'lucide-react'

const STEPS = [['Dosyanı yükle', 'Yükle'], ['Birlikte kontrol et', 'Kontrol et'], ['Menüne ekle', 'Ekle']] as const

/** Three-step indicator: a 2px bar per step, a check on finished steps, the current step in bold. */
export function ImportSteps({ current, done = current - 1 }: { current: 1 | 2 | 3; done?: number }) {
  return <ol className="grid grid-cols-3 gap-1.5 sm:gap-2" aria-label="Aktarım adımları">
    {STEPS.map(([label, short], index) => {
      const step = index + 1
      const finished = step <= done
      return <li key={label} className="grid gap-1.5 sm:gap-2" aria-current={step === current ? 'step' : undefined}>
        <span className={`h-0.5 rounded-full ${step <= current ? 'bg-foreground' : 'bg-border'}`} />
        <span className={`flex items-center gap-1 text-xs sm:text-[13px] ${step === current && !finished ? 'font-medium' : 'text-muted-foreground'}`}>
          {finished && <CheckIcon className="size-3 text-[var(--positive)]" aria-label="tamamlandı" />}
          <span className="sm:hidden">{step}. {short}</span><span className="max-sm:hidden">{step}. {label}</span>
        </span>
      </li>
    })}
  </ol>
}
