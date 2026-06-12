import { Link } from 'react-router-dom'
import { Award, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { daysUntil } from '@/utils/formatting'
import { cn } from '@/lib/utils'

const MAX_SHOWN = 5

function Stat({ label, value, tone }) {
  const cls =
    tone === 'warning'
      ? 'text-warning'
      : tone === 'destructive'
        ? 'text-destructive'
        : 'text-foreground'
  return (
    <div className="px-2 py-3 text-center sm:px-3">
      <div className={cn('text-xl font-semibold tabular-nums sm:text-2xl', cls)}>{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{label}</div>
    </div>
  )
}

/**
 * Certificate health, derived entirely client-side from certificatesApi.adminAll().
 * Three at-a-glance stats + the soonest-expiring certs (within 30 days).
 */
export default function CertificatesPanel({ certs }) {
  if (certs === null) return <Skeleton className="h-56 w-full rounded-xl" />

  const list = Array.isArray(certs) ? certs : []
  const active = list.filter((c) => !c.is_revoked && !c.is_expired).length
  const revoked = list.filter((c) => c.is_revoked).length
  const expiring = list
    .filter((c) => !c.is_revoked && !c.is_expired && c.expires_at)
    .map((c) => ({ cert: c, days: daysUntil(c.expires_at) }))
    .filter((x) => x.days != null && x.days > 0 && x.days <= 30)
    .sort((a, b) => a.days - b.days)

  return (
    <Card className="border-border/60">
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-3">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
          <Award className="h-4 w-4 text-muted-foreground" />
          ใบรับรอง
        </h2>
        <Button asChild variant="ghost" size="sm">
          <Link to="/admin/certificates">
            จัดการใบรับรอง
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 divide-x divide-border/60 rounded-lg border border-border/60">
          <Stat label="ใบรับรองที่ใช้งานได้" value={active} />
          <Stat label="ใกล้หมดอายุใน 30 วัน" value={expiring.length} tone="warning" />
          <Stat label="ถูกเพิกถอน" value={revoked} tone="destructive" />
        </div>

        <div className="mt-4">
          {expiring.length === 0 ? (
            <div className="rounded-md border border-success/40 bg-success/5 px-3 py-3 text-center text-sm text-muted-foreground">
              ไม่มีใบรับรองที่ใกล้หมดอายุ
            </div>
          ) : (
            <ul className="space-y-1.5">
              {expiring.slice(0, MAX_SHOWN).map(({ cert, days }) => (
                <li key={cert.id}>
                  <Link
                    to="/admin/certificates"
                    className="flex items-center gap-2 rounded-md border border-warning/30 bg-background px-3 py-2 text-sm transition-colors hover:bg-warning/10"
                  >
                    <span className="line-clamp-1 flex-1 text-foreground">
                      {cert.user?.full_name} · {cert.course?.title}
                    </span>
                    <span className="flex-shrink-0 text-[11px] font-medium tabular-nums text-warning">
                      เหลืออีก {days} วัน
                    </span>
                    <ChevronRight
                      className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
