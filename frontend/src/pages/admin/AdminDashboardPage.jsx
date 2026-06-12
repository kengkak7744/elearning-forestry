import { useEffect, useState } from 'react'
import { adminStatsApi } from '@/api/adminStats'
import { certificatesApi } from '@/api/certificates'
import { auditApi } from '@/api/audit'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import CourseFeedbackDialog from '@/components/admin/CourseFeedbackDialog'
import AdminPageHeader from '@/components/admin/AdminPageHeader'
import QuickActions from '@/components/admin/dashboard/QuickActions'
import AdminKpiRow from '@/components/admin/dashboard/AdminKpiRow'
import CompliancePanel from '@/components/admin/dashboard/CompliancePanel'
import FeedbackPanel from '@/components/admin/dashboard/FeedbackPanel'
import CertificatesPanel from '@/components/admin/dashboard/CertificatesPanel'
import TopCoursesCard from '@/components/admin/dashboard/TopCoursesCard'
import TopDepartmentsCard from '@/components/admin/dashboard/TopDepartmentsCard'
import ActivityTabs from '@/components/admin/dashboard/ActivityTabs'

export default function AdminDashboardPage() {
  useDocumentTitle('แดชบอร์ดผู้ดูแลระบบ')
  const [overview, setOverview] = useState(null)
  const [topCourses, setTopCourses] = useState(null)
  const [topDepartments, setTopDepartments] = useState(null)
  const [recent, setRecent] = useState(null)
  const [compliance, setCompliance] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [certs, setCerts] = useState(null)
  const [audit, setAudit] = useState(null)
  const [feedbackCourse, setFeedbackCourse] = useState(null)

  // Eight isolated fetches: each owns its state + catch, so one slow or blocked
  // endpoint never gates or blanks the rest. `null` = loading, empty = failed/none.
  // Admin stats are server-cached 60s, so parallel calls are cheap.
  useEffect(() => {
    adminStatsApi.overview().then(setOverview).catch(() => setOverview({}))
    adminStatsApi.topCourses(10).then(setTopCourses).catch(() => setTopCourses([]))
    adminStatsApi.topDepartments(10).then(setTopDepartments).catch(() => setTopDepartments([]))
    adminStatsApi.recentEnrollments(100).then(setRecent).catch(() => setRecent([]))
    adminStatsApi.departmentCompliance().then(setCompliance).catch(() => setCompliance({}))
    adminStatsApi.courseFeedback(3).then(setFeedback).catch(() => setFeedback({}))
    certificatesApi.adminAll().then(setCerts).catch(() => setCerts([]))
    auditApi.list({ limit: 8 }).then(setAudit).catch(() => setAudit([]))
  }, [])

  return (
    <div className="mx-auto w-full max-w-7xl p-4 sm:p-8">
      <AdminPageHeader
        title="แดชบอร์ดผู้ดูแลระบบ"
        subtitle="ภาพรวมการใช้งานระบบ e-Learning"
        actions={<QuickActions />}
      />

      <div className="mb-6">
        <AdminKpiRow overview={overview} recent={recent} />
      </div>

      <section className="mb-4 sm:mb-6">
        <h2 className="mb-3 text-lg font-semibold text-foreground">ต้องให้ความสนใจ</h2>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2">
          <CompliancePanel compliance={compliance} />
          <FeedbackPanel feedback={feedback} onSelectCourse={setFeedbackCourse} />
        </div>
      </section>

      <div className="mb-4 sm:mb-6">
        <CertificatesPanel certs={certs} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 sm:mb-6 sm:gap-6 lg:grid-cols-2">
        <TopCoursesCard courses={topCourses} />
        <TopDepartmentsCard departments={topDepartments} />
      </div>

      <ActivityTabs recent={recent} audit={audit} />

      <CourseFeedbackDialog
        open={!!feedbackCourse}
        onOpenChange={(o) => !o && setFeedbackCourse(null)}
        courseId={feedbackCourse?.id}
        courseTitle={feedbackCourse?.title}
      />
    </div>
  )
}
