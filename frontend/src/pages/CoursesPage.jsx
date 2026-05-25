import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { coursesApi } from '../api/courses'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'

const categoryLabels = {
  compliance: { label: 'บังคับตามกฎหมาย', color: 'bg-red-100 text-red-700' },
  technical: { label: 'วิชาชีพ', color: 'bg-blue-100 text-blue-700' },
  safety: { label: 'ความปลอดภัย', color: 'bg-amber-100 text-amber-700' },
  skill: { label: 'ทักษะทั่วไป', color: 'bg-purple-100 text-purple-700' },
}

const categoryIcons = {
  compliance: '',
  technical: '',
  safety: '',
  skill: '',
}

export default function CoursesPage() {
  const { user, logout } = useAuth()
  const [courses, setCourses] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [mandatoryOnly, setMandatoryOnly] = useState(false)

  const loadCourses = async () => {
    setLoading(true)
    try {
      const params = {}
      if (search) params.search = search
      if (categoryFilter) params.category = categoryFilter
      if (mandatoryOnly) params.is_mandatory = true
      
      const data = await coursesApi.list(params)
      setCourses(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCourses()
    // eslint-disable-next-line
  }, [categoryFilter, mandatoryOnly])

  useEffect(() => {
    const timer = setTimeout(() => loadCourses(), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line
  }, [search])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <Link to="/" className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 font-medium">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <span className="text-xl sm:text-2xl flex-shrink-0">
                <img src="/elearning/forest_logo.png" alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10" />
              </span>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-lg font-bold text-forest-700 truncate">ระบบ e-Learning</h1>
                <p className="text-xs text-gray-500 hidden sm:block">กรมป่าไม้</p>
              </div>
            </div>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <Link to="/" className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 font-medium">
              <span className="hidden sm:inline">หน้าหลัก</span>
              <Icon name="home" className="w-5 h-5 sm:hidden" />
            </Link>
            <Link to="/profile" className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 font-medium">
              <span className="hidden sm:inline">โปรไฟล์</span>
              <Icon name="user" className="w-5 h-5 sm:hidden" />
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin/users" className="text-xs sm:text-sm text-forest-600 font-medium">
                <span className="hidden sm:inline">จัดการระบบ</span>
                <Icon name="settings" className="w-5 h-5 sm:hidden" />
              </Link>
            )}
            <button onClick={logout} className="text-xs sm:text-sm text-gray-600">
              <span className="hidden sm:inline">ออกจากระบบ</span>
              <Icon name="logout" className="w-5 h-5 sm:hidden" />
            </button>
          </div>
        </div>
      </header>

      {/* Page header */}
      <div className="bg-gradient-to-br from-forest-500 to-forest-700 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <h2 className="text-2xl sm:text-3xl font-bold mb-2">หลักสูตรทั้งหมด</h2>
          <p className="text-sm sm:text-base text-forest-50">
            สวัสดี {user?.full_name} เริ่มต้นเรียนรู้กับหลักสูตรของกรมป่าไม้
          </p>
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4 sm:mb-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="ค้นหาหลักสูตร..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
            />
            
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
            >
              <option value="">ทุกหมวดหมู่</option>
              <option value="compliance">บังคับตามกฎหมาย</option>
              <option value="technical">วิชาชีพ</option>
              <option value="safety">ความปลอดภัย</option>
              <option value="skill">ทักษะทั่วไป</option>
            </select>
            
            <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={mandatoryOnly}
                onChange={(e) => setMandatoryOnly(e.target.checked)}
                className="w-4 h-4 text-forest-500 rounded"
              />
              <span className="text-sm text-gray-700 whitespace-nowrap">เฉพาะหลักสูตรบังคับ</span>
            </label>
          </div>
        </div>

        {/* Course list */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">กำลังโหลด...</div>
        ) : courses.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl shadow-sm">
            <Icon name="book" className="w-16 h-16 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">ไม่พบหลักสูตร</p>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-600">
              พบ {courses.length} หลักสูตร
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {courses.map((course) => {
                const cat = categoryLabels[course.category] || { label: course.category, color: 'bg-gray-100' }
                const icon = categoryIcons[course.category] || 'รูป'
                
                return (
                  <Link
                    key={course.id}
                    to={`/courses/${course.id}`}
                    className="bg-white rounded-xl shadow-sm hover:shadow-lg transition overflow-hidden border border-gray-100"
                  >
                    {/* Cover */}
                    <div className="h-32 bg-gradient-to-br from-forest-100 to-forest-200 flex items-center justify-center relative">
                      <span className="text-5xl">{icon}</span>
                      
                      {/* Badges */}
                      <div className="absolute top-3 left-3 flex gap-1">
                        {course.is_mandatory && (
                          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded-full font-medium">
                            บังคับ
                          </span>
                        )}
                        {!course.is_published && (
                          <span className="bg-gray-700 text-white text-xs px-2 py-1 rounded-full font-medium">
                            ฉบับร่าง
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Content */}
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${cat.color}`}>
                          {cat.label}
                        </span>
                      </div>
                      
                      <h3 className="font-bold text-gray-800 mb-2 line-clamp-2">
                        {course.title}
                      </h3>
                      
                      {course.description && (
                        <p className="text-sm text-gray-600 break-words line-clamp-3 mb-3">
                          {course.description}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                        <span className="text-xs text-gray-500">
                          {course.estimated_hours ? `เวลาที่ใช้ในการเรียน: ${course.estimated_hours} ชั่วโมง` : ''}
                        </span>
                        <span className="text-sm text-forest-600 font-medium">
                          เริ่มเรียน →
                        </span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}