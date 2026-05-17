import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const menuItems = [
    { path: '/admin/users', label: 'จัดการผู้ใช้', icon: '👥' },
    { path: '/admin/courses', label: 'จัดการหลักสูตร', icon: '📚' },
    { path: '/admin/reports', label: 'รายงาน', icon: '📊' },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-forest-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-lg">🌳</span>
            </div>
            <div>
              <div className="font-bold text-forest-700 text-sm">e-Learning</div>
              <div className="text-xs text-gray-500">กรมป่าไม้</div>
            </div>
          </div>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="text-xs text-gray-500 mb-1">เข้าสู่ระบบในฐานะ</div>
          <div className="font-medium text-gray-800 text-sm">{user?.full_name}</div>
          <div className="text-xs text-forest-600">ผู้ดูแลระบบ</div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition ${
                  isActive
                    ? 'bg-forest-50 text-forest-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Bottom actions */}
        <div className="p-3 border-t border-gray-200">
          <Link
            to="/"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
          >
            <span>🏠</span>
            <span>หน้าหลัก</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
          >
            <span>🚪</span>
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}