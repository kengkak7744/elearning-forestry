import { useEffect, useMemo, useState } from 'react'
import { Mail, Phone, Search } from 'lucide-react'
import { adminStatsApi } from '@/api/adminStats'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import UserAvatar from '@/components/admin/UserAvatar'
import { toastApiError } from '@/utils/apiError'

/**
 * Drill-in for one (department, course) cell. Shows two tabs — enrolled
 * (ลงทะเบียนแล้ว) vs not-yet-enrolled (ยังไม่ลงทะเบียน) — so an admin can answer
 * "who hasn't started this mandatory course yet?" without leaving the page.
 *
 * Each row in the enrolled tab carries a per-user progress bar + cert status.
 * Clicking a name forwards to UserSummarySheet (handled by the parent so the
 * Sheet stacks behave correctly).
 */
export default function CourseMembersSheet({ department, course, open, onOpenChange, onPickMember }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!open || !course) return
    setSearch('')
    setLoading(true)
    adminStatsApi
      .departmentCourseMembers(department, course.id)
      .then(setData)
      .catch((err) =>
        toastApiError(err, 'โหลดข้อมูลไม่สำเร็จ')
      )
      .finally(() => setLoading(false))
  }, [open, course, department])

  const filtered = useMemo(() => {
    if (!data?.members) return { enrolled: [], notEnrolled: [] }
    const q = search.trim().toLowerCase()
    const matches = (m) =>
      !q ||
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q) ||
      m.position?.toLowerCase().includes(q) ||
      m.username?.toLowerCase().includes(q)
    const enrolled = []
    const notEnrolled = []
    for (const m of data.members) {
      if (!matches(m)) continue
      ;(m.is_enrolled ? enrolled : notEnrolled).push(m)
    }
    // Inside enrolled: completed first (cert=valid), then in-progress, then expired/revoked.
    enrolled.sort((a, b) => {
      const order = { valid: 0, null: 1, expired: 2, revoked: 3 }
      const ra = order[a.cert_status ?? 'null'] ?? 4
      const rb = order[b.cert_status ?? 'null'] ?? 4
      if (ra !== rb) return ra - rb
      return (b.progress_percent || 0) - (a.progress_percent || 0)
    })
    return { enrolled, notEnrolled }
  }, [data, search])

  const totalEnrolled = data?.members?.filter((m) => m.is_enrolled).length ?? 0
  const totalNotEnrolled = data?.members?.filter((m) => !m.is_enrolled).length ?? 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto p-0 sm:max-w-2xl lg:max-w-4xl"
      >
        <SheetHeader className="border-b border-border/60 bg-muted/30 p-4">
          <SheetTitle className="line-clamp-2 text-base">
            {course?.title}
          </SheetTitle>
          <SheetDescription>
            {department} · ลงทะเบียนแล้ว {totalEnrolled} / ยังไม่ลงทะเบียน {totalNotEnrolled}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 p-4">
          <div className="relative">
            <Label htmlFor="course-member-search" className="sr-only">
              ค้นหาสมาชิกในหลักสูตร
            </Label>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="course-member-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาชื่อ / อีเมล / ตำแหน่ง"
              className="pl-8"
            />
          </div>

          {loading || !data ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-md" />
              ))}
            </div>
          ) : (
            <Tabs defaultValue="enrolled">
              <TabsList>
                <TabsTrigger value="enrolled">
                  ลงทะเบียนแล้ว ({filtered.enrolled.length})
                </TabsTrigger>
                <TabsTrigger value="not">
                  ยังไม่ลงทะเบียน ({filtered.notEnrolled.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="enrolled" className="mt-3">
                <CourseMemberList
                  rows={filtered.enrolled}
                  showProgress
                  onPickMember={onPickMember}
                  emptyText="ไม่มีสมาชิกที่ลงทะเบียน"
                />
              </TabsContent>
              <TabsContent value="not" className="mt-3">
                <CourseMemberList
                  rows={filtered.notEnrolled}
                  showProgress={false}
                  onPickMember={onPickMember}
                  emptyText="ทุกคนในหน่วยงานลงทะเบียนหลักสูตรนี้แล้ว 🎉"
                />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

function CertStatusBadge({ status }) {
  if (status === 'valid')
    return (
      <Badge className="bg-success/15 text-success hover:bg-success/15 font-normal">
        ใบรับรองใช้งานได้
      </Badge>
    )
  if (status === 'expired')
    return (
      <Badge className="bg-warning/20 text-warning hover:bg-warning/20 font-normal">
        ใบรับรองหมดอายุ
      </Badge>
    )
  if (status === 'revoked')
    return (
      <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 font-normal">
        ถูกเพิกถอน
      </Badge>
    )
  return null
}

function CourseMemberList({ rows, showProgress, onPickMember, emptyText }) {
  if (rows.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="p-10 text-center text-sm text-muted-foreground">
          {emptyText}
        </CardContent>
      </Card>
    )
  }
  return (
    <Card className="border-border/60">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อ-สกุล</TableHead>
              <TableHead>ตำแหน่ง</TableHead>
              {showProgress ? (
                <TableHead className="min-w-[160px]">ความคืบหน้า</TableHead>
              ) : (
                <TableHead>ติดต่อ</TableHead>
              )}
              <TableHead className="text-right">สถานะ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((m) => (
              <TableRow key={m.id} className={m.is_active ? '' : 'opacity-60'}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => onPickMember(m.id)}
                    aria-label={`ดูประวัติการเรียนของ ${m.full_name}`}
                    className="group flex items-center gap-2 text-left"
                    title="ดูประวัติการเรียนของผู้ใช้นี้"
                  >
                    <UserAvatar user={m} className="h-8 w-8" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                        {m.full_name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        @{m.username}
                      </span>
                    </span>
                  </button>
                </TableCell>
                <TableCell className="max-w-[160px]">
                  <div className="truncate text-sm text-foreground" title={m.position}>
                    {m.position || '—'}
                  </div>
                </TableCell>
                {showProgress ? (
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress
                        value={m.progress_percent}
                        aria-label={`ความคืบหน้าของ ${m.full_name}`}
                        className={`h-1.5 flex-1 ${
                          m.progress_percent >= 100
                            ? '[&>div]:bg-success'
                            : m.progress_percent >= 50
                            ? '[&>div]:bg-primary'
                            : '[&>div]:bg-warning'
                        }`}
                      />
                      <span className="w-9 text-right text-[11px] font-semibold tabular-nums text-muted-foreground">
                        {m.progress_percent}%
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {m.completed_lessons}/{m.total_lessons} บท
                    </div>
                  </TableCell>
                ) : (
                  <TableCell>
                    <div className="space-y-0.5 text-xs">
                      {m.email && (
                        <a
                          href={`mailto:${m.email}`}
                          className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                        >
                          <Mail className="h-3 w-3" aria-hidden="true" />
                          {m.email}
                        </a>
                      )}
                      {m.phone && (
                        <a
                          href={`tel:${m.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" aria-hidden="true" />
                          {m.phone}
                        </a>
                      )}
                    </div>
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap text-right">
                  {showProgress ? (
                    <CertStatusBadge status={m.cert_status} />
                  ) : (
                    !m.is_active && (
                      <Badge variant="secondary" className="font-normal">
                        ปิดใช้งาน
                      </Badge>
                    )
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  )
}
