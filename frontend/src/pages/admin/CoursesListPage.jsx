import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../../components/AdminLayout'
import { coursesApi } from '../../api/courses'

const categoryLabels = {
  compliance: { label: 'บังคับตามกฎหมาย', color: 'bg-red-100 text-red-700' },
  technical: { label: 'วิชาชีพ', color: 'bg-blue-100 text-blue-700' },
  safety: { label: 'ความปลอดภัย', color: 'bg-amber-100 text-amber-700' },
  skill: { label: 'ทักษะทั่วไป', color: 'bg-purple-100 text-purple-700' },
}

export default function CoursesListPage() {
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const data = await coursesApi.list({ search })
      setCourses(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const t = setTimeout(load, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line
  }, [search])

  const handleDelete = async (course) => {
    if (!confirm(`ลบหลักสูตร "${course.title}" และข้อมูลทั้งหมด?`)) return
    try {
      await coursesApi.delete(course.id)
      load()
    } catch (err) {
      alert(err.response?.data?.detail || 'ลบไม่สำเร็จ')
    }
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800">จัดการหลักสูตร</h1>
            <p className="text-gray-500 text-sm mt-1">รายการหลักสูตรทั้งหมด</p>
          </div>
          <Link
            to="/admin/courses/new/edit"
            className="bg-forest-500 hover:bg-forest-600 text-white px-4 py-2 rounded-lg font-medium transition w-full sm:w-auto text-center"
          >
            + สร้างหลักสูตรใหม่
          </Link>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <input
            type="text"
            placeholder="ค้นหาหลักสูตร..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
          />
        </div>

        {loading ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">กำลังโหลด...</div>
        ) : courses.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center text-gray-500">ไม่พบหลักสูตร</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map(c => {
              const cat = categoryLabels[c.category] || { label: c.category, color: 'bg-gray-100' }
              return (
                <div key={c.id} className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-start gap-2 mb-3">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${cat.color}`}>
                      {cat.label}
                    </span>
                    {c.is_mandatory && (
                      <span className="bg-red-500 text-white text-xs px-2 py-1 rounded">บังคับ</span>
                    )}
                    {!c.is_published && (
                      <span className="bg-gray-700 text-white text-xs px-2 py-1 rounded">ฉบับร่าง</span>
                    )}
                  </div>

                  <h3 className="font-bold text-gray-800 mb-2 line-clamp-2 h-12">{c.title}</h3>

                  {c.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3 h-10 break-words">{c.description}</p>
                  )}

                  <div className="text-xs text-gray-500 mb-3">
                    {c.instructor_name && <div>วิทยากร: {c.instructor_name}</div>}
                    {c.estimated_hours && <div>{c.estimated_hours} ชั่วโมง</div>}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-gray-100">
                    <Link
                      to={`/admin/courses/${c.id}/edit`}
                      className="flex-1 text-center py-2 bg-forest-50 text-forest-700 rounded text-sm font-medium"
                    >
                      แก้ไข
                    </Link>
                    <button
                      onClick={() => handleDelete(c)}
                      className="px-4 py-2 bg-red-50 text-red-700 rounded text-sm font-medium"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}