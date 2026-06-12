import { ListChecks } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import LessonTree from '@/components/learner/LessonTree'
import LessonProgressSummary from './LessonProgressSummary'

/**
 * Desktop-only right column: a sticky card with the progress summary and the
 * lesson tree. (The mobile equivalent lives in ViewerHeader's Sheet.)
 */
export default function ViewerSidebar({ treeProps, completedLessons, totalLessons }) {
  return (
    <aside className="hidden lg:block">
      <div className="sticky top-16">
        <Card className="border-border/60">
          <CardContent className="p-3">
            <LessonProgressSummary completed={completedLessons} total={totalLessons} />
            <div className="mb-3 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
              <ListChecks className="h-4 w-4 text-muted-foreground" />
              บทเรียนในหลักสูตร
            </div>
            <LessonTree {...treeProps} />
          </CardContent>
        </Card>
      </div>
    </aside>
  )
}
