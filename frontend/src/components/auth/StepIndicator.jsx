import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function StepIndicator({ steps, current, label = 'ขั้นตอน' }) {
  return (
    <ol className="flex items-center gap-2" aria-label={label}>
      {steps.map((s, i) => {
        const isDone = i < current
        const isCurrent = i === current
        return (
          <li
            key={s.key}
            className="flex flex-1 items-center gap-2"
            aria-current={isCurrent ? 'step' : undefined}
          >
            <span
              className={cn(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-medium',
                isDone && 'bg-primary text-primary-foreground',
                isCurrent && 'bg-primary/15 text-primary ring-2 ring-primary',
                !isDone && !isCurrent && 'bg-muted text-muted-foreground'
              )}
              aria-hidden="true"
            >
              {isDone ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-xs sm:text-sm',
                isCurrent ? 'font-medium text-foreground' : 'text-muted-foreground'
              )}
            >
              {s.label}
            </span>
            <span className="sr-only">
              {isCurrent ? 'ขั้นตอนปัจจุบัน' : isDone ? 'เสร็จแล้ว' : 'ยังไม่ถึง'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
