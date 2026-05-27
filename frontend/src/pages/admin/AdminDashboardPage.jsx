import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import Icon from '../../components/Icon'
import { adminStatsApi } from '../../api/adminStats'
import { CATEGORY_BADGES, ROLE_LABELS } from '../../constants/labels'

function StatCard({ label, value, sublabel, accent = 'forest' }) {
  const accents = {
    forest: 'from-forest-500 to-forest-700 text-white',
    blue: 'from-blue-500 to-blue-700 text-white',
    amber: 'from-amber-500 to-amber-600 text-white',
    purple: 'from-purple-500 to-purple-700 text-white',
  }
  return (
    <div className={`bg-gradient-to-br ${accents[accent] || accents.forest} rounded-xl shadow-sm p-5`}>
      <div className="text-xs uppercase tracking-wider opacity-80 mb-1">{label}</div>
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      {sublabel && <div className="text-xs opacity-80 mt-1">{sublabel}</div>}
    </div>
  )
}

export default function AdminDashboardPage() {
  const [overview, setOverview] = useState(null)
  const [topCourses, setTopCourses] = useState([])
  const [topDepartments, setTopDepartments] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      adminStatsApi.overview(),
      adminStatsApi.topCourses(10),
      adminStatsApi.topDepartments(10),
      adminStatsApi.recentEnrollments(20),
    ])
      .then(([o, c, d, r]) => {
        setOverview(o)
        setTopCourses(c)
        setTopDepartments(d)
        setRecent(r)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-8 text-center text-gray-500">กำลังโหลด...</div>
      </AdminLayout>
    )
  }

  const maxCourseEnroll = Math.max(1, ...topCourses.map(c => c.enrolled_count))
  const maxDeptEnroll = Math.max(1, ...topDepartments.map(d => d.enrolled_count))

  return (
    <AdminLayout>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">แดชบอร์ดผู้ดูแลระบบ</h1>
          <p className="text-sm text-gray-500 mt-1">ภาพรวมการใช้งานระบบ e-Learning</p>
        </div>

        {/* Stat cards */}
        {overview && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <StatCard label="ผู้ใช้ทั้งหมด" value={overview.total_users} sublabel={`ใช้งานอยู่ ${overview.active_users} คน`} accent="blue" />
            <StatCard label="หลักสูตรทั้งหมด" value={overview.total_courses} sublabel={`เผยแพร่ ${overview.published_courses} หลักสูตร`} accent="forest" />
            <StatCard label="การลงทะเบียน" value={overview.total_enrollments} sublabel={`จบหลักสูตร ${overview.completed_enrollments} ครั้ง`} accent="amber" />
            <StatCard label="อัตราการเรียนจบ" value={`${overview.completion_rate}%`} sublabel="ของผู้ลงทะเบียน" accent="purple" />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Top courses */}
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
            <h2 className="font-bold text-gray-800 mb-4">หลักสูตรยอดนิยม</h2>
            {topCourses.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {topCourses.map(c => {
                  const cat = CATEGORY_BADGES[c.category] || { label: c.category, color: 'bg-gray-100' }
                  const pct = (c.enrolled_count / maxCourseEnroll) * 100
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between text-sm mb-1 gap-3">
                        <Link to={`/admin/courses/${c.id}/edit`} className="font-medium text-gray-800 hover:text-forest-700 truncate">
                          {c.title}
                        </Link>
                        <span className="text-gray-500 tabular-nums flex-shrink-0">{c.enrolled_count} คน</span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-forest-500 to-forest-700 h-2 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="mt-1">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${cat.color}`}>
                          {cat.label}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top departments */}
          <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
            <h2 className="font-bold text-gray-800 mb-4">หน่วยงานที่ลงทะเบียนมากที่สุด</h2>
            {topDepartments.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
            ) : (
              <div className="space-y-3">
                {topDepartments.map(d => {
                  const pct = (d.enrolled_count / maxDeptEnroll) * 100
                  return (
                    <div key={d.department}>
                      <div className="flex items-center justify-between text-sm mb-1 gap-3">
                        <span className="font-medium text-gray-800 truncate">{d.department}</span>
                        <span className="text-gray-500 tabular-nums flex-shrink-0">
                          {d.enrolled_count} ครั้ง · {d.user_count} คน
                        </span>
                      </div>
                      <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-blue-700 h-2 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Recent enrollments */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6 mt-4 sm:mt-6">
          <h2 className="font-bold text-gray-800 mb-4">การลงทะเบียนล่าสุด</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">ยังไม่มีข้อมูล</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wider border-b border-gray-200">
                    <th className="py-2 pr-3">ผู้เรียน</th>
                    <th className="py-2 pr-3">หน่วยงาน</th>
                    <th className="py-2 pr-3">บทบาท</th>
                    <th className="py-2 pr-3">หลักสูตร</th>
                    <th className="py-2 pr-3 whitespace-nowrap">วันที่</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recent.map(r => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-medium text-gray-800">{r.user.full_name}</td>
                      <td className="py-2 pr-3 text-gray-600">{r.user.department || '-'}</td>
                      <td className="py-2 pr-3 text-gray-600">{ROLE_LABELS[r.user.role] || r.user.role}</td>
                      <td className="py-2 pr-3">
                        <Link to={`/admin/courses/${r.course.id}/edit`} className="text-forest-700 hover:underline">
                          {r.course.title}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">
                        {r.enrolled_at ? new Date(r.enrolled_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}
