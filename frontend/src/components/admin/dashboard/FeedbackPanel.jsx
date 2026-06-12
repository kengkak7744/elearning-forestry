import { MessageSquare, Star } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

const MAX_SHOWN = 6

function toneOf(avg) {
  if (avg == null) return 'text-muted-foreground'
  if (avg >= 4) return 'text-success'
  if (avg >= 3) return 'text-warning'
  return 'text-destructive'
}

/**
 * Course feedback, worst-first. Click a row to open CourseFeedbackDialog (the
 * parent owns the dialog via `onSelectCourse`). Capped at 6 courses with ratings.
 */
export default function FeedbackPanel({ feedback, onSelectCourse }) {
  if (feedback === null) return <Skeleton className="h-80 w-full rounded-xl" />

  const courses = (Array.isArray(feedback.courses) ? feedback.courses : [])
    .filter((c) => c.count > 0)
    .slice(0, MAX_SHOWN)

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          ความคิดเห็นต่อหลักสูตร
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          จัดเรียงจากคะแนนต่ำสุด — คลิกเพื่อดูข้อความที่ผู้เรียนเขียน
        </p>
      </CardHeader>
      <CardContent>
        {courses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีความคิดเห็น</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {courses.map((c) => {
              const cls = toneOf(c.average)
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCourse({ id: c.id, title: c.title })}
                    className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/40"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">{c.title}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {c.is_underperforming && (
                          <Badge className="bg-destructive/15 font-normal text-destructive hover:bg-destructive/15">
                            ควรปรับปรุง
                          </Badge>
                        )}
                        {!c.is_published && (
                          <Badge variant="secondary" className="font-normal">
                            ฉบับร่าง
                          </Badge>
                        )}
                        <span>{c.count} ความคิดเห็น</span>
                      </div>
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-1 text-sm">
                      <Star className={`h-3.5 w-3.5 ${cls} fill-current`} />
                      <span className={`font-semibold tabular-nums ${cls}`}>
                        {c.average != null ? c.average.toFixed(1) : '—'}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
