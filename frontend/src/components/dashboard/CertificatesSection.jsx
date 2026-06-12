import { Link } from 'react-router-dom'
import { ChevronRight, Trophy } from 'lucide-react'
import { BUTTONS } from '@/constants/labels'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import CertificateCard from '@/components/shared/CertificateCard'

const MAX_SHOWN = 4

/**
 * Dashboard certificates block: up to 4 cards in a 2-up grid, plus a ghost
 * "ดูทั้งหมด" tile linking to the profile when the learner has more.
 * `certs === null` → skeletons; `[]` → empty state.
 */
export default function CertificatesSection({ certs }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">ใบรับรองของฉัน</h3>
        {Array.isArray(certs) && certs.length > 0 && (
          <span className="text-sm text-muted-foreground">{certs.length} ใบ</span>
        )}
      </div>

      {certs === null ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-24 w-full rounded-lg" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      ) : certs.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Trophy className="h-8 w-8 text-muted-foreground/50" />
            <p>ยังไม่มีใบรับรอง — เรียนจบหลักสูตรเพื่อรับใบรับรอง</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {certs.slice(0, MAX_SHOWN).map((c) => (
            <li key={c.id}>
              <CertificateCard cert={c} />
            </li>
          ))}
          {certs.length > MAX_SHOWN && (
            <li>
              <Link
                to="/profile"
                className="flex h-full min-h-[6rem] items-center justify-center gap-1 rounded-xl border border-dashed border-border/60 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {BUTTONS.VIEW_ALL}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
