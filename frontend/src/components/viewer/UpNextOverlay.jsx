import { useEffect, useState } from 'react'
import { Lock, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fmtTime } from '@/utils/formatting'

const COUNTDOWN_FROM = 5

/**
 * "Up next" card overlaid on the player when a video ends. Two modes:
 *  - ready (time gate met + no blocking quiz): a 5-second countdown ring that
 *    auto-advances via onPlay() at zero; "เล่นเลย" advances now, "ยกเลิก" dismisses.
 *  - gated: no countdown — prompts the learner to take the blocking quiz or to
 *    wait out the remaining min-view time. "ไปทำแบบทดสอบ" routes via onGoToQuiz.
 *
 * Pure JSX/CSS, no player library. Advancing always goes through the page's
 * goNext (onPlay/onGoToQuiz) so the gate + blocking-quiz checks still run.
 */
export default function UpNextOverlay({
  title,
  ready,
  blockingQuiz,
  remainingSeconds,
  onPlay,
  onCancel,
  onGoToQuiz,
}) {
  const [count, setCount] = useState(COUNTDOWN_FROM)

  useEffect(() => {
    if (!ready) return
    if (count <= 0) {
      onPlay()
      return
    }
    const t = setTimeout(() => setCount((c) => c - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, count])

  // Depleting SVG ring geometry.
  const r = 26
  const circumference = 2 * Math.PI * r
  const offset = circumference * (1 - count / COUNTDOWN_FROM)

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-4 text-center">
      <div className="w-full max-w-xs rounded-xl border border-border/60 bg-background p-5 shadow-xl">
        {ready ? (
          <>
            <div className="relative mx-auto mb-3 h-16 w-16">
              <svg className="h-16 w-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                <circle
                  cx="32"
                  cy="32"
                  r={r}
                  fill="none"
                  strokeWidth="4"
                  className="stroke-muted-foreground/20"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={r}
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-1000 motion-safe:ease-linear"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tabular-nums text-foreground">
                {count}
              </span>
            </div>
            <div className="text-xs text-muted-foreground">ตอนถัดไป</div>
            <div className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">{title}</div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancel}>
                ยกเลิก
              </Button>
              <Button className="flex-1" onClick={onPlay}>
                <Play className="mr-1.5 h-4 w-4" />
                เล่นเลย
              </Button>
            </div>
          </>
        ) : (
          <>
            <Lock className="mx-auto mb-2 h-7 w-7 text-warning" />
            <div className="text-xs text-muted-foreground">ตอนถัดไป</div>
            <div className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">{title}</div>
            {blockingQuiz ? (
              <p className="mt-2 text-sm font-medium text-warning">ทำแบบทดสอบก่อนไปต่อ</p>
            ) : (
              <p className="mt-2 text-sm text-warning">
                ต้องอยู่บนหน้านี้อีก {fmtTime(remainingSeconds)}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onCancel}>
                ปิด
              </Button>
              {blockingQuiz && (
                <Button
                  className="flex-1 bg-warning text-warning-foreground hover:bg-warning/90"
                  onClick={onGoToQuiz}
                >
                  ไปทำแบบทดสอบ
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
