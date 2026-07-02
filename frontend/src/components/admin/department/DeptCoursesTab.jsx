import { categoryLabel, useCategories } from '@/hooks/useCategories'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** Per-course certification table, worst-first. Clicking a row drills into
 * the (department, course) member sheet via onPickCourse. */
export default function DeptCoursesTab({ courses, onPickCourse }) {
  const categories = useCategories()
  if (courses.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          ยังไม่มีการเข้าเรียนในหน่วยงานนี้
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <p className="text-xs text-muted-foreground">
          เรียงจากหลักสูตรที่ผ่านน้อยที่สุด — เห็นที่ควรกระตุ้นก่อน
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>หลักสูตร</TableHead>
              <TableHead className="whitespace-nowrap">ลงทะเบียน</TableHead>
              <TableHead className="whitespace-nowrap">ได้รับใบรับรอง</TableHead>
              <TableHead className="min-w-[180px]">อัตราการผ่าน</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.map((c) => {
              const catLabel = categoryLabel(categories, c.category)
              const pct = c.certification_pct
              const tone =
                pct >= 80 ? 'success' : pct >= 50 ? 'warning' : 'destructive'
              const barCls =
                tone === 'success'
                  ? '[&>div]:bg-success'
                  : tone === 'warning'
                  ? '[&>div]:bg-warning'
                  : '[&>div]:bg-destructive'
              const numCls =
                tone === 'success'
                  ? 'text-success'
                  : tone === 'warning'
                  ? 'text-warning'
                  : 'text-destructive'
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/30"
                  onClick={() => onPickCourse(c)}
                >
                  <TableCell>
                    <div className="block min-w-0">
                      <div className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
                        {c.title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {catLabel && (
                          <Badge variant="secondary" className="font-normal">
                            {catLabel}
                          </Badge>
                        )}
                        {c.is_mandatory && (
                          <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 font-normal">
                            บังคับ
                          </Badge>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {c.enrolled_count}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {c.certified_count}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={pct} className={`h-2 flex-1 ${barCls}`} />
                      <span className={`w-10 text-right text-xs font-semibold tabular-nums ${numCls}`}>
                        {pct}%
                      </span>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
