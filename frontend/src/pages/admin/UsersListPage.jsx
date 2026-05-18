import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { usersApi } from '../../api/users'
import AdminLayout from '../../components/AdminLayout'

const roleLabels = {
  learner: { label: 'เจ้าหน้าที่ผู้เรียน', color: 'bg-blue-100 text-blue-700' },
  manager: { label: 'หัวหน้างาน', color: 'bg-purple-100 text-purple-700' },
  instructor: { label: 'วิทยากร', color: 'bg-amber-100 text-amber-700' },
  admin: { label: 'ผู้ดูแลระบบ', color: 'bg-forest-100 text-forest-700' },
}

export default function UsersListPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await usersApi.list({ search, role: roleFilter || undefined })
      setUsers(data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
    // eslint-disable-next-line
  }, [roleFilter])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => loadUsers(), 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line
  }, [search])

  const handleDeactivate = async (userId, name) => {
    if (!confirm(`ต้องการระงับบัญชี ${name} ใช่หรือไม่?`)) return
    try {
      await usersApi.deactivate(userId)
      loadUsers()
    } catch (err) {
      alert(err.response?.data?.detail || 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <AdminLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">จัดการผู้ใช้</h1>
            <p className="text-gray-500 text-sm mt-1">รายการเจ้าหน้าที่ทั้งหมดในระบบ</p>
          </div>
          <Link
            to="/admin/users/new"
            className="bg-forest-500 hover:bg-forest-600 text-white px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
          >
            <span>+</span>
            <span>เพิ่มผู้ใช้</span>
          </Link>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6 flex gap-3">
          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อ username หรืออีเมล..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-transparent outline-none"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
          >
            <option value="">ทุกบทบาท</option>
            <option value="public">บุคคลทั่วไป</option>
            <option value="learner">เจ้าหน้าที่ผู้เรียน</option>
            <option value="manager">หัวหน้างาน</option>
            <option value="instructor">วิทยากร</option>
            <option value="admin">ผู้ดูแลระบบ</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-500">กำลังโหลด...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-500">ไม่พบข้อมูล</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">username</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">อีเมล</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">บทบาท</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">หน่วยงาน</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {users.map((u) => {
                  const role = roleLabels[u.role] || { label: u.role, color: 'bg-gray-100' }
                  return (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-mono">{u.employee_id}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-800">{u.full_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.email}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${role.color}`}>
                          {role.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{u.department || '-'}</td>
                      <td className="px-6 py-4">
                        {u.is_active ? (
                          <span className="text-green-600 text-sm">● ใช้งาน</span>
                        ) : (
                          <span className="text-gray-400 text-sm">● ระงับ</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right text-sm">
                        <Link
                          to={`/admin/users/${u.id}/edit`}
                          className="text-forest-600 hover:text-forest-700 mr-3"
                        >
                          แก้ไข
                        </Link>
                        {u.is_active && (
                          <button
                            onClick={() => handleDeactivate(u.id, u.full_name)}
                            className="text-red-600 hover:text-red-700"
                          >
                            ระงับ
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Stats */}
        <div className="mt-4 text-sm text-gray-500">
          แสดง {users.length} รายการ
        </div>
      </div>
    </AdminLayout>
  )
}