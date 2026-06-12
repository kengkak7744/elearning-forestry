import { Award, BookOpen, TrendingUp, Users } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import StatCard from '@/components/shared/StatCard'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/**
 * Enrollment-activity hint computed from recentEnrollments(100) timestamps.
 * Module-level (not called in a render body) so it may read Date.now().
 * "100+" when every fetched row — the server caps at 100 — is within the window.
 */
function last7Label(recent) {
  if (!Array.isArray(recent) || recent.length === 0) return undefined
  const cutoff = Date.now() - WEEK_MS
  const n = recent.filter((r) => r.enrolled_at && new Date(r.enrolled_at).getTime() >= cutoff).length
  if (n === recent.length && recent.length >= 100) return '100+ ครั้งใน 7 วันล่าสุด'
  return `${n} ครั้งใน 7 วันล่าสุด`
}

export default function AdminKpiRow({ overview, recent }) {
  if (overview === null) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  const num = (x) => (x == null ? '—' : x)

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <StatCard
        icon={Users}
        label="ผู้ใช้ทั้งหมด"
        value={num(overview.total_users)}
        hint={overview.active_users != null ? `ใช้งานอยู่ ${overview.active_users} คน` : undefined}
      />
      <StatCard
        icon={BookOpen}
        label="หลักสูตรทั้งหมด"
        value={num(overview.total_courses)}
        hint={
          overview.published_courses != null
            ? `เผยแพร่ ${overview.published_courses} หลักสูตร`
            : undefined
        }
      />
      <StatCard
        icon={TrendingUp}
        label="การลงทะเบียน"
        value={num(overview.total_enrollments)}
        hint={last7Label(recent)}
      />
      <StatCard
        icon={Award}
        label="อัตราการเรียนจบ"
        value={overview.completion_rate != null ? `${overview.completion_rate}%` : '—'}
        hint="ของผู้ลงทะเบียน"
      />
    </div>
  )
}
