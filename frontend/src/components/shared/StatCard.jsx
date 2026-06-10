import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

// Visual variants match the three pre-consolidation copies exactly:
// sm = admin department detail KpiCard, md = admin dashboard KPICard,
// lg = learner dashboard StatCard.
const SIZES = {
  sm: {
    content: 'flex items-start gap-3 p-4',
    iconBox: 'h-9 w-9 rounded-md',
    icon: 'h-4 w-4',
    hint: '',
  },
  md: {
    content: 'flex items-start gap-4 p-5',
    iconBox: 'h-10 w-10 rounded-md',
    icon: 'h-5 w-5',
    hint: 'mt-0.5',
  },
  lg: {
    content: 'flex items-center gap-4 p-5',
    iconBox: 'h-11 w-11 rounded-lg',
    icon: 'h-5 w-5',
    hint: '',
  },
}

export default function StatCard({ icon: Icon, label, value, hint, size = 'md' }) {
  const s = SIZES[size] ?? SIZES.md
  return (
    <Card className="border-border/60">
      <CardContent className={s.content}>
        <div
          className={cn(
            'flex flex-shrink-0 items-center justify-center bg-primary/10 text-primary',
            s.iconBox
          )}
        >
          <Icon className={s.icon} />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
          {hint && (
            <div className={cn('text-[11px] text-muted-foreground', s.hint)}>{hint}</div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
