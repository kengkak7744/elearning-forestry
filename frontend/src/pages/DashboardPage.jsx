import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'

export default function DashboardPage() {
  const { user, logout } = useAuth()

  const roleLabels = {
    learner: 'ผู้เรียน',
    manager: 'หัวหน้างาน',
    instructor: 'วิทยากร',
    admin: 'ผู้ดูแลระบบ',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span className="text-xl sm:text-2xl flex-shrink-0">
              <img src="/forest_logo.png" alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10" />
            </span>
            <div className="min-w-0">
              <h1 className="text-sm sm:text-lg font-bold text-forest-700 truncate">ระบบ e-Learning</h1>
              <p className="text-xs text-gray-500 hidden sm:block">กรมป่าไม้</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
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
            <button onClick={logout} className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 transition">
              <span className="hidden sm:inline">ออกจากระบบ</span>
              <Icon name="logout" className="w-5 h-5 sm:hidden" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8">
        {/* Welcome card */}
        <div className="bg-white rounded-xl shadow-sm p-5 sm:p-8 mb-4 sm:mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">
            สวัสดี, {user?.full_name}
          </h2>
          <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6">
            ยินดีต้อนรับเข้าสู่ระบบ e-Learning ของกรมป่าไม้
          </p>

          {/* User info — 1 col บนมือถือ 2 col บน tablet+ */}
          <div className="bg-forest-50 rounded-lg p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">Username</div>
              <div className="font-medium break-words">{user?.username}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">บทบาท</div>
              <div className="font-medium">{roleLabels[user?.role]}</div>
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

        {/* Action cards — stack บนมือถือ side-by-side บน tablet+ */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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

          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8 border-2 border-dashed border-gray-200">
            <Icon name="graduation" className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-50" />
            <h3 className="text-lg sm:text-xl font-bold text-gray-400 mb-2">ใบรับรองของฉัน</h3>
            <p className="text-gray-400 text-sm">
              ใบรับรองที่ได้รับจากการเรียนจบหลักสูตร
            </p>
            <div className="mt-3 sm:mt-4 text-sm text-gray-400">
              (เร็ว ๆ นี้)
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}