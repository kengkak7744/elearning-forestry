import { useEffect, useMemo, useRef, useState } from 'react'
import { MessageSquare, Star } from 'lucide-react'
import { feedbackApi } from '@/api/feedback'
import { showToast } from '@/lib/toast'
import { BUTTONS } from '@/constants/labels'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const MAX_COMMENT = 2000

/**
 * Interactive 5-star input. Hovering previews the rating (mouseenter), the
 * committed value sticks on click. Keyboard: arrow keys + Enter via radio
 * group semantics (each button is role=radio so screen readers announce it).
 */
/**
 * Star rating with WAI-ARIA APG-compliant radiogroup behaviour:
 *   - Tab moves focus INTO the group (lands on the selected star, or the
 *     first one if nothing selected yet) and back OUT — single tab stop.
 *   - Arrow Left/Right (and Up/Down) move focus between stars and
 *     immediately update the value. This matches how every native radio
 *     group behaves and is what a screen-reader user expects.
 *   - Home/End jump to 1 and 5.
 *
 * Implementation uses the roving-tabindex pattern: exactly one button has
 * tabIndex=0, the rest have tabIndex=-1.
 */
function StarRating({ value, onChange, readonly = false, size = 'md' }) {
  const [hover, setHover] = useState(0)
  const buttonsRef = useRef([])
  const shown = hover || value
  const sizeCls = size === 'lg' ? 'h-7 w-7' : size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'
  // Active = the star whose tabIndex is 0. When nothing's selected yet,
  // default to star 1 so Tab still lands somewhere meaningful.
  const activeIndex = value ? value - 1 : 0

  const focusStar = (n) => {
    const el = buttonsRef.current[n - 1]
    el?.focus()
    onChange?.(n)
  }

  const handleKeyDown = (e, n) => {
    if (readonly) return
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault()
        focusStar(n === 5 ? 1 : n + 1)
        break
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault()
        focusStar(n === 1 ? 5 : n - 1)
        break
      case 'Home':
        e.preventDefault()
        focusStar(1)
        break
      case 'End':
        e.preventDefault()
        focusStar(5)
        break
      default:
        break
    }
  }

  return (
    <div
      role={readonly ? 'img' : 'radiogroup'}
      aria-label={readonly ? `คะแนน ${value} จาก 5` : 'ให้คะแนน 1 ถึง 5 ดาว'}
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= shown
        const isActive = n - 1 === activeIndex
        return (
          <button
            key={n}
            ref={(el) => (buttonsRef.current[n - 1] = el)}
            type="button"
            role={readonly ? undefined : 'radio'}
            aria-checked={readonly ? undefined : value === n}
            aria-label={`${n} ดาว`}
            tabIndex={readonly ? -1 : isActive ? 0 : -1}
            disabled={readonly}
            onMouseEnter={() => !readonly && setHover(n)}
            onClick={() => !readonly && onChange?.(n)}
            onKeyDown={(e) => handleKeyDown(e, n)}
            className={cn(
              'rounded p-0.5 transition-colors',
              !readonly && 'hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              readonly && 'cursor-default'
            )}
          >
            <Star
              className={cn(
                sizeCls,
                filled ? 'fill-warning text-warning' : 'fill-transparent text-muted-foreground/40'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}

function DistributionBars({ distribution, total }) {
  // distribution = [count_1star, count_2star, ..., count_5star]
  // Render 5★ on top down to 1★ at bottom — matches how every other rating
  // UI on the planet does it (Amazon, Google, etc.).
  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((stars) => {
        const count = distribution[stars - 1] || 0
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={stars} className="flex items-center gap-2 text-xs">
            <span className="w-4 tabular-nums text-muted-foreground">{stars}</span>
            <Star className="h-3 w-3 fill-warning text-warning" />
            <Progress
              value={pct}
              className="h-1.5 flex-1 [&>div]:bg-warning"
            />
            <span className="w-8 text-right tabular-nums text-muted-foreground">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function CourseFeedbackCard({ courseId, isEnrolled }) {
  const [summary, setSummary] = useState(null)
  const [mine, setMine] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadAll = async () => {
    setLoading(true)
    try {
      // Always pull the summary (public). Pull "mine" only when enrolled —
      // anonymous browsers don't need to know their own (non-existent) status.
      const [s, m] = await Promise.all([
        feedbackApi.summary(courseId),
        isEnrolled ? feedbackApi.mine(courseId) : Promise.resolve(null),
      ])
      setSummary(s)
      setMine(m)
      if (m?.has_feedback) {
        setRating(m.rating)
        setComment(m.comment || '')
      }
    } catch (err) {
      // Don't crash the page over a feedback block. In dev surface the error
      // so we notice; in prod stay silent so Lighthouse's "no console errors"
      // check stays clean and we don't leak request internals.
      if (import.meta.env.DEV) {
        console.error('feedback load failed', err)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (courseId) loadAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId, isEnrolled])

  const handleSubmit = async () => {
    if (!rating) {
      showToast('กรุณาเลือกจำนวนดาว', 'warning')
      return
    }
    setSubmitting(true)
    try {
      await feedbackApi.submit(courseId, { rating, comment: comment.trim() })
      showToast(mine?.has_feedback ? 'อัปเดตความคิดเห็นเรียบร้อย' : 'ขอบคุณสำหรับความคิดเห็น', 'success')
      await loadAll()
    } catch (err) {
      showToast(err.response?.data?.detail || 'ส่งความคิดเห็นไม่สำเร็จ', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const avgDisplay = useMemo(() => {
    if (!summary || summary.count === 0) return null
    return summary.average?.toFixed(1) ?? '-'
  }, [summary])

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-4 h-24 w-full" />
        </CardContent>
      </Card>
    )
  }

  const canSubmit = mine?.can_submit
  const hasFeedback = mine?.has_feedback
  // Show submit form ONLY to enrolled learners who have completed the course.
  // Everyone else just sees the aggregate (or nothing if no ratings yet).
  const showSubmissionForm = isEnrolled && canSubmit
  const showBlockedHint = isEnrolled && !canSubmit && !hasFeedback

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          ความคิดเห็นต่อหลักสูตร
        </h2>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Aggregate */}
        {summary && summary.count > 0 ? (
          <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:gap-6">
            <div className="text-center sm:text-left">
              <div className="text-4xl font-semibold tabular-nums text-foreground">
                {avgDisplay}
              </div>
              <div className="mt-1 flex justify-center sm:justify-start">
                <StarRating value={Math.round(summary.average)} readonly size="sm" />
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                จาก {summary.count} ความคิดเห็น
              </div>
            </div>
            <DistributionBars distribution={summary.distribution} total={summary.count} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            ยังไม่มีผู้ให้คะแนนหลักสูตรนี้
          </p>
        )}

        {/* Submission form (or blocked hint) */}
        {showSubmissionForm && (
          <div className="space-y-3 border-t border-border/60 pt-4">
            <div className="text-sm font-medium text-foreground">
              {hasFeedback ? 'แก้ไขความคิดเห็นของคุณ' : 'ให้คะแนนหลักสูตรนี้'}
            </div>
            <div className="flex items-center gap-2">
              <StarRating value={rating} onChange={setRating} size="lg" />
              {rating > 0 && (
                <span className="text-sm text-muted-foreground">{rating}/5</span>
              )}
            </div>
            <div>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT))}
                placeholder="เขียนความคิดเห็นเพิ่มเติม (ไม่บังคับ) — สิ่งที่ชอบ จุดที่ควรปรับปรุง ฯลฯ"
                rows={3}
                className="resize-y"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
                {comment.length}/{MAX_COMMENT}
              </div>
            </div>
            <Button onClick={handleSubmit} disabled={submitting || !rating} size="sm">
              {submitting
                ? 'กำลังบันทึก...'
                : hasFeedback
                ? BUTTONS.SAVE
                : 'ส่งความคิดเห็น'}
            </Button>
          </div>
        )}

        {showBlockedHint && (
          <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {mine?.blocked_reason
              ? `จะสามารถให้คะแนนได้เมื่อ: ${mine.blocked_reason}`
              : 'จะสามารถให้คะแนนได้หลังจากเรียนจบหลักสูตรนี้'}
          </div>
        )}

        {/* If they already submitted but the form is hidden (shouldn't happen since
            can_submit is sticky once they complete, but guard anyway) — show their
            previous rating in read-only form. */}
        {!showSubmissionForm && hasFeedback && (
          <div className="space-y-2 border-t border-border/60 pt-4">
            <div className="text-sm font-medium text-foreground">ความคิดเห็นของคุณ</div>
            <StarRating value={mine.rating} readonly size="sm" />
            {mine.comment && (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">{mine.comment}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
