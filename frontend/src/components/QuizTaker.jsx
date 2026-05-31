import { useState } from 'react'
import { AlertCircle, Check, ClipboardList, Info, RotateCcw, Send, X as XIcon } from 'lucide-react'
import { quizzesApi } from '@/api/quizzes'
import { BUTTONS } from '@/constants/labels'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export default function QuizTaker({ quiz, onAttempted, showToast }) {
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  // Freeze the random subset when the learner starts so a parent refetch
  // doesn't swap questions mid-attempt.
  const [lockedQuestions, setLockedQuestions] = useState(null)

  const passedBefore = quiz.is_passed
  const currentlyPassed = result?.is_passed || passedBefore
  const activeQuestions = lockedQuestions || quiz.questions || []
  const hasQuestions = activeQuestions.length > 0

  const setAnswer = (qid, value) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  const start = () => {
    setLockedQuestions(quiz.questions || [])
    setStarted(true)
  }

  const reset = () => {
    setAnswers({})
    setResult(null)
    setLockedQuestions(quiz.questions || [])
    setStarted(true)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const data = await quizzesApi.submit(
        quiz.id,
        answers,
        activeQuestions.map((q) => q.id),
      )
      setResult(data)
      if (data.is_passed) {
        showToast?.(`ผ่านแบบทดสอบ! คะแนน ${data.score}%`, 'success')
      } else {
        showToast?.(
          `ยังไม่ผ่าน คะแนน ${data.score}% (ต้องการ ${quiz.passing_score}%)`,
          'error'
        )
      }
      onAttempted?.(quiz.id, data)
    } catch (err) {
      showToast?.(err.response?.data?.detail || 'ส่งคำตอบไม่สำเร็จ', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-base font-semibold text-foreground sm:text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            {quiz.title}
          </span>
          {currentlyPassed ? (
            <Badge className="bg-success text-success-foreground hover:bg-success">
              <Check className="mr-0.5 h-3 w-3" />
              ผ่านแล้ว
            </Badge>
          ) : quiz.can_skip ? (
            <Badge variant="secondary" className="font-normal">
              ไม่บังคับ
            </Badge>
          ) : (
            <Badge className="bg-warning text-warning-foreground hover:bg-warning">
              ต้องผ่านเพื่อไปต่อ
            </Badge>
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          คำถาม {activeQuestions.length} ข้อ
          {quiz.randomize_questions && (
            <span className="ml-1 text-primary">(สุ่มคำถาม)</span>
          )}
          {' · '}เกณฑ์ผ่าน {quiz.passing_score}%
          {quiz.best_score !== null && quiz.best_score !== undefined && (
            <span className="ml-2">· คะแนนสูงสุดของคุณ: {quiz.best_score}%</span>
          )}
        </p>

        {!hasQuestions && (
          <p className="text-sm italic text-muted-foreground">
            ยังไม่มีคำถามในแบบทดสอบนี้
          </p>
        )}

        {hasQuestions && !started && !result && (
          <Button onClick={start}>
            {currentlyPassed ? (
              <>
                <RotateCcw className="mr-1.5 h-4 w-4" />
                {BUTTONS.RETRY_QUIZ}
              </>
            ) : (
              BUTTONS.START_QUIZ
            )}
          </Button>
        )}

        {/* Wrong-answer review banner — only after submission, only when there
            are actual wrong answers (opinions don't count). Links scroll the
            learner to each missed question so a long quiz stays navigable. */}
        {result && (() => {
          const wrong = activeQuestions
            .map((q, idx) => ({ q, idx }))
            .filter(({ q }) => {
              if (q.question_type === 'opinion') return false
              return result.results?.[q.id]?.correct === false
            })
          if (wrong.length === 0) return null
          const scrollTo = (qid) => {
            const el = document.getElementById(`q-result-${quiz.id}-${qid}`)
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              el.classList.add('ring-2', 'ring-destructive', 'ring-offset-2')
              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-destructive', 'ring-offset-2')
              }, 1500)
            }
          }
          return (
            <div
              role="status"
              className="flex flex-wrap items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-destructive" />
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">
                  ตอบผิด {wrong.length} ข้อ — ดูคำอธิบายด้านล่าง
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {wrong.map(({ q, idx }) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => scrollTo(q.id)}
                      className="rounded border border-destructive/30 bg-background px-2 py-0.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      ข้อ {idx + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {hasQuestions && (started || result) && (
          <div className="space-y-3 pt-1">
            {activeQuestions.map((q, idx) => {
              const qResult = result?.results?.[q.id]
              const isOpinion = q.question_type === 'opinion'
              const stateClass =
                qResult && !isOpinion
                  ? qResult.correct
                    ? 'border-success/40 bg-success/5'
                    : 'border-destructive/40 bg-destructive/5'
                  : 'border-border bg-card'

              return (
                <div
                  key={q.id}
                  id={`q-result-${quiz.id}-${q.id}`}
                  className={cn(
                    'space-y-2 rounded-lg border p-3 transition-shadow',
                    stateClass,
                  )}
                >
                  <p className="break-words text-sm font-medium text-foreground">
                    {idx + 1}. {q.question_text}
                    {isOpinion && (
                      <Badge variant="secondary" className="ml-2 font-normal">
                        ไม่บังคับ
                      </Badge>
                    )}
                    {qResult && !isOpinion && (
                      <span
                        className={cn(
                          'ml-2 inline-flex items-center gap-0.5 text-xs',
                          qResult.correct ? 'text-success' : 'text-destructive'
                        )}
                      >
                        {qResult.correct ? (
                          <Check className="h-3.5 w-3.5" />
                        ) : (
                          <XIcon className="h-3.5 w-3.5" />
                        )}
                        {qResult.correct ? 'ถูกต้อง' : 'ผิด'}
                      </span>
                    )}
                  </p>

                  {q.question_type === 'single_choice' && (
                    <div className="space-y-1.5">
                      {q.choices?.map((c, ci) => {
                        const isCorrectChoice = qResult?.correct_answer === ci
                        return (
                          <label
                            key={ci}
                            className="flex cursor-pointer items-start gap-2"
                          >
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={answers[q.id] === ci}
                              onChange={() => setAnswer(q.id, ci)}
                              disabled={!!result}
                              className="mt-1 h-4 w-4 accent-primary"
                            />
                            <span
                              className={cn(
                                'break-words text-sm',
                                isCorrectChoice
                                  ? 'font-semibold text-success'
                                  : 'text-foreground'
                              )}
                            >
                              {c.text}
                              {isCorrectChoice && (
                                <Check className="ml-1 inline h-3.5 w-3.5 text-success" />
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {q.question_type === 'multiple_choice' && (
                    <div className="space-y-1.5">
                      {q.choices?.map((c, ci) => {
                        const selected = (answers[q.id] || []).includes(ci)
                        const isCorrectChoice = qResult?.correct_answer?.includes?.(ci)
                        return (
                          <label
                            key={ci}
                            className="flex cursor-pointer items-start gap-2"
                          >
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => {
                                const current = answers[q.id] || []
                                const next = selected
                                  ? current.filter((x) => x !== ci)
                                  : [...current, ci]
                                setAnswer(q.id, next)
                              }}
                              disabled={!!result}
                              className="mt-1 h-4 w-4 accent-primary"
                            />
                            <span
                              className={cn(
                                'break-words text-sm',
                                isCorrectChoice
                                  ? 'font-semibold text-success'
                                  : 'text-foreground'
                              )}
                            >
                              {c.text}
                              {isCorrectChoice && (
                                <Check className="ml-1 inline h-3.5 w-3.5 text-success" />
                              )}
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}

                  {q.question_type === 'written' && (
                    <div className="space-y-1">
                      <Input
                        type="text"
                        value={answers[q.id] || ''}
                        onChange={(e) => setAnswer(q.id, e.target.value)}
                        disabled={!!result}
                        placeholder="พิมพ์คำตอบ..."
                      />
                      {qResult && qResult.correct_answer && (
                        <p className="text-xs text-success">
                          เฉลย: {qResult.correct_answer}
                        </p>
                      )}
                    </div>
                  )}

                  {q.question_type === 'opinion' && (
                    <Textarea
                      value={answers[q.id] || ''}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      disabled={!!result}
                      placeholder="พิมพ์ความคิดเห็น... (จะเว้นว่างก็ได้)"
                      rows={3}
                    />
                  )}

                  {/* Per-question explanation — shown only after submit, only
                      when the backend included one (depends on quiz settings
                      and whether the learner got it wrong). */}
                  {qResult?.explanation && !isOpinion && (
                    <div
                      className={cn(
                        'mt-1 flex items-start gap-2 rounded-md border p-2.5 text-sm',
                        qResult.correct
                          ? 'border-success/30 bg-success/5'
                          : 'border-warning/40 bg-warning/10',
                      )}
                    >
                      <Info
                        className={cn(
                          'mt-0.5 h-4 w-4 flex-shrink-0',
                          qResult.correct ? 'text-success' : 'text-warning',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                          คำอธิบาย
                        </p>
                        <p className="whitespace-pre-wrap break-words text-foreground">
                          {qResult.explanation}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}

            <div className="flex flex-wrap gap-2 pt-1">
              {!result ? (
                <>
                  <Button onClick={handleSubmit} disabled={submitting}>
                    <Send className="mr-1.5 h-4 w-4" />
                    {submitting ? BUTTONS.SUBMITTING_ANSWERS : BUTTONS.SUBMIT_ANSWERS}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setStarted(false)
                      setAnswers({})
                    }}
                  >
                    {BUTTONS.CANCEL}
                  </Button>
                </>
              ) : (
                <>
                  <Badge
                    className={cn(
                      'px-4 py-2 text-sm',
                      result.is_passed
                        ? 'bg-success text-success-foreground hover:bg-success'
                        : 'bg-destructive text-destructive-foreground hover:bg-destructive'
                    )}
                  >
                    คะแนน: {result.score}%{' '}
                    {result.is_passed ? '· ผ่านเกณฑ์' : '· ไม่ผ่านเกณฑ์'}
                  </Badge>
                  <Button onClick={reset}>
                    <RotateCcw className="mr-1.5 h-4 w-4" />
                    {BUTTONS.RETRY_QUIZ}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
