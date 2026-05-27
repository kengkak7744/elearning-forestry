import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from './Icon'

export default function LearnerHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0 hover:opacity-80 transition">
          <span className="text-xl sm:text-2xl flex-shrink-0">
            <img src="/elearning/forest_logo.png" alt="Logo" className="w-8 h-8 sm:w-10 sm:h-10" />
          </span>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-lg font-bold text-forest-700 truncate">ระบบ e-Learning</h1>
            <p className="text-xs text-gray-500 hidden sm:block">กรมป่าไม้</p>
          </div>
        </Link>

        <nav className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
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
          <button onClick={logout} className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 transition">
            <span className="hidden sm:inline">ออกจากระบบ</span>
            <Icon name="logout" className="w-5 h-5 sm:hidden" />
          </button>
        </nav>
      </div>
    </header>
  )
}
