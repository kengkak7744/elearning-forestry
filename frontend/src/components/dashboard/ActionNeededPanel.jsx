import { Link } from 'react-router-dom'
import { AlertTriangle, CheckCircle2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { daysUntil } from '@/utils/formatting'
import { cn } from '@/lib/utils'

const MAX_SHOWN = 5

const TONE_CLASS = {
  destructive: 'font-medium text-destructive',
  warning: 'font-medium text-warning',
  muted: 'text-muted-foreground',
}

/**
 * Build the deduped action list. Dedup is by course_id with mandatory winning:
 *   1. Mandatory course incomplete (pct < 100) or its latest cert expired
 *   2. A non-revoked cert expiring within 30 days (latest cert per course)
 *   3. An expired cert on a non-mandatory course
 */
function buildItems(enrollmentList, certList, mandatoryList) {
  const enrollPct = new Map(enrollmentList.map((e) => [e.course_id, e.progress_percent ?? 0]))
  const enrolledIds = new Set(enrollmentList.map((e) => e.course_id))
  const mandatoryIds = new Set(mandatoryList.map((c) => c.id))

  // Latest cert per course — server orders desc by issued_at, so the first
  // occurrence wins and suppresses older certs for the same course.
  const certByCourse = new Map()
  for (const c of certList) {
    const cid = c.course?.id
    if (cid && !certByCourse.has(cid)) certByCourse.set(cid, c)
  }

  const linkTo = (cid) => (enrolledIds.has(cid) ? `/courses/${cid}/learn` : `/courses/${cid}`)
  const items = []
  const seen = new Set()

  // 1. Mandatory still owed.
  for (const c of mandatoryList) {
    if (c.is_published === false) continue
    const pct = enrollPct.get(c.id)
    const enrolled = pct !== undefined
    const cert = certByCourse.get(c.id)
    const expired = cert?.is_expired === true
    if ((pct ?? 0) >= 100 && !expired) continue
    let statusLabel = enrolled ? `${Math.round(pct)}%` : 'ยังไม่ลงทะเบียน'
    if (expired) statusLabel = 'ใบรับรองหมดอายุ'
    items.push({
      key: `m-${c.id}`,
      title: c.title,
      // Expired → course detail page, where the "เริ่มอบรมใหม่" retake CTA
      // lives (the viewer alone won't reset progress for recertification).
      to: expired ? `/courses/${c.id}` : linkTo(c.id),
      statusLabel,
      tone: expired ? 'destructive' : 'muted',
    })
    seen.add(c.id)
  }

  // 2. Cert expiring soon (non-mandatory or complete-mandatory courses).
  for (const [cid, cert] of certByCourse) {
    if (seen.has(cid) || cert.is_revoked || cert.is_expired || !cert.expires_at) continue
    const daysLeft = daysUntil(cert.expires_at)
    if (daysLeft == null || daysLeft <= 0 || daysLeft > 30) continue
    items.push({
      key: `e-${cid}`,
      title: cert.course?.title,
      to: linkTo(cid),
      statusLabel: `เหลือ ${daysLeft} วัน`,
      tone: 'warning',
    })
    seen.add(cid)
  }

  // 3. Expired cert on a non-mandatory course.
  for (const [cid, cert] of certByCourse) {
    if (seen.has(cid) || cert.is_revoked || !cert.is_expired || mandatoryIds.has(cid)) continue
    items.push({
      key: `x-${cid}`,
      title: cert.course?.title,
      // Detail page hosts the recertification retake CTA.
      to: `/courses/${cid}`,
      statusLabel: 'หมดอายุแล้ว — ต้องอบรมใหม่',
      tone: 'destructive',
    })
    seen.add(cid)
  }

  return items
}

/**
 * Right-rail panel surfacing mandatory courses + certs needing attention.
 * Always renders (so the desktop grid stays stable): skeleton while any input
 * is loading, a success state when there's nothing to do, else the list.
 */
export default function ActionNeededPanel({ enrollments, certs, mandatory }) {
  if (enrollments === null || certs === null || mandatory === null) {
    return <Skeleton className="h-40 w-full rounded-xl" />
  }

  const items = buildItems(
    Array.isArray(enrollments) ? enrollments : [],
    Array.isArray(certs) ? certs : [],
    Array.isArray(mandatory) ? mandatory : []
  )

  if (items.length === 0) {
    return (
      <Card className="border-success/40 bg-success/5">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-success/20 text-success">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">เยี่ยมมาก!</div>
            <p className="text-xs text-muted-foreground">ไม่มีรายการค้างดำเนินการ</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-warning/20 text-warning">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">ต้องดำเนินการ</div>
            <p className="text-xs text-muted-foreground">หลักสูตรบังคับและใบรับรองที่ต้องต่ออายุ</p>
          </div>
        </div>
        <ul className="mt-3 space-y-1.5">
          {items.slice(0, MAX_SHOWN).map((it) => (
            <li key={it.key}>
              <Link
                to={it.to}
                className="flex items-center gap-2 rounded-md border border-warning/30 bg-background px-3 py-2 text-sm transition-colors hover:bg-warning/10"
              >
                <span className="line-clamp-1 flex-1 text-foreground">{it.title}</span>
                <span className={cn('flex-shrink-0 text-[11px] tabular-nums', TONE_CLASS[it.tone])}>
                  {it.statusLabel}
                </span>
                <ChevronRight
                  className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
        {items.length > MAX_SHOWN && (
          <div className="mt-2 text-[11px] text-muted-foreground">
            และอีก {items.length - MAX_SHOWN} รายการ
          </div>
        )}
      </CardContent>
    </Card>
  )
}
