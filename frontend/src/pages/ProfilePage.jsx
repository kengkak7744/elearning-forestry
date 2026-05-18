import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../api/auth'

export default function ProfilePage() {
  const { user } = useAuth()
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  })
  const [message, setMessage] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(false)

  const roleLabels = {
    public: 'บุคคลทั่วไป',
    learner: 'เจ้าหน้าที่ผู้เรียน',
    manager: 'หัวหน้างาน',
    instructor: 'วิทยากร',
    admin: 'ผู้ดูแลระบบ',
  }

  const handleChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setMessage({ type: '', text: '' })

    if (passwordData.new_password !== passwordData.confirm_new_password) {
      setMessage({ type: 'error', text: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน' })
      return
    }

    if (passwordData.new_password.length < 6) {
      setMessage({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' })
      return
    }

    setLoading(true)
    try {
      await authApi.changePassword(passwordData.current_password, passwordData.new_password)
      setMessage({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_new_password: '',
      })
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'เกิดข้อผิดพลาด',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-forest-700">โปรไฟล์ของฉัน</h1>
          <Link to="/" className="text-sm text-forest-600 hover:text-forest-700 font-medium">
            ← กลับหน้าหลัก
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {/* ข้อมูลส่วนตัว */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">ข้อมูลส่วนตัว</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">ชื่อ-นามสกุล</div>
              <div className="font-medium">{user?.full_name}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">บทบาท</div>
              <div className="font-medium">{roleLabels[user?.role]}</div>
            </div>
            {user?.username && (
              <div>
                <div className="text-xs text-gray-500 uppercase mb-1">เลขประจำตัว</div>
                <div className="font-medium font-mono">{user?.username}</div>
              </div>
            )}
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">อีเมล</div>
              <div className="font-medium">{user?.email}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">หน่วยงาน</div>
              <div className="font-medium">{user?.department || '-'}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 uppercase mb-1">ตำแหน่ง</div>
              <div className="font-medium">{user?.position || '-'}</div>
            </div>
          </div>
        </div>

        {/* เปลี่ยนรหัสผ่าน */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">เปลี่ยนรหัสผ่าน</h2>
          
          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสผ่านปัจจุบัน
              </label>
              <input
                type="password"
                name="current_password"
                value={passwordData.current_password}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสผ่านใหม่
              </label>
              <input
                type="password"
                name="new_password"
                value={passwordData.new_password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                placeholder="อย่างน้อย 6 ตัวอักษร"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ยืนยันรหัสผ่านใหม่
              </label>
              <input
                type="password"
                name="confirm_new_password"
                value={passwordData.confirm_new_password}
                onChange={handleChange}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              />
            </div>

            {message.text && (
              <div className={`px-4 py-2 rounded-lg text-sm border ${
                message.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="bg-forest-500 hover:bg-forest-600 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}