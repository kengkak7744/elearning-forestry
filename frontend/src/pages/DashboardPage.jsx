import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Welcome card */}
        <div className="bg-white rounded-xl shadow-sm p-8 mb-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            สวัสดี, {user?.full_name}
          </h2>
          <p className="text-gray-600 mb-6">
            ยินดีต้อนรับเข้าสู่ระบบ e-Learning ของกรมป่าไม้
          </p>

          <div className="bg-forest-50 rounded-lg p-6 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">Username</div>
              <div className="font-medium">{user?.username}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">บทบาท</div>
              <div className="font-medium">{roleLabels[user?.role]}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">อีเมล</div>
              <div className="font-medium">{user?.email}</div>
            </div>
            <div>
              <div className="text-xs text-forest-700 uppercase tracking-wider mb-1">หน่วยงาน</div>
              <div className="font-medium">{user?.department || '-'}</div>
            </div>
          </div>
        </div>

        {/* Action cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Link
            to="/courses"
            className="bg-gradient-to-br from-forest-500 to-forest-700 rounded-xl shadow-md p-8 text-white hover:shadow-xl transition transform hover:-translate-y-1"
          >
            <div className="text-5xl mb-4">📚</div>
            <h3 className="text-xl font-bold mb-2">หลักสูตรทั้งหมด</h3>
            <p className="text-forest-50 text-sm">
              เริ่มต้นเรียนรู้กับหลักสูตรของกรมป่าไม้
            </p>
            <div className="mt-4 text-sm font-medium">
              ดูหลักสูตร →
            </div>
          </Link>

          <div className="bg-white rounded-xl shadow-sm p-8 border-2 border-dashed border-gray-200">
            <div className="text-5xl mb-4 opacity-50">🎓</div>
            <h3 className="text-xl font-bold text-gray-400 mb-2">ใบรับรองของฉัน</h3>
            <p className="text-gray-400 text-sm">
              ใบรับรองที่ได้รับจากการเรียนจบหลักสูตร
            </p>
            <div className="mt-4 text-sm text-gray-400">
              (test)
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}