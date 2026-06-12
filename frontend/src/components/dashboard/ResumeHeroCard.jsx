import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, GraduationCap, Trophy } from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { progressApi } from '@/api/progress'
import { quizzesApi } from '@/api/quizzes'
import { mediaUrl } from '@/utils/media'
import { fmtTime } from '@/utils/formatting'
import { BUTTONS } from '@/constants/labels'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

const FALLBACK_COVER = '/elearning/forest_logo.png'

/**
 * Resolve the lesson to resume into, mirroring CourseViewerPage exactly:
 * flatten modules→lessons in order, prefer the most-recently-accessed ongoing
 * lesson, then most-recent, then first incomplete, then the first lesson.
 */
function resolveResume(allLessons, progMap) {
  const accessed = allLessons
    .map((l) => ({ lesson: l, p: progMap[l.id] }))
    .filter((x) => x.p?.last_accessed_at)
    .sort(
      (a, b) =>
        new Date(b.p.last_accessed_at).getTime() - new Date(a.p.last_accessed_at).getTime()
    )
  const mostRecentOngoing = accessed.find((x) => !x.p.is_completed)?.lesson
  const mostRecent = accessed[0]?.lesson
  const firstIncomplete = allLessons.find((l) => !progMap[l.id]?.is_completed)
  return mostRecentOngoing || mostRecent || firstIncomplete || allLessons[0]
}

/**
 * The active hero. Owns the three course-scoped fetches (course detail,
 * progress, quizzes) — keyed on the course id and each caught independently so
 * a single failure only hides its own line. Remounted by the parent (`key`)
 * when the hero course changes.
 */
function HeroCard({ hero }) {
  const heroId = hero.course_id
  const [detail, setDetail] = useState(null) // null=loading, false=failed, object=loaded
  const [prog, setProg] = useState(null) // null=loading, array otherwise
  const [quizzes, setQuizzes] = useState(null) // null=loading, array otherwise

  useEffect(() => {
    let active = true
    coursesApi
      .getById(heroId)
      .then((d) => active && setDetail(d))
      .catch(() => active && setDetail(false))
    progressApi
      .getByCourse(heroId)
      .then((p) => active && setProg(Array.isArray(p) ? p : []))
      .catch(() => active && setProg([]))
    quizzesApi
      .getCourseAll(heroId)
      .then((q) => active && setQuizzes(Array.isArray(q) ? q : []))
      .catch(() => active && setQuizzes([]))
    return () => {
      active = false
    }
  }, [heroId])

  const detailLoaded = detail && detail !== false
  const progMap = {}
  if (Array.isArray(prog)) for (const p of prog) progMap[p.lesson_id] = p

  const allLessons = detailLoaded ? (detail.modules ?? []).flatMap((m) => m.lessons ?? []) : []
  const hasLessons = allLessons.length > 0
  const noLessonsHero = detailLoaded && allLessons.length === 0

  const resumeLesson = hasLessons ? resolveResume(allLessons, progMap) : null
  const saved = resumeLesson ? progMap[resumeLesson.id] : null
  const resumeSeconds =
    saved && saved.current_position > 0 && !saved.is_completed ? saved.current_position : 0

  // Deep link seeks to the saved position automatically (see CourseViewerPage).
  // Fall back to the generic resume route while pending or if detail failed.
  let ctaHref = `/courses/${heroId}/learn`
  if (detailLoaded) {
    ctaHref = hasLessons ? `/courses/${heroId}/learn/${resumeLesson.id}` : `/courses/${heroId}`
  }

  // Quiz status — only real quizzes (with questions). Hidden for no-lesson heroes.
  let quizLine = null
  if (Array.isArray(quizzes) && !noLessonsHero) {
    const real = quizzes.filter((q) => (q.questions?.length ?? 0) > 0)
    if (real.length > 0) {
      const finalQuiz = real.find((q) => q.placement === 'final')
      const allLessonsDone =
        (hero.total_lessons ?? 0) > 0 && (hero.completed_lessons ?? 0) >= hero.total_lessons
      if (finalQuiz && !finalQuiz.is_passed && allLessonsDone) {
        quizLine = <p className="mt-2 text-sm font-medium text-warning">พร้อมสอบท้ายหลักสูตร</p>
      } else {
        const passed = real.filter((q) => q.is_passed).length
        quizLine = (
          <p className="mt-2 text-sm text-muted-foreground">
            แบบทดสอบผ่านแล้ว {passed}/{real.length}
          </p>
        )
      }
    }
  }

  const cover = hero.cover_image ? mediaUrl(hero.cover_image) : FALLBACK_COVER
  const pct = Math.round(hero.progress_percent ?? 0)
  const remaining = Math.max(0, (hero.total_lessons ?? 0) - (hero.completed_lessons ?? 0))

  return (
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
              เรียนต่อจากที่ค้างไว้
            </div>
            <h2 className="mt-1 text-xl font-semibold text-foreground sm:text-2xl">{hero.title}</h2>

            {detail === false ? null : detail === null || prog === null ? (
              <Skeleton className="mt-3 h-4 w-2/3" />
            ) : hasLessons ? (
              <p className="mt-3 text-sm text-muted-foreground">
                บทเรียนล่าสุด:{' '}
                <span className="font-medium text-foreground">{resumeLesson.title}</span>
                {resumeSeconds > 0 ? ` · ดูต่อจาก ${fmtTime(resumeSeconds)}` : ' · เริ่มบทเรียนนี้'}
              </p>
            ) : null}

            <div className="mt-3 max-w-md space-y-1.5">
              <Progress value={pct} className="h-2" />
              <div className="text-xs text-muted-foreground">
                คืบหน้า {pct}%
                {(hero.total_lessons ?? 0) > 0 && ` · เหลืออีก ${remaining} บทเรียน`}
              </div>
            </div>

            {quizLine}
          </div>

          <Button asChild size="lg" className="w-full sm:w-auto">
            <Link to={ctaHref}>
              {BUTTONS.CONTINUE}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  )
}

function GetStarted() {
  return (
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
  )
}

function AllComplete() {
  return (
    <Card className="border-dashed border-border/60">
      <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
          <Trophy className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">คุณเรียนจบทุกหลักสูตรแล้ว</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          สำรวจหลักสูตรใหม่เพื่อพัฒนาทักษะต่อ
        </p>
        <Button asChild className="mt-2">
          <Link to="/courses">
            {BUTTONS.VIEW_ALL_COURSES}
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

/**
 * Picks the right hero state. `hero` is the chosen in-progress enrollment (or
 * null) computed by the page; `enrollments` distinguishes loading / empty /
 * all-complete.
 */
export default function ResumeHeroCard({ enrollments, hero }) {
  if (enrollments === null) return <Skeleton className="h-56 w-full rounded-xl" />
  if (hero) return <HeroCard key={hero.course_id} hero={hero} />
  const list = Array.isArray(enrollments) ? enrollments : []
  return list.length === 0 ? <GetStarted /> : <AllComplete />
}
