import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { ROLE_LABELS } from '@/constants/labels'
import { formatThaiDate } from '@/utils/formatting'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const ENROLLMENT_ROWS = 20

function LoadingRows() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full rounded-md" />
      ))}
    </div>
  )
}

function EnrollmentsTab({ recent }) {
  if (recent === null) return <LoadingRows />
  if (recent.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
  }
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ผู้เรียน</TableHead>
            <TableHead>หน่วยงาน</TableHead>
            <TableHead>บทบาท</TableHead>
            <TableHead>หลักสูตร</TableHead>
            <TableHead className="whitespace-nowrap">วันที่</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {recent.slice(0, ENROLLMENT_ROWS).map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium text-foreground">{r.user.full_name}</TableCell>
              <TableCell className="text-muted-foreground">{r.user.department || '-'}</TableCell>
              <TableCell className="text-muted-foreground">
                {ROLE_LABELS[r.user.role] || r.user.role}
              </TableCell>
              <TableCell>
                <Link
                  to={`/admin/courses/${r.course.id}/edit`}
                  className="text-primary hover:underline"
                >
                  {r.course.title}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatThaiDate(r.enrolled_at, { month: 'short', fallback: '-' })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

function AuditTab({ audit }) {
  return (
    <div>
      {audit === null ? (
        <LoadingRows />
      ) : audit.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
      ) : (
        <ul className="divide-y divide-border/60">
          {audit.map((a) => (
            <li key={a.id} className="py-3">
              <div className="text-sm font-medium text-foreground">
                {a.summary || a.target_label || a.action}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {a.actor_username} · {formatThaiDate(a.created_at, { month: 'short', fallback: '' })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 border-t border-border/60 pt-3 text-center">
        <Link
          to="/admin/audit-logs"
          className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          ดูบันทึกทั้งหมด
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

/** One card, two tabs: recent enrollments + the admin-activity audit feed. */
export default function ActivityTabs({ recent, audit }) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-4 sm:p-6">
        <Tabs defaultValue="enrollments">
          <TabsList className="mb-4">
            <TabsTrigger value="enrollments">การลงทะเบียนล่าสุด</TabsTrigger>
            <TabsTrigger value="audit">กิจกรรมผู้ดูแล</TabsTrigger>
          </TabsList>
          <TabsContent value="enrollments">
            <EnrollmentsTab recent={recent} />
          </TabsContent>
          <TabsContent value="audit">
            <AuditTab audit={audit} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
