import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { coursesApi } from '../api/courses'
import { CATEGORY_BADGES } from '../constants/labels'
import { mediaUrl } from '../utils/media'
import Icon from './Icon'

export default function MyCourses() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    coursesApi.myEnrollments()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm p-6 text-center text-gray-500">กำลังโหลด...</div>
  }

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-6 text-center">
        <Icon name="book" className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 mb-3">คุณยังไม่ได้ลงทะเบียนหลักสูตรใด</p>
        <Link
          to="/courses"
          className="inline-block bg-forest-500 hover:bg-forest-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          ไปดูหลักสูตรทั้งหมด →
        </Link>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map(e => {
        const cat = CATEGORY_BADGES[e.category] || { label: e.category, color: 'bg-gray-100' }
        return (
          <Link
            key={e.course_id}
            to={`/courses/${e.course_id}/learn`}
            className="bg-white rounded-xl shadow-sm hover:shadow-md transition overflow-hidden border border-gray-100 block"
          >
            <div className="aspect-video bg-gradient-to-br from-forest-100 to-forest-200 relative overflow-hidden">
              {e.cover_image ? (
                <img
                  src={mediaUrl(e.cover_image)}
                  alt={e.title}
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Icon name="tree" className="w-12 h-12 text-forest-500 opacity-40" />
                </div>
              )}
              {e.progress_percent === 100 && (
                <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full font-medium inline-flex items-center gap-1">
                  <Icon name="check" className="w-3 h-3" /> เสร็จสิ้น
                </span>
              )}
            </div>

            <div className="p-4">
              <div className="flex flex-wrap gap-1 mb-2">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cat.color}`}>
                  {cat.label}
                </span>
                {e.is_mandatory && (
                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded">บังคับ</span>
                )}
              </div>

              <h3 className="font-bold text-gray-800 line-clamp-2 mb-2 text-sm">{e.title}</h3>

              {/* Progress bar */}
              <div className="mb-1.5">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-500">{e.completed_lessons}/{e.total_lessons} บทเรียน</span>
                  <span className="font-medium text-forest-700 tabular-nums">{e.progress_percent}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-forest-500 to-forest-700 h-1.5 transition-all"
                    style={{ width: `${e.progress_percent}%` }}
                  />
                </div>
              </div>

              {e.last_accessed_at && (
                <p className="text-xs text-gray-400 mt-2">
                  เรียนล่าสุด: {new Date(e.last_accessed_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}
            </div>
          </Link>
        )
      })}
    </div>
  )
}
