import { useAuth } from '../contexts/AuthContext'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  const { user, logout } = useAuth()

  const roleLabels = {
    learner: 'เจ้าหน้าที่ผู้เรียน',
    manager: 'หัวหน้างาน',
    instructor: 'วิทยากร',
    admin: 'ผู้ดูแลระบบ',
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-forest-700">ระบบ e-Learning กรมป่าไม้</h1>
          <div className="flex items-center gap-4">
            <Link to="/profile" className="text-sm text-gray-600 hover:text-forest-600 font-medium">
              👤 โปรไฟล์
            </Link>
            {user?.role === 'admin' && (
              <Link to="/admin/users" className="text-sm text-forest-600 hover:text-forest-700 font-medium">
                ⚙️ จัดการระบบ
              </Link>
            )}
            <button onClick={logout} className="text-sm text-gray-600 hover:text-forest-600 transition">
              ออกจากระบบ
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            สวัสดี, {user?.full_name}
          </h2>
          <p className="text-gray-600 mb-6">
            ยินดีต้อนรับเข้าสู่ระบบ e-Learning ของกรมป่าไม้
          </p>

          {/* User info card */}
          <div className="bg-forest-50 rounded-lg p-6 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">
                เลขประจำตัว
              </div>
              <div className="font-medium">{user?.employee_id}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">
                บทบาท
              </div>
              <div className="font-medium">{roleLabels[user?.role]}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">
                อีเมล
              </div>
              <div className="font-medium">{user?.email}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">
                หน่วยงาน
              </div>
              <div className="font-medium">{user?.department || '-'}</div>
            </div>
          </div>

          {/* Status */}
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-700">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              <span className="font-medium">เชื่อมต่อกับ Backend สำเร็จ!</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}