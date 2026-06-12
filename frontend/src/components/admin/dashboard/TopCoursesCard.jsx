import { Link } from 'react-router-dom'
import { CATEGORY_BADGES } from '@/constants/labels'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export default function TopCoursesCard({ courses }) {
  if (courses === null) return <Skeleton className="h-72 w-full rounded-xl" />

  const list = Array.isArray(courses) ? courses : []
  const max = Math.max(1, ...list.map((c) => c.enrolled_count))

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold text-foreground">หลักสูตรยอดนิยม</h2>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-4">
            {list.map((c) => {
              const cat = CATEGORY_BADGES[c.category]
              const pct = (c.enrolled_count / max) * 100
              return (
                <div key={c.id}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <Link
                      to={`/admin/courses/${c.id}/edit`}
                      className="truncate font-medium text-foreground hover:text-primary"
                    >
                      {c.title}
                    </Link>
                    <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                      {c.enrolled_count} คน
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                  {cat && (
                    <div className="mt-1.5">
                      <Badge variant="secondary" className="font-normal">
                        {cat.label}
                      </Badge>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
