import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    department: '',
    position: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // ตรวจรหัสผ่านตรงกันที่ฝั่ง client ก่อน
    if (formData.password !== formData.confirm_password) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    setLoading(true)
    try {
      // ส่งข้อมูลที่ไม่ว่างเท่านั้น
      const payload = { ...formData }
      if (!payload.department) delete payload.department
      if (!payload.position) delete payload.position

      await authApi.register(payload)

      // สมัครเสร็จ login ให้อัตโนมัติ
      await login(formData.email, formData.password)
      navigate('/', { replace: true })
    } catch (err) {
      const message = err.response?.data?.detail || 'สมัครสมาชิกไม่สำเร็จ'
      setError(typeof message === 'string' ? message : 'ข้อมูลไม่ถูกต้อง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-forest-100 flex items-center justify-center p-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-forest-500 rounded-full mb-3 text-2xl">
            🌳
          </div>
          <h1 className="text-2xl font-bold text-forest-700">สมัครสมาชิก</h1>
          <p className="text-gray-600 text-sm mt-1">สำหรับบุคคลทั่วไป</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อ-นามสกุล <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleChange}
              required
              minLength={2}
              maxLength={150}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              placeholder="นายสมชาย ใจดี"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              อีเมล <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              placeholder="user@email.com"
            />
            <p className="text-xs text-gray-500 mt-1">ใช้สำหรับเข้าสู่ระบบ</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              รหัสผ่าน <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              placeholder="อย่างน้อย 6 ตัวอักษร"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ยืนยันรหัสผ่าน <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="confirm_password"
              value={formData.confirm_password}
              onChange={handleChange}
              required
              minLength={6}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              placeholder="พิมพ์รหัสผ่านอีกครั้ง"
            />
          </div>

          <div className="border-t border-gray-200 pt-4">
            <p className="text-xs text-gray-500 mb-3">ข้อมูลเพิ่มเติม (ไม่บังคับ)</p>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หน่วยงาน/องค์กร
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  placeholder="เช่น มหาวิทยาลัย หรือ บริษัท"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  อาชีพ/ตำแหน่ง
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  placeholder="เช่น นักศึกษา หรือ นักวิจัย"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-forest-500 hover:bg-forest-600 text-white font-medium py-2.5 rounded-lg transition disabled:opacity-50"
          >
            {loading ? 'กำลังสมัคร...' : 'สมัครสมาชิก'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            มีบัญชีแล้ว?{' '}
            <Link to="/login" className="text-forest-600 hover:text-forest-700 font-medium">
              เข้าสู่ระบบ
            </Link>
          </p>
          <p className="text-xs text-gray-500 mt-3">
            ⚠️ บุคคลทั่วไปจะเห็นเฉพาะหลักสูตรที่เปิดสาธารณะ
          </p>
        </div>
      </div>
    </div>
  )
}