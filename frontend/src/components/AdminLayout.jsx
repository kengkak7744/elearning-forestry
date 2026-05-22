import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function AdminLayout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const menuItems = [
    { path: '/admin/users', label: 'จัดการผู้ใช้', icon: 'U' },
    { path: '/admin/courses', label: 'จัดการหลักสูตร', icon: 'C' },
    { path: '/admin/reports', label: 'รายงาน', icon: 'R' },
  ]

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0
          fixed inset-y-0 left-0 z-30 transform transition-transform duration-200
          lg:relative lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Logo + Close button on mobile */}
        <div className="p-4 sm:p-6 border-b border-gray-200 flex items-center justify-between">
          <Link to="/" className="text-xs sm:text-sm text-gray-600 hover:text-forest-600 font-medium">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-forest-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-lg">
                  <img src="/forest_logo.png" alt="Logo" className="w-8 h-8" />
                </span>
              </div>
              <div>
                <div className="font-bold text-forest-700 text-sm">e-Learning</div>
                <div className="text-xs text-gray-500">กรมป่าไม้</div>
              </div>
            </div>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* User info */}
        <div className="px-4 sm:px-6 py-4 border-b border-gray-200">
          <div className="text-xs text-gray-500 mb-1">เข้าสู่ระบบในฐานะ</div>
          <div className="font-medium text-gray-800 text-sm truncate">{user?.full_name}</div>
          <div className="text-xs text-forest-600">ผู้ดูแลระบบ</div>
        </div>

        {/* Menu */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {menuItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition ${
                  isActive
                    ? 'bg-forest-50 text-forest-700 font-medium'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs font-bold">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-gray-200">
          <Link
            to="/"
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
          >
            <span>หน้าหลัก</span>
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-600 hover:bg-gray-50 text-sm"
          >
            <span>ออกจากระบบ</span>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <div className="lg:hidden bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3 sticky top-0 z-10">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-800"
            aria-label="เปิดเมนู"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-forest-700">จัดการระบบ</span>
        </div>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  )
}