import { Link } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'

export default function TopDepartmentsCard({ departments }) {
  if (departments === null) return <Skeleton className="h-72 w-full rounded-xl" />

  const list = Array.isArray(departments) ? departments : []
  const max = Math.max(1, ...list.map((d) => d.enrolled_count))

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <h2 className="text-base font-semibold text-foreground">
          <span className="inline-flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            หน่วยงานที่ลงทะเบียนมากที่สุด
          </span>
        </h2>
      </CardHeader>
      <CardContent>
        {list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="space-y-4">
            {list.map((d) => {
              const pct = (d.enrolled_count / max) * 100
              return (
                <Link
                  key={d.department}
                  to={`/admin/departments/${encodeURIComponent(d.department)}`}
                  className="block rounded-md p-1 -m-1 transition hover:bg-muted/30"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                    <span className="truncate font-medium text-foreground">{d.department}</span>
                    <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                      {d.enrolled_count} ครั้ง · {d.user_count} คน
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
