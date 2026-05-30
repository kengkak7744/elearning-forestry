import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Clock,
  GraduationCap,
  Layers,
  LineChart,
  Lock,
  PlayCircle,
  Users,
} from 'lucide-react'
import { coursesApi } from '@/api/courses'
import { quizzesApi } from '@/api/quizzes'
import { useAuth } from '@/contexts/AuthContext'
import { BUTTONS, CATEGORY_BADGES } from '@/constants/labels'
import { mediaUrl } from '@/utils/media'
import { showToast } from '@/lib/toast'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import CourseStatsModal from '@/components/CourseStatsModal'
import CourseScoresModal from '@/components/CourseScoresModal'

function formatThaiDate(d) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function LessonRow({ lesson, locked }) {
  const Icon = locked ? Lock : lesson.is_completed ? CheckCircle2 : PlayCircle
  return (
    <li
      className={`flex items-center gap-3 rounded-md px-2 py-2 ${
        locked ? 'text-muted-foreground' : 'text-foreground'
      }`}
    >
      <Icon
        className={`h-5 w-5 flex-shrink-0 ${
          locked
            ? 'text-muted-foreground/60'
            : lesson.is_completed
            ? 'text-success'
            : 'text-primary'
        }`}
      />
      <span className="flex-1 truncate text-sm">{lesson.title}</span>
      {lesson.duration_seconds ? (
        <span className="text-[11px] text-muted-foreground">
          {Math.ceil(lesson.duration_seconds / 60)} นาที
        </span>
      ) : null}
    </li>
  )
}

export default function CourseDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin' || user?.role === 'instructor'

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [enrollLoading, setEnrollLoading] = useState(false)

  // Drive the tab/bookmark title from the loaded course title once it's known.
  useDocumentTitle(course?.title)
  const [unenrollOpen, setUnenrollOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [scoresOpen, setScoresOpen] = useState(false)
  const [myQuizzes, setMyQuizzes] = useState(null)
  const [scoresLoading, setScoresLoading] = useState(false)

  const loadCourse = async () => {
    setLoading(true)
    try {
      const data = await coursesApi.getById(id)
      setCourse(data)
    } catch (err) {
      setError(err.response?.data?.detail || 'ไม่สามารถโหลดข้อมูลหลักสูตร')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleEnroll = async () => {
    setEnrollLoading(true)
    try {
      await coursesApi.enroll(course.id)
      showToast('ลงทะเบียนเรียนสำเร็จ', 'success')
      await loadCourse()
    } catch (err) {
      showToast(err.response?.data?.detail || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setEnrollLoading(false)
    }
  }

  const handleUnenroll = async () => {
    setUnenrollOpen(false)
    setEnrollLoading(true)
    try {
      await coursesApi.unenroll(course.id)
      showToast('ยกเลิกการลงทะเบียนเรียบร้อย', 'success')
      await loadCourse()
    } catch (err) {
      showToast(err.response?.data?.detail || 'เกิดข้อผิดพลาด', 'error')
    } finally {
      setEnrollLoading(false)
    }
  }

  const openMyScores = async () => {
    setScoresLoading(true)
    try {
      const data = await quizzesApi.getCourseAll(id)
      setMyQuizzes(data)
      setScoresOpen(true)
    } catch (err) {
      showToast(err.response?.data?.detail || 'โหลดคะแนนไม่สำเร็จ', 'error')
    } finally {
      setScoresLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Skeleton className="mb-4 h-6 w-32" />
        <Skeleton className="mb-6 aspect-[16/8] w-full rounded-xl" />
        <Skeleton className="mb-2 h-9 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    )
  }

  if (error || !course) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <BookOpen className="h-10 w-10 text-muted-foreground/60" />
            <p className="text-sm text-muted-foreground">{error || 'ไม่พบหลักสูตร'}</p>
            <Button asChild variant="outline">
              <Link to="/courses">
                <ArrowLeft className="mr-1 h-4 w-4" />
                {BUTTONS.BACK_TO_COURSES}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const cat = CATEGORY_BADGES[course.category]
  const cover = course.cover_image ? mediaUrl(course.cover_image) : '/elearning/forest_logo.png'
  const enrolled = !!course.is_enrolled

  const enrollCta = enrolled ? (
    <Button
      onClick={() => navigate(`/courses/${course.id}/learn`)}
      size="lg"
      className="w-full"
    >
      <PlayCircle className="mr-1.5 h-4 w-4" />
      {BUTTONS.START_LESSON}
    </Button>
  ) : (
    <Button
      onClick={handleEnroll}
      disabled={enrollLoading}
      size="lg"
      className="w-full"
    >
      <GraduationCap className="mr-1.5 h-4 w-4" />
      {enrollLoading ? BUTTONS.ENROLLING : BUTTONS.ENROLL}
    </Button>
  )

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-10 pb-32 md:pb-10">
      <Link
        to="/courses"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {BUTTONS.BACK_TO_COURSES}
      </Link>

      {/* Hero */}
      <div className="grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <div className="relative mb-5 aspect-[16/9] w-full overflow-hidden rounded-xl bg-muted">
            <img
              src={cover}
              alt=""
              loading="eager"
              fetchpriority="high"
              className="h-full w-full object-cover"
            />
            <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
              {cat && (
                <Badge variant="secondary" className="bg-background/90">
                  {cat.label}
                </Badge>
              )}
              {course.is_mandatory && (
                <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive">
                  หลักสูตรบังคับ
                </Badge>
              )}
              {!course.is_published && <Badge variant="secondary">ฉบับร่าง</Badge>}
            </div>
          </div>

          <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
            {course.title}
          </h1>
          {course.instructor_name && (
            <p className="mt-2 text-sm text-muted-foreground">
              วิทยากร: <span className="font-medium text-foreground">{course.instructor_name}</span>
            </p>
          )}

          <Tabs defaultValue="overview" className="mt-8">
            <TabsList>
              <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
              <TabsTrigger value="content">เนื้อหา</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-4">
              <Card className="border-border/60">
                <CardContent className="space-y-4 p-5 sm:p-6">
                  <h2 className="text-base font-semibold text-foreground">รายละเอียดหลักสูตร</h2>
                  {course.description ? (
                    <p className="whitespace-pre-wrap leading-relaxed text-sm text-foreground">
                      {course.description}
                    </p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">ไม่มีคำอธิบาย</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="content" className="mt-4">
              {Array.isArray(course.modules) && course.modules.length > 0 ? (
                <Accordion type="multiple" className="rounded-lg border border-border/60 bg-card">
                  {course.modules.map((m, mi) => (
                    <AccordionItem
                      key={m.id ?? mi}
                      value={String(m.id ?? mi)}
                      className="px-4"
                    >
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-2 text-left">
                          <Layers className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {mi + 1}. {m.title}
                          </span>
                          <Badge variant="secondary" className="ml-2 font-normal">
                            {m.lessons?.length ?? 0} บทเรียน
                          </Badge>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <ul className="space-y-0.5 pb-2">
                          {(m.lessons ?? []).map((lesson) => (
                            <LessonRow
                              key={lesson.id}
                              lesson={lesson}
                              locked={!enrolled}
                            />
                          ))}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <Card className="border-border/60">
                  <CardContent className="p-5 sm:p-6">
                    <div className="grid grid-cols-2 gap-3 sm:gap-4">
                      <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <div className="text-2xl font-semibold tabular-nums text-foreground">
                          {course.total_modules ?? 0}
                        </div>
                        <div className="text-xs text-muted-foreground">โมดูล</div>
                      </div>
                      <div className="rounded-lg border border-border bg-muted/30 p-4">
                        <div className="text-2xl font-semibold tabular-nums text-foreground">
                          {course.total_lessons ?? 0}
                        </div>
                        <div className="text-xs text-muted-foreground">บทเรียน</div>
                      </div>
                    </div>
                    {(course.total_lessons ?? 0) === 0 && (
                      <p className="mt-4 text-sm text-muted-foreground">
                        ยังไม่มีบทเรียนในหลักสูตรนี้
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Side card */}
        <aside className="md:sticky md:top-20 md:h-fit">
          <Card className="border-border/60">
            <CardContent className="space-y-4 p-5">
              {enrolled && (
                <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  คุณลงทะเบียนแล้ว
                </div>
              )}

              <div className="hidden md:block">{enrollCta}</div>

              {enrolled && (
                <Button
                  variant="outline"
                  className="hidden w-full md:flex"
                  onClick={() => setUnenrollOpen(true)}
                  disabled={enrollLoading}
                >
                  {BUTTONS.UNENROLL}
                </Button>
              )}

              {isAdmin ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => setStatsOpen(true)}
                >
                  <LineChart className="mr-1.5 h-4 w-4" />
                  {BUTTONS.VIEW_STATS}
                </Button>
              ) : enrolled ? (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={openMyScores}
                  disabled={scoresLoading}
                >
                  <LineChart className="mr-1.5 h-4 w-4" />
                  {scoresLoading ? 'กำลังโหลด...' : BUTTONS.VIEW_SCORES}
                </Button>
              ) : null}

              <div className="space-y-2 border-t border-border/60 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Users className="h-3.5 w-3.5" />
                    ผู้ลงทะเบียน
                  </span>
                  <span className="font-medium tabular-nums">{course.enrolled_count ?? 0}</span>
                </div>
                {course.estimated_hours ? (
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      ระยะเวลา
                    </span>
                    <span className="font-medium">{course.estimated_hours} ชั่วโมง</span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">เผยแพร่</span>
                  <span className="font-medium">{formatThaiDate(course.created_at)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      {/* Mobile sticky bottom CTA */}
      <div
        className="fixed inset-x-0 bottom-14 z-20 border-t border-border bg-background/95 p-3 backdrop-blur md:hidden"
        style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-2">
          {enrolled && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => setUnenrollOpen(true)}
              disabled={enrollLoading}
              className="flex-shrink-0"
            >
              {BUTTONS.CANCEL}
            </Button>
          )}
          <div className="flex-1">
            {enrolled ? (
              <Button
                onClick={() => navigate(`/courses/${course.id}/learn`)}
                size="lg"
                className="w-full"
              >
                <PlayCircle className="mr-1.5 h-4 w-4" />
                {BUTTONS.START_LESSON}
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={handleEnroll}
                disabled={enrollLoading}
                size="lg"
                className="w-full"
              >
                {enrollLoading ? BUTTONS.ENROLLING : BUTTONS.ENROLL}
              </Button>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={unenrollOpen} onOpenChange={setUnenrollOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ยกเลิกการลงทะเบียน</AlertDialogTitle>
            <AlertDialogDescription>
              ต้องการยกเลิกการลงทะเบียนหลักสูตรนี้ใช่หรือไม่? ความคืบหน้าจะถูกเก็บไว้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{BUTTONS.CANCEL}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnenroll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {BUTTONS.CONFIRM}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CourseStatsModal
        open={statsOpen}
        courseId={id}
        onClose={() => setStatsOpen(false)}
      />

      <CourseScoresModal
        open={scoresOpen}
        quizzes={myQuizzes}
        courseId={id}
        onClose={() => setScoresOpen(false)}
      />
    </div>
  )
}
