import { Award, BookOpen, Trophy } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

function StatCell({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-3 py-4 sm:gap-3 sm:px-5">
      {/* Icon hidden on phones so three columns fit at 360px without overflow. */}
      <div className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-muted-foreground sm:text-xs">{label}</div>
        <div className="text-xl font-semibold tabular-nums text-foreground sm:text-2xl">
          {value ?? '—'}
        </div>
      </div>
    </div>
  )
}

/**
 * Single card, three columns: in-progress / completed / certificates.
 * Each value is a number, or null while its source is still loading.
 */
export default function DashboardStats({ inProgress, completed, certificates }) {
  return (
    <Card className="border-border/60">
      <CardContent className="grid grid-cols-3 divide-x divide-border/60 p-0">
        <StatCell icon={BookOpen} label="กำลังเรียน" value={inProgress} />
        <StatCell icon={Award} label="เรียนจบแล้ว" value={completed} />
        <StatCell icon={Trophy} label="ใบรับรอง" value={certificates} />
      </CardContent>
    </Card>
  )
}
