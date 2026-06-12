import { FileText, Film, Hourglass, Tv } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { fmtTime } from '@/utils/formatting'
import LessonResourceList from '@/components/learner/LessonResourceList'
import LessonNotes from '@/components/learner/LessonNotes'

/**
 * Tabbed lesson info under the player:
 *   รายละเอียด  — position, title, type/duration/pages, min-view note, description
 *   เอกสารประกอบ — resource list (hidden when the course disables downloads or the
 *                  lesson has no resources); a count badge sits on the trigger
 *   โน้ตของฉัน   — the private, autosaving notes textarea (reused unchanged)
 *
 * End-of-lesson quizzes intentionally live OUTSIDE this component (rendered
 * below it, always visible) so a blocking quiz can never hide behind a tab.
 * Mount with key={lesson.id} so the active tab resets per lesson and never
 * points at a trigger that disappeared.
 */
export default function LessonInfoTabs({
  lesson,
  currentPos,
  minSeconds,
  timeGateMet,
  allowDownloads,
}) {
  const resources = Array.isArray(lesson.resources) ? lesson.resources : []
  const showResources = allowDownloads !== false && resources.length > 0

  return (
    <Card className="mb-4 border-border/60">
      <CardContent className="p-4 sm:p-6">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">รายละเอียด</TabsTrigger>
            {showResources && (
              <TabsTrigger value="resources" className="gap-1.5">
                เอกสารประกอบ
                <Badge
                  variant="secondary"
                  className="px-1.5 py-0 text-[10px] font-normal tabular-nums"
                >
                  {resources.length}
                </Badge>
              </TabsTrigger>
            )}
            <TabsTrigger value="notes">โน้ตของฉัน</TabsTrigger>
          </TabsList>

          <TabsContent value="details">
            {currentPos && (
              <div className="mb-2 text-xs font-medium text-primary">
                โมดูล {currentPos.mi + 1} · บทเรียน {currentPos.li + 1}
              </div>
            )}
            <h2 className="text-xl font-semibold text-foreground sm:text-2xl">
              {lesson.title}
            </h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                {lesson.content_type === 'pdf' ? (
                  <>
                    <FileText className="h-3.5 w-3.5" /> PDF
                  </>
                ) : lesson.content_type === 'video_youtube' ? (
                  <>
                    <Tv className="h-3.5 w-3.5" /> YouTube
                  </>
                ) : (
                  <>
                    <Film className="h-3.5 w-3.5" /> วิดีโอ
                  </>
                )}
              </span>
              {lesson.duration_seconds ? (
                <span className="inline-flex items-center gap-1">
                  <Hourglass className="h-3.5 w-3.5" />
                  {fmtTime(lesson.duration_seconds)}
                </span>
              ) : null}
              {lesson.total_pages ? (
                <span className="inline-flex items-center gap-1">
                  <FileText className="h-3.5 w-3.5" /> {lesson.total_pages} หน้า
                </span>
              ) : null}
              {minSeconds > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1',
                    timeGateMet ? 'text-success' : 'text-warning'
                  )}
                >
                  <Hourglass className="h-3.5 w-3.5" /> ขั้นต่ำ {fmtTime(minSeconds)}
                </span>
              )}
            </div>
            {lesson.description && (
              <div className="mt-3 whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm text-foreground">
                {lesson.description}
              </div>
            )}
          </TabsContent>

          {showResources && (
            <TabsContent value="resources">
              <LessonResourceList resources={resources} />
            </TabsContent>
          )}

          <TabsContent value="notes">
            <LessonNotes lessonId={lesson.id} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
