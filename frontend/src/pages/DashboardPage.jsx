import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
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
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Progress } from '@/components/ui/progress'
import CourseCard from '@/components/learner/CourseCard'

const FALLBACK_COVER = '/elearning/forest_logo.png'

function formatThaiDate(dateString) {
  if (!dateString) return ''
  return new Date(dateString).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState(null)
  const [certs, setCerts] = useState(null)

  useEffect(() => {
    coursesApi.myEnrollments().then(setEnrollments).catch(() => setEnrollments([]))
    certificatesApi.mine().then(setCerts).catch(() => setCerts([]))
  }, [])

  const progressOf = (e) => e?.progress_percent ?? e?.progress_percentage ?? 0
  const inProgress = enrollments?.filter((e) => progressOf(e) < 100) ?? []
  const completed = enrollments?.filter((e) => progressOf(e) >= 100) ?? []
  const continueLearning = inProgress[0]

  const continueId = continueLearning?.course?.id ?? continueLearning?.course_id
  const continueTitle = continueLearning?.course?.title ?? continueLearning?.title
  const continueCoverField = continueLearning?.course?.cover_image ?? continueLearning?.cover_image
  const cover = continueCoverField ? mediaUrl(continueCoverField) : FALLBACK_COVER
  const continueProgress = progressOf(continueLearning)

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        สวัสดี {user?.full_name?.split(' ')[0] || 'คุณ'}
      </div>

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
          icon={BookOpen}
          label="กำลังเรียน"
          value={enrollments === null ? '—' : inProgress.length}
        />
        <StatCard
          icon={Award}
          label="เรียนจบแล้ว"
          value={enrollments === null ? '—' : completed.length}
        />
        <StatCard
          icon={Trophy}
          label="ใบรับรอง"
          value={certs === null ? '—' : certs.length}
        />
      </div>

      {/* My courses row */}
      {inProgress.length > 1 && (
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
              {inProgress.slice(0, 6).map((e) => {
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
                <Card className="border-border/60">
                  <CardContent className="flex items-start gap-3 p-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
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
                          ออกเมื่อ {formatThaiDate(c.issued_at)}
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
