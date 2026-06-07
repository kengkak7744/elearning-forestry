import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Award,
  BookOpen,
  Building2,
  Download,
  MessageSquare,
  ShieldCheck,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react'
import { adminStatsApi } from '@/api/adminStats'
import { CATEGORY_BADGES, ROLE_LABELS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import CourseFeedbackDialog from '@/components/admin/CourseFeedbackDialog'

function KPICard({ icon: Icon, label, value, hint }) {
  return (
    <Card className="border-border/60">
      <CardContent className="flex items-start gap-4 p-5">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums text-foreground">{value}</div>
          {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  )
}

export default function AdminDashboardPage() {
  useDocumentTitle('แดชบอร์ดผู้ดูแลระบบ')
  const [overview, setOverview] = useState(null)
  const [topCourses, setTopCourses] = useState([])
  const [topDepartments, setTopDepartments] = useState([])
  const [recent, setRecent] = useState([])
  const [compliance, setCompliance] = useState(null)
  const [feedbackStats, setFeedbackStats] = useState(null)
  const [feedbackCourse, setFeedbackCourse] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      adminStatsApi.overview(),
      adminStatsApi.topCourses(10),
      adminStatsApi.topDepartments(10),
      adminStatsApi.recentEnrollments(20),
      adminStatsApi.departmentCompliance().catch(() => null),
      adminStatsApi.courseFeedback(3).catch(() => null),
    ])
      .then(([o, c, d, r, comp, fb]) => {
        setOverview(o)
        setTopCourses(c)
        setTopDepartments(d)
        setRecent(r)
        setCompliance(comp)
        setFeedbackStats(fb)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const maxCourseEnroll = Math.max(1, ...topCourses.map((c) => c.enrolled_count))
  const maxDeptEnroll = Math.max(1, ...topDepartments.map((d) => d.enrolled_count))

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          แดชบอร์ดผู้ดูแลระบบ
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ภาพรวมการใช้งานระบบ e-Learning
        </p>
      </div>

      {/* KPI cards */}
      {loading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : overview ? (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KPICard
            icon={Users}
            label="ผู้ใช้ทั้งหมด"
            value={overview.total_users}
            hint={`ใช้งานอยู่ ${overview.active_users} คน`}
          />
          <KPICard
            icon={BookOpen}
            label="หลักสูตรทั้งหมด"
            value={overview.total_courses}
            hint={`เผยแพร่ ${overview.published_courses} หลักสูตร`}
          />
          <KPICard
            icon={TrendingUp}
            label="การลงทะเบียน"
            value={overview.total_enrollments}
            hint={`จบหลักสูตร ${overview.completed_enrollments} ครั้ง`}
          />
          <KPICard
            icon={Award}
            label="อัตราการเรียนจบ"
            value={`${overview.completion_rate}%`}
            hint="ของผู้ลงทะเบียน"
          />
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Top courses */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <h2 className="text-base font-semibold text-foreground">หลักสูตรยอดนิยม</h2>
          </CardHeader>
          <CardContent>
            {topCourses.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-4">
                {topCourses.map((c) => {
                  const cat = CATEGORY_BADGES[c.category]
                  const pct = (c.enrolled_count / maxCourseEnroll) * 100
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

        {/* Top departments */}
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
            {topDepartments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-4">
                {topDepartments.map((d) => {
                  const pct = (d.enrolled_count / maxDeptEnroll) * 100
                  return (
                    <Link
                      key={d.department}
                      to={`/admin/departments/${encodeURIComponent(d.department)}`}
                      className="block rounded-md p-1 -m-1 transition hover:bg-muted/30"
                    >
                      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-medium text-foreground">
                          {d.department}
                        </span>
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
      </div>

      {/* Recent enrollments */}
      {/* Department compliance — % of department staff that hold non-expired
          certs for ALL mandatory courses. Sorted worst-first so high-priority
          departments surface immediately. */}
      <Card className="mt-4 border-border/60 sm:mt-6">
        <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3 space-y-0">
          <div className="min-w-0">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              ภาพรวมการอบรมหลักสูตรบังคับตามหน่วยงาน
            </h2>
            {compliance?.mandatory_courses_count !== undefined && (
              <p className="text-sm text-muted-foreground">
                จากหลักสูตรบังคับ {compliance.mandatory_courses_count} หลักสูตร
                (นับเฉพาะใบรับรองที่ยังไม่หมดอายุ)
              </p>
            )}
          </div>
          {compliance && compliance.departments?.length > 0 && (
            <Button asChild variant="outline" size="sm" className="flex-shrink-0">
              <a
                href={adminStatsApi.departmentComplianceCsvUrl()}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Download className="mr-1.5 h-3.5 w-3.5" />
                ดาวน์โหลด CSV
              </a>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {!compliance || compliance.mandatory_courses_count === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              ยังไม่มีหลักสูตรบังคับในระบบ
            </p>
          ) : compliance.departments.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              ยังไม่มีข้อมูลหน่วยงาน
            </p>
          ) : (
            <div className="space-y-4">
              {compliance.departments.map((d) => {
                const rate = d.completion_rate
                const tone =
                  rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'destructive'
                const barColor =
                  tone === 'success'
                    ? '[&>div]:bg-success'
                    : tone === 'warning'
                    ? '[&>div]:bg-warning'
                    : '[&>div]:bg-destructive'
                return (
                  <div key={d.department}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-medium text-foreground">{d.department}</span>
                      <span className="flex-shrink-0 tabular-nums text-muted-foreground">
                        {d.actual_completions}/{d.required_completions} ครั้ง ·{' '}
                        <span
                          className={
                            tone === 'success'
                              ? 'font-semibold text-success'
                              : tone === 'warning'
                              ? 'font-semibold text-warning'
                              : 'font-semibold text-destructive'
                          }
                        >
                          {rate}%
                        </span>
                      </span>
                    </div>
                    <Progress value={rate} className={`h-2 ${barColor}`} />
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      {d.staff_count} คน
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Course feedback — underperforming-first, then the rest below.
          "Underperforming" = avg < 3.0 AND ≥3 ratings (server-decided so the
          threshold stays consistent across admin views). */}
      {feedbackStats && feedbackStats.courses?.length > 0 && (
        <Card className="mt-4 border-border/60 sm:mt-6">
          <CardHeader className="pb-3">
            <h2 className="inline-flex items-center gap-2 text-base font-semibold text-foreground">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              ความคิดเห็นต่อหลักสูตร
            </h2>
            <p className="text-sm text-muted-foreground">
              จัดเรียงจากคะแนนต่ำสุด — คลิกเพื่อดูข้อความที่ผู้เรียนเขียน
              (ต้องมีอย่างน้อย {feedbackStats.min_count_threshold} ความคิดเห็นจึงจะถูกระบุว่าควรปรับปรุง)
            </p>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60">
              {feedbackStats.courses
                .filter((c) => c.count > 0)
                .slice(0, 10)
                .map((c) => {
                  const tone =
                    c.average == null
                      ? 'neutral'
                      : c.average >= 4
                      ? 'success'
                      : c.average >= 3
                      ? 'warning'
                      : 'destructive'
                  const numCls =
                    tone === 'success'
                      ? 'text-success'
                      : tone === 'warning'
                      ? 'text-warning'
                      : tone === 'destructive'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() =>
                          setFeedbackCourse({ id: c.id, title: c.title })
                        }
                        className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/40"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-foreground">
                            {c.title}
                          </div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                            {c.is_underperforming && (
                              <Badge className="bg-destructive/15 text-destructive hover:bg-destructive/15 font-normal">
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
                          <Star className={`h-3.5 w-3.5 ${numCls} fill-current`} />
                          <span className={`font-semibold tabular-nums ${numCls}`}>
                            {c.average != null ? c.average.toFixed(1) : '—'}
                          </span>
                        </div>
                      </button>
                    </li>
                  )
                })}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card className="mt-4 border-border/60 sm:mt-6">
        <CardHeader className="pb-3">
          <h2 className="text-base font-semibold text-foreground">การลงทะเบียนล่าสุด</h2>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีข้อมูล</p>
          ) : (
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
                  {recent.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium text-foreground">
                        {r.user.full_name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.user.department || '-'}
                      </TableCell>
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
                        {r.enrolled_at
                          ? new Date(r.enrolled_at).toLocaleDateString('th-TH', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <CourseFeedbackDialog
        open={!!feedbackCourse}
        onOpenChange={(o) => !o && setFeedbackCourse(null)}
        courseId={feedbackCourse?.id}
        courseTitle={feedbackCourse?.title}
      />
    </div>
  )
}
