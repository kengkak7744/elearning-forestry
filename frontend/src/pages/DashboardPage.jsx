import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  Award,
  BookOpen,
  ChevronRight,
  Download,
  GraduationCap,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { certificatesApi } from '@/api/certificates'
import { coursesApi } from '@/api/courses'
import { mediaUrl } from '@/utils/media'
import { BUTTONS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import CourseCard from '@/components/learner/CourseCard'
import StatCard from '@/components/shared/StatCard'
import { formatThaiDate } from '@/utils/formatting'

const FALLBACK_COVER = '/elearning/forest_logo.png'

function initials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

export default function DashboardPage() {
  useDocumentTitle('หน้าหลัก')
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState(null)
  const [certs, setCerts] = useState(null)
  const [mandatory, setMandatory] = useState(null)
  const [allCourses, setAllCourses] = useState(null)

  useEffect(() => {
    coursesApi.myEnrollments().then(setEnrollments).catch(() => setEnrollments([]))
    certificatesApi.mine().then(setCerts).catch(() => setCerts([]))
    // All mandatory courses in the catalog — joined client-side against
    // enrollments to figure out which ones the user still owes.
    coursesApi.list({ is_mandatory: true }).then(setMandatory).catch(() => setMandatory([]))
    // Latest catalog for the "browse more" row on Dashboard — pulled separately
    // so a slow catalog request never blocks the hero/enrollment cards.
    coursesApi.list({ limit: 20 }).then(setAllCourses).catch(() => setAllCourses([]))
  }, [])

  const progressOf = (e) => e?.progress_percent ?? e?.progress_percentage ?? 0
  // Tolerate the API returning anything non-array — never crash the dashboard.
  const enrollmentList = Array.isArray(enrollments) ? enrollments : []
  const inProgress = enrollmentList.filter((e) => progressOf(e) < 100)
  const completed = enrollmentList.filter((e) => progressOf(e) >= 100)
  const continueLearning = inProgress[0]

  const continueId = continueLearning?.course?.id ?? continueLearning?.course_id
  const continueTitle = continueLearning?.course?.title ?? continueLearning?.title
  const continueCoverField = continueLearning?.course?.cover_image ?? continueLearning?.cover_image
  const cover = continueCoverField ? mediaUrl(continueCoverField) : FALLBACK_COVER
  const continueProgress = progressOf(continueLearning)

  // Mandatory courses still owed:
  //   - progress < 100%, OR
  //   - has a certificate that's expired (recertification needed)
  const enrollmentByCourseId = new Map(
    enrollmentList.map((e) => [e.course?.id ?? e.course_id, progressOf(e)])
  )
  const certList = Array.isArray(certs) ? certs : []
  // Most-recent cert per course wins (server already orders desc by issued_at).
  const certByCourseId = new Map()
  for (const c of certList) {
    const cid = c.course?.id
    if (cid && !certByCourseId.has(cid)) certByCourseId.set(cid, c)
  }
  const mandatoryList = Array.isArray(mandatory) ? mandatory : []
  const mandatoryIncomplete = mandatoryList.filter((c) => {
    if (c.is_published === false) return false
    const pct = enrollmentByCourseId.get(c.id) ?? 0
    if (pct < 100) return true
    const cert = certByCourseId.get(c.id)
    return cert?.is_expired === true
  })

  const formatExpiry = (iso) =>
    iso
      ? new Date(iso).toLocaleDateString('th-TH', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : ''

  // "Browse more" — courses the user hasn't enrolled in yet. Filters out
  // anything already in their enrollments + drops drafts. Capped at 8 so the
  // row stays compact; full catalog is one click away via the "ดูทั้งหมด" link.
  const enrolledCourseIds = new Set(
    enrollmentList.map((e) => e.course?.id ?? e.course_id).filter(Boolean)
  )
  const exploreCourses = (Array.isArray(allCourses) ? allCourses : [])
    .filter((c) => c.is_published !== false && !enrolledCourseIds.has(c.id))
    .slice(0, 8)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-center gap-3">
        <Avatar className="h-10 w-10">
          {user?.profile_image && (
            <AvatarImage src={mediaUrl(user.profile_image)} alt={user?.full_name || ''} />
          )}
          <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
            {initials(user?.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="h-4 w-4 text-primary" />
          สวัสดี {user?.full_name?.split(' ')[0] || 'คุณ'}
        </div>
      </div>

      {/* Mandatory courses nudge — shown above the hero so it's the first thing
          a learner sees if they owe required training. Loads independently from
          enrollments + mandatory list, so we wait for both before deciding. */}
      {Array.isArray(mandatory) && Array.isArray(enrollments) && mandatoryIncomplete.length > 0 && (
        <Card className="mb-6 border-warning/40 bg-warning/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-warning/20 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                หลักสูตรบังคับที่ยังไม่จบ ({mandatoryIncomplete.length})
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                หลักสูตรเหล่านี้เป็นข้อบังคับสำหรับเจ้าหน้าที่ของคุณ
              </p>
              <ul className="mt-3 space-y-1.5">
                {mandatoryIncomplete.slice(0, 5).map((c) => {
                  const pct = enrollmentByCourseId.get(c.id)
                  const enrolled = pct !== undefined
                  const cert = certByCourseId.get(c.id)
                  const expired = cert?.is_expired === true
                  let statusLabel = enrolled ? `${Math.round(pct)}%` : 'ยังไม่ลงทะเบียน'
                  if (expired) statusLabel = 'ใบรับรองหมดอายุ'
                  return (
                    <li key={c.id}>
                      <Link
                        to={enrolled ? `/courses/${c.id}/learn` : `/courses/${c.id}`}
                        className="flex items-center gap-2 rounded-md border border-warning/30 bg-background px-3 py-2 text-sm transition-colors hover:bg-warning/10"
                      >
                        <span className="line-clamp-1 flex-1 text-foreground">{c.title}</span>
                        <span
                          className={`flex-shrink-0 text-[11px] tabular-nums ${
                            expired ? 'font-medium text-destructive' : 'text-muted-foreground'
                          }`}
                        >
                          {statusLabel}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
                      </Link>
                    </li>
                  )
                })}
              </ul>
              {mandatoryIncomplete.length > 5 && (
                <div className="mt-2 text-[11px] text-muted-foreground">
                  และอีก {mandatoryIncomplete.length - 5} หลักสูตร
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero: Continue learning OR get started */}
      {enrollments === null ? (
        <Skeleton className="h-56 w-full rounded-xl" />
      ) : continueLearning ? (
        <Card className="overflow-hidden border-border/60">
          <div className="grid gap-0 md:grid-cols-[280px_1fr]">
            <div className="aspect-video h-full w-full overflow-hidden bg-muted md:aspect-auto">
              <img
                src={cover}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                fetchpriority="high"
              />
            </div>
            <div className="flex flex-col justify-between gap-4 p-5 sm:p-6">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  เรียนต่อ
                </div>
                <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">
                  {continueTitle}
                </h2>
                <div className="mt-3 max-w-md space-y-1.5">
                  <Progress value={continueProgress} className="h-2" />
                  <div className="text-xs text-muted-foreground">
                    คืบหน้า {Math.round(continueProgress)}%
                  </div>
                </div>
              </div>
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link to={`/courses/${continueId}/learn`}>
                  {BUTTONS.CONTINUE}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <GraduationCap className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">เริ่มเรียนหลักสูตรแรกของคุณ</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              เลือกหลักสูตรจากรายการแล้วเริ่มต้นเรียนรู้ พร้อมรับใบรับรองเมื่อเรียนจบ
            </p>
            <Button asChild className="mt-2">
              <Link to="/courses">
                {BUTTONS.VIEW_ALL_COURSES}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          size="lg"
          icon={BookOpen}
          label="กำลังเรียน"
          value={enrollments === null ? '—' : inProgress.length}
        />
        <StatCard
          size="lg"
          icon={Award}
          label="เรียนจบแล้ว"
          value={enrollments === null ? '—' : completed.length}
        />
        <StatCard
          size="lg"
          icon={Trophy}
          label="ใบรับรอง"
          value={certs === null ? '—' : certs.length}
        />
      </div>

      {/* My courses row — in-progress first, then completed */}
      {enrollmentList.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h3 className="text-lg font-semibold text-foreground">หลักสูตรของฉัน</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/profile">
                {BUTTONS.VIEW_ALL}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <div className="flex gap-4">
              {[...inProgress, ...completed].slice(0, 8).map((e) => {
                const c = e.course ?? {
                  id: e.course_id,
                  title: e.title,
                  cover_image: e.cover_image,
                  category: e.category,
                  is_mandatory: e.is_mandatory,
                }
                return (
                  <CourseCard
                    key={c.id}
                    course={c}
                    variant="compact"
                    progress={progressOf(e)}
                  />
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Browse-more row — published courses the user hasn't enrolled in yet.
          Keeps the catalog one click away even after they're enrolled in
          something. Hidden when caught up on everything. */}
      {exploreCourses.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h3 className="text-lg font-semibold text-foreground">หลักสูตรอื่น ๆ</h3>
            <Button asChild variant="ghost" size="sm">
              <Link to="/courses">
                {BUTTONS.VIEW_ALL_COURSES}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 pb-2">
            <div className="flex gap-4">
              {exploreCourses.map((c) => (
                <CourseCard key={c.id} course={c} variant="compact" />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Certificates */}
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
            {certs.map((c) => (
              <li key={c.id}>
                <Card
                  className={c.is_expired ? 'border-destructive/40 opacity-90' : 'border-border/60'}
                >
                  <CardContent className="flex items-start gap-3 p-4">
                    <div
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md ${
                        c.is_expired
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium text-foreground">
                        {c.course?.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        เลขที่ {c.certificate_number}
                        {c.final_score != null && (
                          <span> · คะแนน {Math.round(c.final_score)}%</span>
                        )}
                      </p>
                      {c.issued_at && (
                        <p className="text-[11px] text-muted-foreground/80">
                          ออกเมื่อ {formatThaiDate(c.issued_at, { month: 'short', fallback: '' })}
                          {c.expires_at && (
                            <span className={c.is_expired ? 'text-destructive font-medium' : ''}>
                              {' · '}
                              {c.is_expired ? 'หมดอายุแล้ว' : `หมดอายุ ${formatExpiry(c.expires_at)}`}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    <Button asChild size="sm" variant="outline">
                      <a
                        href={certificatesApi.downloadUrl(c.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        {BUTTONS.DOWNLOAD_CERTIFICATE}
                      </a>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
