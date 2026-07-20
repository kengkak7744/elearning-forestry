import { useEffect, useState } from 'react'
import { CheckCircle2, ClipboardList, Hourglass, XCircle } from 'lucide-react'
import { usersApi } from '@/api/users'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/utils/apiError'

const PLACEMENT_LABELS = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
  final: 'แบบทดสอบสุดท้าย',
}

function formatDateTime(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatTile({ label, value, accent = false }) {
  return (
    <div className={accent ? 'rounded-lg bg-primary/5 p-3' : 'rounded-lg bg-muted/40 p-3'}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={accent ? 'text-xl font-semibold tabular-nums text-primary' : 'text-xl font-semibold tabular-nums text-foreground'}>
        {value}
      </p>
    </div>
  )
}

function QuizStatus({ quiz }) {
  if (!quiz.total_attempts) {
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Hourglass className="h-4 w-4" aria-hidden="true" />
      </span>
    )
  }
  if (quiz.is_passed) {
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      </span>
    )
  }
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
      <XCircle className="h-4 w-4" aria-hidden="true" />
    </span>
  )
}

export default function UserCourseStatsDialog({ open, userId, userName, course, onClose }) {
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const courseId = course?.course_id

  useEffect(() => {
    if (!open || !userId || !courseId) return undefined

    let active = true
    setDetail(null)
    setError('')
    setLoading(true)
    usersApi
      .getCourseLearningDetail(userId, courseId)
      .then((data) => {
        if (active) setDetail(data)
      })
      .catch((err) => {
        if (active) {
          setError(getApiErrorMessage(err, 'โหลดสถิติการเรียนไม่สำเร็จ'))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [open, userId, courseId])

  const enrollment = detail?.enrollment
  const quizStats = detail?.quiz_stats

  return (
    <Dialog open={!!open} onOpenChange={(nextOpen) => !nextOpen && onClose?.()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>สถิติการเรียนรายหลักสูตร</DialogTitle>
          <DialogDescription>
            {userName || 'ผู้เรียน'} · {course?.title || detail?.course?.title || 'หลักสูตร'}
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-lg" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-36 w-full rounded-lg" />
          </div>
        )}

        {error && !loading && (
          <p className="rounded-lg bg-destructive/10 px-4 py-6 text-center text-sm text-destructive">
            {error}
          </p>
        )}

        {detail && !loading && (
          <div className="space-y-5">
            <div className="rounded-lg border border-border/60 p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">ความคืบหน้าหลักสูตร</span>
                <span className="text-2xl font-semibold tabular-nums text-primary">
                  {enrollment.progress_percent}%
                </span>
              </div>
              <Progress value={enrollment.progress_percent} className="h-2" />
              <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  เรียนจบ {enrollment.completed_lessons}/{enrollment.total_lessons} บท
                </span>
                <span>เข้าเรียนล่าสุด {formatDateTime(enrollment.last_accessed_at)}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="แบบทดสอบที่ทำ"
                value={`${quizStats.quizzes_taken}/${quizStats.total_quizzes}`}
              />
              <StatTile label="จำนวนการทำ" value={quizStats.total_attempts} />
              <StatTile label="ผ่านแล้ว" value={quizStats.quizzes_passed} />
              <StatTile label="คะแนนเฉลี่ย" value={`${quizStats.average_score}%`} accent />
            </div>

            <div>
              <h4 className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <ClipboardList className="h-4 w-4 text-primary" aria-hidden="true" />
                ผลแบบทดสอบ
              </h4>
              {detail.quizzes.length === 0 ? (
                <p className="rounded-lg bg-muted/30 py-6 text-center text-sm text-muted-foreground">
                  หลักสูตรนี้ยังไม่มีแบบทดสอบ
                </p>
              ) : (
                <ul className="space-y-2">
                  {detail.quizzes.map((quiz) => {
                    const taken = quiz.total_attempts > 0
                    return (
                      <li
                        key={quiz.id}
                        className="flex items-start gap-3 rounded-lg border border-border/60 p-3"
                      >
                        <QuizStatus quiz={quiz} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-words text-sm font-medium text-foreground">
                                {quiz.title}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {PLACEMENT_LABELS[quiz.placement] || quiz.placement}
                                {quiz.can_skip && ' · ไม่บังคับ'}
                              </p>
                            </div>
                            <div className="flex flex-shrink-0 items-center gap-2">
                              <Badge
                                variant={taken && !quiz.is_passed ? 'destructive' : 'secondary'}
                                className={quiz.is_passed ? 'bg-success text-success-foreground' : ''}
                              >
                                {!taken ? 'ยังไม่ได้ทำ' : quiz.is_passed ? 'ผ่าน' : 'ไม่ผ่าน'}
                              </Badge>
                              <span className="min-w-12 text-right text-lg font-semibold tabular-nums text-foreground">
                                {taken ? `${quiz.best_score}%` : '-'}
                              </span>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-muted-foreground">
                            <span>
                              ทำ {quiz.total_attempts} ครั้ง · เกณฑ์ผ่าน {quiz.passing_score}%
                            </span>
                            {taken && (
                              <span>ล่าสุด {formatDateTime(quiz.last_attempted_at)}</span>
                            )}
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
