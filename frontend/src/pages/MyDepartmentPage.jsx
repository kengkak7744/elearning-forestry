import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Award,
  Building2,
  Download,
  GraduationCap,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { adminStatsApi } from '@/api/adminStats'
import { useAuth } from '@/contexts/AuthContext'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import useFetchData from '@/hooks/useFetchData'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import UserSummarySheet from '@/components/admin/UserSummarySheet'
import RoleChip from '@/components/admin/department/RoleChip'
import DeptCoursesTab from '@/components/admin/department/DeptCoursesTab'
import DeptMembersTab from '@/components/admin/department/DeptMembersTab'
import CourseMembersSheet from '@/components/admin/department/CourseMembersSheet'
import StatCard from '@/components/shared/StatCard'

/**
 * Manager-facing view of their OWN department — members + course/compliance
 * stats. Reuses the admin department-detail components, but the department is
 * fixed to the signed-in user's `department` (not a URL param). The backend
 * scopes the same /admin/stats/departments/{dept}/* endpoints so a manager can
 * only ever read their own department's data (see require_department_access).
 */
export default function MyDepartmentPage() {
  const { user } = useAuth()
  const department = user?.department || ''
  const allowed = user?.role === 'manager' || user?.role === 'admin'
  useDocumentTitle('หน่วยงานของฉัน')

  const [summaryUserId, setSummaryUserId] = useState(null)
  const [activeCourse, setActiveCourse] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') === 'members' ? 'members' : 'courses'

  const { data, loading } = useFetchData(
    async () => {
      if (!allowed || !department) return { members: [], courses: [] }
      const [members, courses] = await Promise.all([
        adminStatsApi.departmentMembers(department).catch(() => []),
        adminStatsApi.departmentCourses(department).catch(() => []),
      ])
      return { members, courses }
    },
    [department, allowed],
    { errorFallback: 'โหลดข้อมูลไม่สำเร็จ', initialData: { members: [], courses: [] } }
  )
  const { members, courses } = data

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
    () => courses.filter((c) => c.is_mandatory && c.certification_pct < 80),
    [courses]
  )

  const membersCsvHref = adminStatsApi.departmentMembersCsvUrl(department)
  const progressCsvHref = adminStatsApi.departmentProgressCsvUrl(department)

  // Role guard — a regular learner who lands here directly shouldn't see a page
  // that just errors out behind the scenes.
  if (!allowed) {
    return (
      <div className="mx-auto w-full max-w-2xl p-8">
        <Card className="border-dashed border-border/60">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            หน้านี้สำหรับหัวหน้างานเท่านั้น
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!department) {
    return (
      <div className="mx-auto w-full max-w-2xl p-8">
        <Card className="border-dashed border-border/60">
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            บัญชีของคุณยังไม่ได้ระบุหน่วยงาน — โปรดติดต่อผู้ดูแลระบบ
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <AdminPageHeader
        icon={Building2}
        title={department}
        subtitle="สมาชิกและสถิติของหน่วยงานคุณ — ความคืบหน้าหลักสูตรและการได้รับใบรับรอง"
        actions={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            {/* รายหลักสูตร = the row-per-course report a head attaches when
                reporting upward; สมาชิก = the one-row-per-person summary */}
            <Button asChild size="sm">
              <a href={progressCsvHref} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                CSV รายงานความคืบหน้า (รายหลักสูตร)
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a href={membersCsvHref} target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                CSV สรุปรายคน
              </a>
            </Button>
          </div>
        }
      />

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
            <StatCard
              size="sm"
              icon={Users}
              label="สมาชิกทั้งหมด"
              value={stats.totalUsers}
              hint={`ใช้งานอยู่ ${stats.active}`}
            />
            <StatCard
              size="sm"
              icon={GraduationCap}
              label="การลงทะเบียน"
              value={stats.totalEnroll}
              hint={`เฉลี่ย ${
                stats.totalUsers
                  ? (stats.totalEnroll / stats.totalUsers).toFixed(1)
                  : 0
              } หลักสูตร/คน`}
            />
            <StatCard
              size="sm"
              icon={Award}
              label="ใบรับรองที่ใช้งานได้"
              value={stats.totalCerts}
            />
            <StatCard
              size="sm"
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
          <Tabs
            value={tab}
            onValueChange={(v) => setSearchParams({ tab: v }, { replace: true })}
            className="w-full"
          >
            <TabsList>
              <TabsTrigger value="courses">
                หลักสูตร ({courses.length})
              </TabsTrigger>
              <TabsTrigger value="members">
                สมาชิก ({members.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="courses" className="mt-4">
              <DeptCoursesTab courses={courses} onPickCourse={setActiveCourse} />
            </TabsContent>

            <TabsContent value="members" className="mt-4">
              <DeptMembersTab members={members} onPickMember={setSummaryUserId} />
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
