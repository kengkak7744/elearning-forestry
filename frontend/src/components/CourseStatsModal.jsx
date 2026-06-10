import { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { quizzesApi } from '@/api/quizzes'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import QuizStatsModal from './QuizStatsModal'
import { getApiErrorMessage } from '@/utils/apiError'

const placementLabels = {
  mid_video: 'กลางวิดีโอ',
  end_of_lesson: 'ท้ายบทเรียน',
  final: 'แบบทดสอบสุดท้าย',
}

function Stat({ label, value, tone }) {
  const bg =
    tone === 'primary' ? 'bg-primary/5' : tone === 'success' ? 'bg-success/5' : 'bg-muted/40'
  const color =
    tone === 'primary'
      ? 'text-primary'
      : tone === 'success'
      ? 'text-success'
      : 'text-foreground'
  return (
    <div className={cn('rounded-lg p-3', bg)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-xl font-semibold tabular-nums', color)}>{value}</p>
    </div>
  )
}

function rateColor(rate) {
  if (rate >= 70) return 'text-success'
  if (rate >= 40) return 'text-warning'
  return 'text-destructive'
}

export default function CourseStatsModal({ open, courseId, onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [drillQuizId, setDrillQuizId] = useState(null)

  useEffect(() => {
    if (!open || !courseId) return
    setLoading(true)
    setError('')
    quizzesApi
      .getCourseStats(courseId)
      .then(setStats)
      .catch((err) => setError(getApiErrorMessage(err, 'โหลดสถิติไม่สำเร็จ')))
      .finally(() => setLoading(false))
  }, [open, courseId])

  return (
    <>
      <Dialog open={!!open} onOpenChange={(o) => !o && onClose?.()}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>สถิติหลักสูตร</DialogTitle>
            <DialogDescription>
              สรุปคะแนนและผลการทำแบบทดสอบทุกชุดในหลักสูตร
            </DialogDescription>
          </DialogHeader>

          {loading && (
            <div className="space-y-2">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          )}
          {error && (
            <p className="py-6 text-center text-sm text-destructive">{error}</p>
          )}

          {stats && !loading && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="แบบทดสอบ" value={stats.total_quizzes} />
                <Stat label="ผู้เรียน" value={stats.unique_learners} tone="primary" />
                <Stat label="จำนวนการทำ" value={stats.total_attempts} tone="primary" />
                <Stat
                  label="คะแนนเฉลี่ย"
                  value={`${stats.overall_average}%`}
                  tone="primary"
                />
                <Stat
                  label="ผ่านเกณฑ์"
                  value={`${stats.overall_pass_rate}%`}
                  tone="success"
                />
              </div>

              {stats.total_quizzes === 0 ? (
                <p className="rounded-lg bg-muted/30 py-6 text-center text-sm text-muted-foreground">
                  หลักสูตรนี้ยังไม่มีแบบทดสอบ
                </p>
              ) : (
                <>
                  <div>
                    <h4 className="mb-2 text-sm font-medium text-foreground">
                      แบบทดสอบในหลักสูตร
                    </h4>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ชื่อ</TableHead>
                            <TableHead className="hidden sm:table-cell">ตำแหน่ง</TableHead>
                            <TableHead className="text-right">ผู้ทำ</TableHead>
                            <TableHead className="text-right">เฉลี่ย</TableHead>
                            <TableHead className="text-right">ผ่าน</TableHead>
                            <TableHead className="text-right"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stats.quizzes.map((q) => (
                            <TableRow key={q.id}>
                              <TableCell className="max-w-xs break-words text-foreground">
                                {q.title}
                              </TableCell>
                              <TableCell className="hidden text-muted-foreground sm:table-cell">
                                {placementLabels[q.placement] || q.placement}
                              </TableCell>
                              <TableCell className="text-right tabular-nums text-foreground">
                                {q.unique_learners}
                                <span className="ml-1 text-xs text-muted-foreground">
                                  ({q.total_attempts})
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {q.total_attempts ? `${q.average_score}%` : '—'}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {q.total_attempts ? (
                                  <span className={rateColor(q.pass_rate)}>
                                    {q.pass_rate}%
                                  </span>
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDrillQuizId(q.id)}
                                  className="text-primary hover:text-primary"
                                >
                                  รายละเอียด
                                  <ChevronRight className="ml-0.5 h-3 w-3" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-2 text-sm font-medium text-foreground">
                      ผลการเรียนรายผู้เรียน
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (คะแนนสูงสุดต่อแบบทดสอบ)
                      </span>
                    </h4>
                    {stats.learners.length === 0 ? (
                      <p className="rounded-lg bg-muted/30 py-6 text-center text-sm text-muted-foreground">
                        ยังไม่มีผู้เรียนทำแบบทดสอบ
                      </p>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>ผู้เรียน</TableHead>
                              <TableHead className="hidden sm:table-cell">หน่วยงาน</TableHead>
                              <TableHead className="text-right">ทำ</TableHead>
                              <TableHead className="text-right">ผ่าน</TableHead>
                              <TableHead className="text-right">คะแนนเฉลี่ย</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {stats.learners.map((u) => (
                              <TableRow key={u.user_id}>
                                <TableCell className="break-words text-foreground">
                                  {u.user_name}
                                </TableCell>
                                <TableCell className="hidden text-muted-foreground sm:table-cell">
                                  {u.user_department || '—'}
                                </TableCell>
                                <TableCell className="text-right tabular-nums text-foreground">
                                  {u.quizzes_taken}/{stats.total_quizzes}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  <span
                                    className={
                                      u.quizzes_passed === stats.total_quizzes
                                        ? 'font-medium text-success'
                                        : 'text-foreground'
                                    }
                                  >
                                    {u.quizzes_passed}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-semibold tabular-nums">
                                  <span className={rateColor(u.average_score)}>
                                    {u.average_score}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      <QuizStatsModal
        open={!!drillQuizId}
        quizId={drillQuizId}
        onClose={() => setDrillQuizId(null)}
      />
    </>
  )
}
