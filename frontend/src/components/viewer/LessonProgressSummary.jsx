import { Progress } from '@/components/ui/progress'

/**
 * Compact "ความคืบหน้า x/y บทเรียน" summary with a progress bar. Rendered at the
 * top of both the desktop lesson tree (ViewerSidebar) and the mobile tree Sheet
 * (ViewerHeader) so learners always see how far they've got.
 */
export default function LessonProgressSummary({ completed, total }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <div className="mb-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="font-medium text-foreground">
          ความคืบหน้า {completed}/{total} บทเรียน
        </span>
        <span className="tabular-nums text-muted-foreground">{pct}%</span>
      </div>
      <Progress value={pct} className="h-1.5" />
    </div>
  )
}
