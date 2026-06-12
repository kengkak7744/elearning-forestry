import { ChevronLeft, ChevronRight, CheckCircle2, Hourglass, Lock, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { BUTTONS } from '@/constants/labels'
import { cn } from '@/lib/utils'
import { fmtTime } from '@/utils/formatting'

export default function LessonFooter({
  currentLesson,
  viewingFinal,
  finalQuiz,
  prevDest,
  nextDest,
  timeGateMet,
  minSeconds,
  elapsedSeconds,
  remainingSeconds,
  currentLessonGated,
  onPrev,
  onNext,
  onFinish,
}) {
  if (!currentLesson && !viewingFinal) return null

  const blocked = !viewingFinal && !currentLessonGated

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-background/95 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto max-w-6xl px-4 py-2.5 sm:px-6 sm:py-3">
        {!viewingFinal && minSeconds > 0 && !timeGateMet && (
          <div className="mb-2 space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 font-medium text-warning">
                <Hourglass className="h-3.5 w-3.5" />
                ต้องอยู่บนหน้านี้อีก {fmtTime(remainingSeconds)}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {fmtTime(elapsedSeconds)} / {fmtTime(minSeconds)}
              </span>
            </div>
            <Progress
              value={Math.min(100, (elapsedSeconds / minSeconds) * 100)}
              className="h-1.5"
            />
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <Button
            variant="outline"
            onClick={onPrev}
            disabled={!prevDest}
            className="flex-1 sm:flex-none"
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            {BUTTONS.PREVIOUS}
          </Button>

          {!viewingFinal && currentLesson && (
            <span className="hidden max-w-md truncate px-2 text-center text-xs text-muted-foreground md:block">
              {currentLesson.title}
            </span>
          )}
          {viewingFinal && (
            <span className="hidden items-center gap-1 px-2 text-center text-xs font-medium text-warning md:inline-flex">
              <Trophy className="h-4 w-4" /> แบบทดสอบสุดท้าย
            </span>
          )}

          {viewingFinal ? (
            finalQuiz?.is_passed ? (
              <Button
                onClick={onFinish}
                className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90 sm:flex-none"
              >
                <Trophy className="mr-1.5 h-4 w-4" />
                จบหลักสูตร
              </Button>
            ) : (
              <Button variant="secondary" onClick={onPrev} className="flex-1 sm:flex-none">
                {BUTTONS.BACK}
              </Button>
            )
          ) : (
            <Button
              onClick={onNext}
              disabled={!timeGateMet}
              title={blocked ? 'คลิกเพื่อไปทำแบบทดสอบที่ต้องผ่าน' : undefined}
              className={cn(
                'h-auto min-h-9 flex-1 py-1 sm:flex-none',
                blocked && 'bg-warning text-warning-foreground hover:bg-warning/90',
                !blocked && !nextDest && 'bg-success text-success-foreground hover:bg-success/90'
              )}
            >
              {blocked ? (
                <>
                  <Lock className="mr-1.5 h-4 w-4" />
                  {BUTTONS.GO_TO_REQUIRED_QUIZ}
                </>
              ) : !nextDest ? (
                <>
                  {BUTTONS.COMPLETED_COURSE}
                  <CheckCircle2 className="ml-1.5 h-4 w-4" />
                </>
              ) : nextDest.type === 'final' ? (
                <>
                  <Trophy className="mr-1.5 h-4 w-4" />
                  {BUTTONS.GO_TO_FINAL_EXAM}
                </>
              ) : (
                // The destination lesson title sits under the label on sm+ so
                // learners know what's coming — "ถัดไป — {title}".
                <span className="flex flex-col items-center leading-tight">
                  <span className="inline-flex items-center">
                    {BUTTONS.NEXT}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </span>
                  {nextDest.lesson?.title && (
                    <span className="hidden max-w-[14rem] truncate text-[10px] font-normal opacity-80 sm:block">
                      {nextDest.lesson.title}
                    </span>
                  )}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
