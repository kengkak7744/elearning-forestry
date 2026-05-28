import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { certificatesApi } from '../api/certificates'
import Icon from '../components/Icon'
import LearnerHeader from '../components/LearnerHeader'
import { ROLE_LABELS } from '../constants/labels'

export default function DashboardPage() {
  const { user } = useAuth()
  const [certs, setCerts] = useState(null) // null = loading, [] = none
  const [certError, setCertError] = useState('')

  useEffect(() => {
    certificatesApi.mine()
      .then(setCerts)
      .catch((err) => {
        setCerts([])
        setCertError(err.response?.data?.detail || '')
      })
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <LearnerHeader />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Welcome card */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-8 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
            สวัสดี, {user?.full_name}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            ยินดีต้อนรับเข้าสู่ระบบ e-Learning ของกรมป่าไม้
          </p>

          <div className="bg-forest-50 rounded-lg p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">Username</div>
              <div className="font-medium break-words">{user?.username}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">บทบาท</div>
              <div className="font-medium">{ROLE_LABELS[user?.role]}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">อีเมล</div>
              <div className="font-medium break-words text-sm sm:text-base">{user?.email}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">หน่วยงาน</div>
              <div className="font-medium text-sm sm:text-base">{user?.department || '-'}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
          <Link
            to="/courses"
            className="bg-gradient-to-br from-forest-500 to-forest-700 rounded-xl shadow-md p-6 sm:p-8 text-white hover:shadow-xl transition transform hover:-translate-y-1"
          >
            <Icon name="book" className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4" />
            <h3 className="text-lg sm:text-xl font-bold mb-2">หลักสูตรทั้งหมด</h3>
            <p className="text-forest-50 text-sm">
              เริ่มต้นเรียนรู้กับหลักสูตรของกรมป่าไม้
            </p>
            <div className="mt-3 sm:mt-4 text-sm font-medium">
              ดูหลักสูตร →
            </div>
          </Link>

          <Link
            to="/profile"
            className="bg-white rounded-xl shadow-sm p-6 sm:p-8 hover:shadow-md transition border border-gray-100"
          >
            <Icon name="user" className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 text-forest-600" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-2">โปรไฟล์ของฉัน</h3>
            <p className="text-gray-600 text-sm">
              ดูหลักสูตรที่ลงทะเบียนและความคืบหน้า
            </p>
            <div className="mt-3 sm:mt-4 text-sm text-forest-600 font-medium">
              ไปที่โปรไฟล์ →
            </div>
          </Link>
        </div>

        {/* Certificates section */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Icon name="graduation" className="w-6 h-6 text-amber-600" />
              <h3 className="text-lg sm:text-xl font-bold text-gray-800">ใบรับรองของฉัน</h3>
            </div>
            {Array.isArray(certs) && certs.length > 0 && (
              <span className="text-sm text-gray-500">{certs.length} ใบ</span>
            )}
          </div>

          {certs === null ? (
            <p className="text-sm text-gray-500 text-center py-4">กำลังโหลด...</p>
          ) : certs.length === 0 ? (
            <div className="text-center py-6 text-sm text-gray-500">
              <Icon name="document" className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>ยังไม่มีใบรับรอง — เรียนจบหลักสูตรเพื่อรับใบรับรอง</p>
              {certError && <p className="text-xs text-red-500 mt-2">{certError}</p>}
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {certs.map((c) => (
                <li
                  key={c.id}
                  className="border border-amber-200 bg-amber-50 rounded-lg p-3 flex items-start gap-3"
                >
                  <Icon name="trophy" className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-800 text-sm break-words">
                      {c.course?.title}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      เลขที่ {c.certificate_number}
                      {c.final_score !== null && c.final_score !== undefined && (
                        <span className="ml-2">· คะแนน {Math.round(c.final_score)}%</span>
                      )}
                    </p>
                    {c.issued_at && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        ออกเมื่อ {new Date(c.issued_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  <a
                    href={certificatesApi.downloadUrl(c.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium px-3 py-1.5 rounded inline-flex items-center gap-1 flex-shrink-0"
                  >
                    <Icon name="document" className="w-3.5 h-3.5" />
                    ดาวน์โหลด
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  )
}
