import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { quizzesApi } from '@/api/quizzes'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

const typeLabels = {
  single_choice: 'เลือกข้อเดียว',
  multiple_choice: 'เลือกหลายข้อ',
  written: 'เขียนตอบ',
  opinion: 'ความคิดเห็น',
}

function StatCard({ label, value, hint, muted }) {
  return (
    <div
      className={cn(
        'rounded-lg p-3',
        muted ? 'bg-muted/40' : 'bg-primary/5'
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          'text-xl font-semibold tabular-nums',
          muted ? 'text-foreground' : 'text-primary'
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function QuestionStats({ q, index }) {
  const isFreeText = q.question_type === 'written' || q.question_type === 'opinion'
  const isOpinion = q.question_type === 'opinion'
  const rate = q.correct_rate

  const indicatorClass = isOpinion
    ? '[&>div]:bg-primary'
    : rate >= 70
    ? '[&>div]:bg-success'
    : rate >= 40
    ? '[&>div]:bg-warning'
    : '[&>div]:bg-destructive'

  return (
    <Card className="border-border/60">
      <CardContent className="p-3">
        <div className="mb-2 flex items-start gap-2">
          <span className="mt-0.5 flex-shrink-0 font-mono text-xs text-muted-foreground">
            Q{index + 1}
          </span>
          <Badge variant="secondary" className="flex-shrink-0 font-normal">
            {typeLabels[q.question_type] || q.question_type}
          </Badge>
          <p className="flex-1 break-words text-sm text-foreground">{q.question_text}</p>
        </div>

        {!isOpinion && (
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                ตอบถูก {q.correct_count}/{q.answered_count} คน
              </span>
              <span className="font-medium tabular-nums">{q.correct_rate}%</span>
            </div>
            <Progress value={q.correct_rate} className={cn('h-2', indicatorClass)} />
          </div>
        )}

        {q.choice_distribution && q.choices && (
          <div className="mt-2 space-y-1.5">
            {q.choices.map((c, ci) => {
              const count = q.choice_distribution[ci] || 0
              const pct = q.answered_count
                ? Math.round((count / q.answered_count) * 100)
                : 0
              return (
                <div key={ci} className="flex items-center gap-2 text-xs">
                  <div className="flex w-44 flex-shrink-0 items-center gap-1">
                    {c.is_correct && <Check className="h-3.5 w-3.5 text-success" />}
                    <span
                      className={cn(
                        'break-words',
                        c.is_correct
                          ? 'font-medium text-success'
                          : 'text-foreground'
                      )}
                    >
                      {c.text}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2 flex-1 [&>div]:bg-muted-foreground/50" />
                  <span className="w-14 flex-shrink-0 text-right tabular-nums text-muted-foreground">
                    {count} ({pct}%)
                  </span>
                </div>
              )
            })}
          </div>
        )}

        {isFreeText && q.responses && (
          <div className="mt-2">
            {q.question_type === 'written' && q.correct_text && (
              <p className="mb-1 text-xs text-muted-foreground">
                เฉลย: <span className="text-success">{q.correct_text}</span>
              </p>
            )}
            {q.responses.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">ยังไม่มีคำตอบ</p>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {q.responses.map((r, ri) => (
                  <li
                    key={ri}
                    className={cn(
                      'rounded border px-3 py-2 text-sm',
                      q.question_type === 'written'
                        ? r.correct
                          ? 'border-success/30 bg-success/5'
                          : 'border-border bg-muted/30'
                        : 'border-primary/20 bg-primary/5'
                    )}
                  >
                    <p className="mb-0.5 text-xs text-muted-foreground">
                      {r.user_name}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-foreground">
                      {r.text || (
                        <span className="italic text-muted-foreground">(เว้นว่าง)</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function QuizStatsModal({ open, quizId, onClose }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !quizId) return
    setLoading(true)
    setError('')
    quizzesApi
      .getStats(quizId)
      .then(setStats)
      .catch((err) => setError(err.response?.data?.detail || 'โหลดสถิติไม่สำเร็จ'))
      .finally(() => setLoading(false))
  }, [open, quizId])

  return (
    <Dialog open={!!open} onOpenChange={(o) => !o && onClose?.()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            สถิติแบบทดสอบ{stats?.title ? `: ${stats.title}` : ''}
          </DialogTitle>
          <DialogDescription>
            วิเคราะห์ความถูกต้องและคำตอบของผู้เรียน
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full rounded-lg" />
            <Skeleton className="h-32 w-full rounded-lg" />
          </div>
        )}
        {error && (
          <p className="py-6 text-center text-sm text-destructive">{error}</p>
        )}

        {stats && !loading && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="จำนวนการทำ" value={stats.total_attempts} />
              <StatCard label="คะแนนเฉลี่ย" value={`${stats.average_score}%`} />
              <StatCard
                label="ผ่านเกณฑ์"
                value={`${stats.pass_rate}%`}
                hint={`${stats.pass_count}/${stats.total_attempts}`}
              />
              <StatCard
                label="เกณฑ์ผ่าน"
                value={`${stats.passing_score}%`}
                muted
              />
            </div>

            {stats.total_attempts === 0 ? (
              <p className="rounded-lg bg-muted/30 py-6 text-center text-sm text-muted-foreground">
                ยังไม่มีผู้ทำแบบทดสอบนี้
              </p>
            ) : (
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">รายละเอียดรายข้อ</h4>
                {stats.questions.map((q, idx) => (
                  <QuestionStats key={q.id} q={q} index={idx} />
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
