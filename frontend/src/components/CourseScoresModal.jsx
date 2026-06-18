import { useEffect, useState } from 'react'
import {
  Check,
  Download,
  Hourglass,
  StickyNote,
  Trophy,
  X as XIcon,
} from 'lucide-react'
import { certificatesApi } from '@/api/certificates'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { getApiErrorMessage } from '@/utils/apiError'

const placementLabels = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
}

function StatusBadge({ taken, passed, optional }) {
  if (!taken) {
    return (
      <span
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        title="ยังไม่ทำ"
      >
        <Hourglass className="h-4 w-4" />
      </span>
    )
  }
  if (passed) {
    return (
      <span
        className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-success/15 text-success"
        title="ผ่าน"
      >
        <Check className="h-4 w-4" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
        optional
          ? 'bg-muted text-muted-foreground'
          : 'bg-destructive/15 text-destructive'
      )}
      title={optional ? 'ไม่บังคับ' : 'ไม่ผ่าน'}
    >
      {optional ? <StickyNote className="h-4 w-4" /> : <XIcon className="h-4 w-4" />}
    </span>
  )
}

export default function CourseScoresModal({ open, quizzes, courseId, onClose }) {
  const [cert, setCert] = useState(null)
  const [certLoading, setCertLoading] = useState(false)
  const [certError, setCertError] = useState('')
  // Backend-decided eligibility. We need this separate from the front-end's
  // `coursePassed` heuristic because that heuristic only considers final-quiz
  // pass status, which is wrong for courses that don't HAVE a final quiz —
  // those should still get a cert once all lessons are complete.
  const [eligible, setEligible] = useState(false)

  useEffect(() => {
    if (!open || !courseId) return
    setCert(null)
    setCertError('')
    setEligible(false)
    certificatesApi
      .eligibility(courseId)
      .then((data) => {
        setEligible(!!data.eligible)
        if (data.has_certificate) {
          setCert({ id: data.certificate_id, number: data.certificate_number })
        }
      })
      .catch(() => {})
  }, [open, courseId])

  const claim = async () => {
    if (!courseId) return
    setCertLoading(true)
    setCertError('')
    try {
      const data = await certificatesApi.issue(courseId)
      setCert({ id: data.id, number: data.certificate_number })
      window.open(certificatesApi.downloadUrl(data.id), '_blank', 'noopener')
    } catch (err) {
      setCertError(getApiErrorMessage(err, 'ออกใบรับรองไม่สำเร็จ'))
    } finally {
      setCertLoading(false)
    }
  }

  const list = Array.isArray(quizzes) ? quizzes : []
  const finalQuiz = list.find((q) => q.placement === 'final')
  const lessonQuizzes = list
    .filter((q) => q.placement !== 'final')
    .sort((a, b) => {
      if (a.can_skip !== b.can_skip) return a.can_skip ? 1 : -1
      return 0
    })

  const requiredLessonQuizzes = lessonQuizzes.filter((q) => !q.can_skip)
  const passedRequired = requiredLessonQuizzes.filter((q) => q.is_passed).length

  const finalTaken =
    finalQuiz && finalQuiz.best_score !== null && finalQuiz.best_score !== undefined
  const coursePassed =
    !!finalQuiz &&
    finalQuiz.is_passed &&
    requiredLessonQuizzes.every((q) => q.is_passed)

  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>ผลการเรียนของคุณ</DialogTitle>
          <DialogDescription>
            คะแนนหลักสูตรนับจากแบบทดสอบสุดท้าย แบบทดสอบกลางบทเป็นด่านกั้นเท่านั้น
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {finalQuiz ? (
            <div
              className={cn(
                'rounded-xl border-2 p-5',
                finalTaken
                  ? finalQuiz.is_passed
                    ? 'border-success/40 bg-success/5'
                    : 'border-destructive/40 bg-destructive/5'
                  : 'border-border bg-muted/30'
              )}
            >
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                คะแนนหลักสูตร
              </p>
              <div className="mt-1 flex flex-wrap items-baseline gap-3">
                {finalTaken ? (
                  <>
                    <span
                      className={cn(
                        'text-5xl font-semibold tabular-nums',
                        finalQuiz.is_passed ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {finalQuiz.best_score}%
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 text-sm font-medium',
                        finalQuiz.is_passed ? 'text-success' : 'text-destructive'
                      )}
                    >
                      {finalQuiz.is_passed ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <XIcon className="h-4 w-4" />
                      )}
                      {finalQuiz.is_passed ? 'ผ่านเกณฑ์' : 'ยังไม่ผ่านเกณฑ์'}
                    </span>
                  </>
                ) : (
                  <span className="text-xl font-medium text-muted-foreground">
                    ยังไม่ได้ทำแบบทดสอบสุดท้าย
                  </span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {finalQuiz.title} · เกณฑ์ผ่าน {finalQuiz.passing_score}%
              </p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-border bg-muted/30 p-5 text-center">
              <p className="text-sm text-muted-foreground">
                หลักสูตรนี้ยังไม่มีแบบทดสอบสุดท้าย
              </p>
            </div>
          )}

          {finalQuiz && (
            <div
              className={cn(
                'flex items-center gap-2 rounded-md border px-3 py-2 text-sm',
                coursePassed
                  ? 'border-success/30 bg-success/10 text-success'
                  : 'border-primary/20 bg-primary/5 text-foreground'
              )}
            >
              {coursePassed ? (
                <Trophy className="h-5 w-5 flex-shrink-0" />
              ) : (
                <StickyNote className="h-5 w-5 flex-shrink-0 text-primary" />
              )}
              <span>
                {coursePassed
                  ? 'คุณผ่านหลักสูตรนี้แล้ว ผ่านครบทุกด่านและแบบทดสอบสุดท้าย'
                  : `ผ่านด่านบังคับแล้ว ${passedRequired}/${requiredLessonQuizzes.length} ด่าน · ต้องผ่านแบบทดสอบสุดท้ายเพื่อจบหลักสูตร`}
              </span>
            </div>
          )}

          {/* Show the certificate block when the backend says we're eligible
              (covers courses without a final quiz) OR when our local
              "coursePassed" heuristic agrees (covers stale eligibility responses). */}
          {(eligible || coursePassed) && courseId && (
            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <Trophy className="mt-0.5 h-6 w-6 flex-shrink-0 text-warning" />
                <div className="flex-1">
                  <p className="font-medium text-foreground">ใบรับรองการผ่านหลักสูตร</p>
                  {cert ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      เลขที่ {cert.number}
                    </p>
                  ) : (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      ออกใบรับรอง PDF ได้ทันที
                    </p>
                  )}
                  {certError && (
                    <p className="mt-1 text-xs text-destructive">{certError}</p>
                  )}
                </div>
                {cert ? (
                  <Button asChild size="sm">
                    <a
                      href={certificatesApi.downloadUrl(cert.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="mr-1 h-3.5 w-3.5" />
                      ดาวน์โหลด
                    </a>
                  </Button>
                ) : (
                  <Button size="sm" onClick={claim} disabled={certLoading}>
                    {certLoading ? 'กำลังออก...' : 'รับใบรับรอง'}
                  </Button>
                )}
              </div>
            </div>
          )}

          {lessonQuizzes.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-medium text-foreground">
                ด่านบทเรียน
                <Badge variant="secondary" className="ml-2 font-normal">
                  ต้องผ่านเพื่อเรียนต่อ
                </Badge>
              </h4>
              <ul className="space-y-1.5">
                {lessonQuizzes.map((q) => {
                  const taken = q.best_score !== null && q.best_score !== undefined
                  return (
                    <li
                      key={q.id}
                      className="flex items-center gap-3 rounded-md border border-border p-2.5"
                    >
                      <StatusBadge
                        taken={taken}
                        passed={q.is_passed}
                        optional={q.can_skip}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {q.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {placementLabels[q.placement] || q.placement}
                          {q.can_skip && (
                            <span className="ml-1 text-muted-foreground/70">
                              · ไม่บังคับ
                            </span>
                          )}
                        </p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
