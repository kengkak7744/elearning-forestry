import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Award,
  Building2,
  Check,
  Download,
  GraduationCap,
  Mail,
  Phone,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react'
import { adminStatsApi } from '@/api/adminStats'
import { CATEGORY_BADGES, ROLE_LABELS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
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
import UserSummarySheet from '@/components/admin/UserSummarySheet'
import { toastApiError } from '@/utils/apiError'

const ROLE_TONE = {
  admin: 'bg-destructive/15 text-destructive',
  instructor: 'bg-primary/15 text-primary',
  manager: 'bg-warning/20 text-warning',
  learner: 'bg-muted text-muted-foreground',
}

function RoleChip({ role, count }) {
  const label = ROLE_LABELS[role] || role
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
        ROLE_TONE[role] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
      {count != null && (
        <span className="font-semibold tabular-nums">{count}</span>
      )}
    </span>
  )
}

function KpiCard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
          {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminDepartmentDetailPage() {
  const { name: rawName } = useParams()
  const department = decodeURIComponent(rawName || '')
  useDocumentTitle(department || 'หน่วยงาน')

  const [departmentMeta, setDepartmentMeta] = useState(null)
  const [members, setMembers] = useState([])
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)

  // Members tab filters
  const [memberFilter, setMemberFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [activeOnly, setActiveOnly] = useState(false)

  // Drill-in: open UserSummarySheet for a clicked member.
  const [summaryUserId, setSummaryUserId] = useState(null)
  // Drill-in: open the "who's enrolled vs not" sheet when a course is clicked.
  const [activeCourse, setActiveCourse] = useState(null)

  useEffect(() => {
    if (!department) return
    setLoading(true)
    Promise.all([
      adminStatsApi.departments().catch(() => []),
      adminStatsApi.departmentMembers(department).catch(() => []),
      adminStatsApi.departmentCourses(department).catch(() => []),
    ])
      .then(([allDepts, mem, crs]) => {
        setDepartmentMeta(allDepts.find((d) => d.name === department) || null)
        setMembers(mem)
        setCourses(crs)
      })
      .catch((err) =>
        toastApiError(err, 'โหลดข้อมูลไม่สำเร็จ')
      )
      .finally(() => setLoading(false))
  }, [department])

  // Derived KPIs that don't require a separate API call — the members list
  // already carries the data, just aggregate locally.
  const stats = useMemo(() => {
    const totalUsers = members.length
    const active = members.filter((m) => m.is_active).length
    const totalEnroll = members.reduce((sum, m) => sum + (m.enrollment_count || 0), 0)
    const totalCerts = members.reduce((sum, m) => sum + (m.cert_count || 0), 0)
    const byRole = members.reduce((acc, m) => {
      const r = m.role || 'unknown'
      acc[r] = (acc[r] || 0) + 1
      return acc
    }, {})
    return { totalUsers, active, totalEnroll, totalCerts, byRole }
  }, [members])

  const mandatoryAttention = useMemo(
    () =>
      courses.filter(
        (c) => c.is_mandatory && c.certification_pct < 80
      ),
    [courses]
  )

  const filteredMembers = useMemo(() => {
    const q = memberFilter.trim().toLowerCase()
    return members.filter((m) => {
      if (activeOnly && !m.is_active) return false
      if (roleFilter !== 'all' && m.role !== roleFilter) return false
      if (!q) return true
      return (
        m.full_name?.toLowerCase().includes(q) ||
        m.email?.toLowerCase().includes(q) ||
        m.position?.toLowerCase().includes(q) ||
        m.username?.toLowerCase().includes(q)
      )
    })
  }, [members, memberFilter, roleFilter, activeOnly])

  const csvHref = adminStatsApi.departmentMembersCsvUrl(department)

  if (!department) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        ไม่พบหน่วยงาน
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      {/* Header */}
      <Link
        to="/admin/departments"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        หน่วยงานทั้งหมด
      </Link>

      <div className="mb-6 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="inline-flex items-center gap-2 text-2xl font-semibold text-foreground sm:text-3xl">
            <Building2 className="h-6 w-6 text-muted-foreground" />
            {department}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            ข้อมูลสมาชิก ความคืบหน้าหลักสูตร และการได้รับใบรับรอง
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={csvHref} target="_blank" rel="noopener noreferrer">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            ดาวน์โหลด CSV สมาชิก
          </a>
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard
              icon={Users}
              label="สมาชิกทั้งหมด"
              value={stats.totalUsers}
              hint={`ใช้งานอยู่ ${stats.active}`}
            />
            <KpiCard
              icon={GraduationCap}
              label="การลงทะเบียน"
              value={stats.totalEnroll}
              hint={`เฉลี่ย ${
                stats.totalUsers
                  ? (stats.totalEnroll / stats.totalUsers).toFixed(1)
                  : 0
              } หลักสูตร/คน`}
            />
            <KpiCard
              icon={Award}
              label="ใบรับรองที่ใช้งานได้"
              value={stats.totalCerts}
            />
            <KpiCard
              icon={ShieldAlert}
              label="หลักสูตรบังคับที่ต้องเร่ง"
              value={mandatoryAttention.length}
              hint="ผ่านน้อยกว่า 80%"
            />
          </div>

          {/* Role breakdown */}
          <Card className="mb-4 border-border/60">
            <CardContent className="flex flex-wrap items-center gap-2 p-3">
              <span className="text-xs font-medium text-muted-foreground">
                สัดส่วนบทบาท:
              </span>
              {['admin', 'instructor', 'manager', 'learner']
                .map((r) => [r, stats.byRole[r] ?? 0])
                .filter(([, n]) => n > 0)
                .map(([role, n]) => (
                  <RoleChip key={role} role={role} count={n} />
                ))}
              {Object.keys(stats.byRole).length === 0 && (
                <span className="text-xs text-muted-foreground">ไม่มีข้อมูล</span>
              )}
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="courses" className="w-full">
            <TabsList>
              <TabsTrigger value="courses">
                หลักสูตร ({courses.length})
              </TabsTrigger>
              <TabsTrigger value="members">
                สมาชิก ({members.length})
              </TabsTrigger>
            </TabsList>

            {/* COURSES TAB */}
            <TabsContent value="courses" className="mt-4">
              {courses.length === 0 ? (
                <Card className="border-dashed border-border/60">
                  <CardContent className="p-10 text-center text-sm text-muted-foreground">
                    ยังไม่มีการเข้าเรียนในหน่วยงานนี้
                  </CardContent>
                </Card>
              ) : (
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
                          const cat = CATEGORY_BADGES[c.category]
                          const pct = c.certification_pct
                          const tone =
                            pct >= 80
                              ? 'success'
                              : pct >= 50
                              ? 'warning'
                              : 'destructive'
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
                              onClick={() => setActiveCourse(c)}
                            >
                              <TableCell>
                                <div className="block min-w-0">
                                  <div className="line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
                                    {c.title}
                                  </div>
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    {cat && (
                                      <Badge variant="secondary" className="font-normal">
                                        {cat.label}
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
              )}
            </TabsContent>

            {/* MEMBERS TAB */}
            <TabsContent value="members" className="mt-4">
              {/* Filters */}
              <Card className="mb-3 border-border/60">
                <CardContent className="flex flex-wrap items-center gap-2 p-3">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={memberFilter}
                      onChange={(e) => setMemberFilter(e.target.value)}
                      placeholder="ค้นหาชื่อ / อีเมล / ตำแหน่ง"
                      className="pl-8"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { v: 'all', label: 'ทุกบทบาท' },
                      { v: 'admin', label: 'ผู้ดูแล' },
                      { v: 'instructor', label: 'ผู้สอน' },
                      { v: 'manager', label: 'ผู้จัดการ' },
                      { v: 'learner', label: 'ผู้เรียน' },
                    ].map((t) => (
                      <Button
                        key={t.v}
                        size="sm"
                        variant={roleFilter === t.v ? 'default' : 'outline'}
                        onClick={() => setRoleFilter(t.v)}
                      >
                        {t.label}
                      </Button>
                    ))}
                    <Button
                      size="sm"
                      variant={activeOnly ? 'default' : 'outline'}
                      onClick={() => setActiveOnly((v) => !v)}
                    >
                      {activeOnly ? <Check className="mr-1 h-3.5 w-3.5" /> : null}
                      ใช้งานอยู่
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="mb-2 text-xs text-muted-foreground">
                แสดง {filteredMembers.length} จาก {members.length} คน
                {(roleFilter !== 'all' || activeOnly || memberFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMemberFilter('')
                      setRoleFilter('all')
                      setActiveOnly(false)
                    }}
                    className="ml-2 inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    <X className="h-3 w-3" /> ล้างตัวกรอง
                  </button>
                )}
              </div>

              {filteredMembers.length === 0 ? (
                <Card className="border-dashed border-border/60">
                  <CardContent className="p-10 text-center text-sm text-muted-foreground">
                    ไม่พบสมาชิกที่ตรงกับเงื่อนไข
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-border/60">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ชื่อ-สกุล</TableHead>
                          <TableHead>บทบาท</TableHead>
                          <TableHead>ตำแหน่ง</TableHead>
                          <TableHead>ติดต่อ</TableHead>
                          <TableHead className="text-right whitespace-nowrap">เรียน / ใบรับรอง</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.map((m) => (
                          <TableRow key={m.id} className={m.is_active ? '' : 'opacity-60'}>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => setSummaryUserId(m.id)}
                                className="group block text-left"
                                title="ดูหลักสูตรที่ลงทะเบียนของผู้ใช้นี้"
                              >
                                <div className="text-sm font-medium text-foreground group-hover:text-primary group-hover:underline">
                                  {m.full_name}
                                  {!m.is_active && (
                                    <Badge variant="secondary" className="ml-1.5 font-normal">
                                      ปิด
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-[11px] text-muted-foreground">
                                  @{m.username}
                                </div>
                              </button>
                            </TableCell>
                            <TableCell>
                              <RoleChip role={m.role} />
                            </TableCell>
                            <TableCell className="max-w-[180px]">
                              <div
                                className="truncate text-sm text-foreground"
                                title={m.position}
                              >
                                {m.position || '—'}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5 text-xs">
                                {m.email && (
                                  <a
                                    href={`mailto:${m.email}`}
                                    className="inline-flex items-center gap-1 text-foreground hover:text-primary"
                                  >
                                    <Mail className="h-3 w-3" />
                                    {m.email}
                                  </a>
                                )}
                                {m.phone && (
                                  <a
                                    href={`tel:${m.phone.replace(/\s+/g, '')}`}
                                    className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                                  >
                                    <Phone className="h-3 w-3" />
                                    {m.phone}
                                  </a>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground">
                              {m.enrollment_count} / {m.cert_count}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}

      <UserSummarySheet
        userId={summaryUserId}
        open={!!summaryUserId}
        onOpenChange={(o) => !o && setSummaryUserId(null)}
      />

      <CourseMembersSheet
        department={department}
        course={activeCourse}
        open={!!activeCourse}
        onOpenChange={(o) => !o && setActiveCourse(null)}
        onPickMember={(id) => setSummaryUserId(id)}
      />
    </div>
  )
}

/**
 * Drill-in for one (department, course) cell. Shows two tabs — ลงทะเบียนแล้ว
 * vs ยังไม่ลงทะเบียน — so an admin can answer "who hasn't started this
 * mandatory course yet?" without leaving the page.
 *
 * Each row in the enrolled tab carries a per-user progress bar + cert status.
 * Clicking a name forwards to UserSummarySheet (handled by the parent so the
 * Sheet stacks behave correctly).
 */
function CourseMembersSheet({ department, course, open, onOpenChange, onPickMember }) {
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
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
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
                    className="block text-left"
                    title="ดูประวัติการเรียนของผู้ใช้นี้"
                  >
                    <div className="text-sm font-medium text-foreground hover:text-primary hover:underline">
                      {m.full_name}
                    </div>
                    <div className="text-[11px] text-muted-foreground">@{m.username}</div>
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
                          <Mail className="h-3 w-3" />
                          {m.email}
                        </a>
                      )}
                      {m.phone && (
                        <a
                          href={`tel:${m.phone.replace(/\s+/g, '')}`}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
                        >
                          <Phone className="h-3 w-3" />
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
