import { useState, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { usersApi } from '../../api/users'
import AdminLayout from '../../components/AdminLayout'

export default function UserFormPage() {
  const { id } = useParams()
  const isEdit = !!id
  const navigate = useNavigate()

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role: 'learner',
    department: '',
    position: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // โหลดข้อมูลเดิมถ้าเป็นโหมดแก้ไข
  useEffect(() => {
    if (isEdit) {
      const load = async () => {
        try {
          const data = await usersApi.getById(id)
          setFormData({
            employee_id: data.employee_id,
            email: data.email,
            full_name: data.full_name,
            password: '', // ไม่โชว์รหัสเดิม
            role: data.role,
            department: data.department || '',
            position: data.position || '',
          })
        } catch (err) {
          setError('ไม่พบข้อมูลผู้ใช้')
        }
      }
      load()
    }
  }, [id, isEdit])

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (isEdit) {
        // แก้ไข — ไม่ส่ง employee_id และ password
        const { employee_id, password, ...updateData } = formData
        await usersApi.update(id, updateData)
      } else {
        // สร้างใหม่
        await usersApi.create(formData)
      }
      navigate('/admin/users')
    } catch (err) {
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-3xl mx-auto">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-500 mb-4">
          <Link to="/admin/users" className="hover:text-forest-600">จัดการผู้ใช้</Link>
          <span className="mx-2">/</span>
          <span>{isEdit ? 'แก้ไขผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-6">
          {isEdit ? 'แก้ไขข้อมูลผู้ใช้' : 'เพิ่มผู้ใช้ใหม่'}
        </h1>

        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-8 space-y-5">
          {/* username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              disabled={isEdit}
              minLength={3}
              maxLength={20}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none disabled:bg-gray-100"
              placeholder="เช่น EMP001"
            />
            {isEdit && (
              <p className="text-xs text-gray-500 mt-1">username ไม่สามารถแก้ไขได้</p>
            )}
          </div>

          {/* ชื่อ-นามสกุล */}
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
              placeholder="เช่น นายสมชาย ใจดี"
            />
          </div>

          {/* อีเมล */}
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
              placeholder="somchai@forest.go.th"
            />
          </div>

          {/* รหัสผ่าน — เฉพาะตอนสร้างใหม่ */}
          {!isEdit && (
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
              <p className="text-xs text-gray-500 mt-1">
                ผู้ใช้สามารถเปลี่ยนรหัสผ่านได้หลัง login ครั้งแรก
              </p>
            </div>
          )}

          {/* บทบาท */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              บทบาท <span className="text-red-500">*</span>
            </label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
            >
              <option value="learner">เจ้าหน้าที่ผู้เรียน</option>
              <option value="manager">หัวหน้างาน</option>
              <option value="instructor">วิทยากร</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </div>

          {/* หน่วยงาน */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              หน่วยงาน
            </label>
            <input
              type="text"
              name="department"
              value={formData.department}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              placeholder="เช่น สำนักจัดการป่าไม้ภาคที่ 1"
            />
          </div>

          {/* ตำแหน่ง */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ตำแหน่ง
            </label>
            <input
              type="text"
              name="position"
              value={formData.position}
              onChange={handleChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              placeholder="เช่น เจ้าพนักงานป่าไม้"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={loading}
              className="bg-forest-500 hover:bg-forest-600 text-white px-6 py-2.5 rounded-lg font-medium transition disabled:opacity-50"
            >
              {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'สร้างผู้ใช้'}
            </button>
            <Link
              to="/admin/users"
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-6 py-2.5 rounded-lg font-medium transition"
            >
              ยกเลิก
            </Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  )
}