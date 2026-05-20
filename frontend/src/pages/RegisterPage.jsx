import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { useAuth } from '../contexts/AuthContext'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    full_name: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    department: '',
    position: '',
    responsibility: '',
    motivation: '',
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

    if (formData.password !== formData.confirm_password) {
      setError('รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน')
      return
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(formData.username)) {
      setError('Username ใช้ได้เฉพาะตัวอักษรอังกฤษ ตัวเลข และ _ . - เท่านั้น')
      return
    }

    setLoading(true)
    try {
      await authApi.register(formData)
      await login(formData.username, formData.password)
      navigate('/', { replace: true })
    } catch (err) {
      const detail = err.response?.data?.detail
      // FastAPI validation error เป็น array ของ object
      if (Array.isArray(detail)) {
        const messages = detail.map(d => `${d.loc[1]}: ${d.msg}`).join(', ')
        setError(messages)
      } else if (typeof detail === 'string') {
        setError(detail)
      } else {
        setError('สมัครสมาชิกไม่สำเร็จ')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-forest-100 flex items-center justify-center p-4 py-8">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-forest-500 rounded-full mb-3 text-2xl">
            logo
          </div>
          <h1 className="text-2xl font-bold text-forest-700">สมัครสมาชิก</h1>
          <p className="text-gray-600 text-sm mt-1">สำหรับเจ้าหน้าที่กรมป่าไม้</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: ข้อมูลบัญชี */}
          <div>
            <h2 className="text-sm font-semibold text-forest-700 mb-3 pb-2 border-b border-gray-200">
              ข้อมูลบัญชี
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ชื่อผู้ใช้ (Username) <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  minLength={3}
                  maxLength={50}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  placeholder="เช่น suphadej.a (กรอกเบอร์โทรศัพท์ได้)"
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
                  placeholder="suphadej.a@forest.go.th"
                />
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
            </div>
          </div>

          {/* Section 2: ข้อมูลส่วนตัว */}
          <div>
            <h2 className="text-sm font-semibold text-forest-700 mb-3 pb-2 border-b border-gray-200">
              ข้อมูลส่วนตัว
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
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
                  placeholder="นายสุภเดช อนุพันธ์"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  minLength={9}
                  maxLength={20}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  placeholder="081-234-5678"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  หน่วยงาน/สังกัด <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="department"
                  value={formData.department}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={150}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  placeholder="สำนักจัดการป่าไม้ภาคที่ 1"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ตำแหน่ง <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="position"
                  value={formData.position}
                  onChange={handleChange}
                  required
                  minLength={2}
                  maxLength={100}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  placeholder="เจ้าพนักงานป่าไม้ปฏิบัติงาน"
                />
              </div>
            </div>
          </div>

          {/* Section 3: ข้อมูลการเรียน */}
          <div>            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  มีหน้าที่รับผิดชอบอะไร <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="responsibility"
                  value={formData.responsibility}
                  onChange={handleChange}
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none resize-none"
                  placeholder="เช่น ดูแลการสำรวจป่าในพื้นที่ จัดทำรายงานประจำเดือน..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.responsibility.length}/1000 ตัวอักษร
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  ทำไมจึงเข้ามาเรียน <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="motivation"
                  value={formData.motivation}
                  onChange={handleChange}
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none resize-none"
                  placeholder="เช่น ต้องการพัฒนาความรู้ด้านกฎหมายป่าไม้เพื่อใช้ในการปฏิบัติงาน..."
                />
                <p className="text-xs text-gray-500 mt-1">
                  {formData.motivation.length}/1000 ตัวอักษร
                </p>
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
            className="w-full bg-forest-500 hover:bg-forest-600 text-white font-medium py-3 rounded-lg transition disabled:opacity-50"
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
        </div>
      </div>
    </div>
  )
}