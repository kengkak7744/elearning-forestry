import { useEffect, useState } from 'react'
import { Star } from 'lucide-react'
import { feedbackApi } from '@/api/feedback'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { toastApiError } from '@/utils/apiError'

function Stars({ value }) {
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} ดาว`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            'h-3.5 w-3.5',
            n <= value ? 'fill-warning text-warning' : 'fill-transparent text-muted-foreground/30'
          )}
        />
      ))}
    </div>
  )
}

/**
 * Read-only list of every comment left on a course. Opens from the admin
 * dashboard's underperforming-courses card so an admin can drill down from
 * "this course is rated 2.3" to "why" in one click.
 */
export default function CourseFeedbackDialog({ courseId, courseTitle, open, onOpenChange }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open || !courseId) return
    setLoading(true)
    feedbackApi
      .list(courseId, { limit: 200 })
      .then(setItems)
      .catch((err) =>
        toastApiError(err, 'โหลดความคิดเห็นไม่สำเร็จ')
      )
      .finally(() => setLoading(false))
  }, [open, courseId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>ความคิดเห็นต่อหลักสูตร</DialogTitle>
          <DialogDescription className="line-clamp-2">{courseTitle}</DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-2">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-md" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              ยังไม่มีความคิดเห็น
            </p>
          ) : (
            <ul className="space-y-3">
              {items.map((it) => (
                <li
                  key={it.id}
                  className="rounded-md border border-border/60 bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">
                        {it.user.full_name}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {it.user.department || '—'}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Stars value={it.rating} />
                      <span className="text-[11px] text-muted-foreground">
                        {it.created_at
                          ? new Date(it.created_at).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : ''}
                      </span>
                    </div>
                  </div>
                  {it.comment ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                      {it.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs italic text-muted-foreground">
                      ไม่มีข้อความเพิ่มเติม
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
