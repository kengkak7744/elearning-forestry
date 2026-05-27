import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { authApi } from '../api/auth'
import Icon from '../components/Icon'
import LearnerHeader from '../components/LearnerHeader'
import MyCourses from '../components/MyCourses'
import { ROLE_LABELS } from '../constants/labels'

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  
  // โหมด edit/view
  const [isEditing, setIsEditing] = useState(false)
  const [profileMessage, setProfileMessage] = useState({ type: '', text: '' })
  const [profileLoading, setProfileLoading] = useState(false)
  
  // ฟอร์มแก้ไข profile
  const [profileForm, setProfileForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    department: user?.department || '',
    position: user?.position || '',
    responsibility: user?.responsibility || '',
    motivation: user?.motivation || '',
  })

  // ฟอร์มเปลี่ยนรหัสผ่าน
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_new_password: '',
  })
  const [passwordMessage, setPasswordMessage] = useState({ type: '', text: '' })
  const [passwordLoading, setPasswordLoading] = useState(false)

  const handleProfileChange = (e) => {
    setProfileForm({ ...profileForm, [e.target.name]: e.target.value })
  }

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value })
  }

  // เริ่มแก้ไข
  const startEdit = () => {
    setProfileForm({
      full_name: user?.full_name || '',
      phone: user?.phone || '',
      department: user?.department || '',
      position: user?.position || '',
      responsibility: user?.responsibility || '',
      motivation: user?.motivation || '',
    })
    setProfileMessage({ type: '', text: '' })
    setIsEditing(true)
  }

  // ยกเลิกแก้ไข
  const cancelEdit = () => {
    setIsEditing(false)
    setProfileMessage({ type: '', text: '' })
  }

  // บันทึก profile
  const handleProfileSubmit = async (e) => {
    e.preventDefault()
    setProfileMessage({ type: '', text: '' })
    setProfileLoading(true)

    try {
      const updated = await authApi.updateMe(profileForm)
      updateUser(updated)
      setProfileMessage({ type: 'success', text: 'บันทึกข้อมูลสำเร็จ' })
      setIsEditing(false)
    } catch (err) {
      const detail = err.response?.data?.detail
      if (Array.isArray(detail)) {
        const messages = detail.map(d => `${d.loc[1]}: ${d.msg}`).join(', ')
        setProfileMessage({ type: 'error', text: messages })
      } else {
        setProfileMessage({ type: 'error', text: detail || 'เกิดข้อผิดพลาด' })
      }
    } finally {
      setProfileLoading(false)
    }
  }

  // เปลี่ยนรหัสผ่าน
  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPasswordMessage({ type: '', text: '' })

    if (passwordData.new_password !== passwordData.confirm_new_password) {
      setPasswordMessage({ type: 'error', text: 'รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน' })
      return
    }

    if (passwordData.new_password.length < 6) {
      setPasswordMessage({ type: 'error', text: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' })
      return
    }

    setPasswordLoading(true)
    try {
      await authApi.changePassword(passwordData.current_password, passwordData.new_password)
      setPasswordMessage({ type: 'success', text: 'เปลี่ยนรหัสผ่านสำเร็จ' })
      setPasswordData({
        current_password: '',
        new_password: '',
        confirm_new_password: '',
      })
    } catch (err) {
      setPasswordMessage({
        type: 'error',
        text: err.response?.data?.detail || 'เกิดข้อผิดพลาด',
      })
    } finally {
      setPasswordLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <LearnerHeader />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 space-y-4 sm:space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-800">ข้อมูลส่วนตัว</h2>
            {!isEditing && (
              <button
                onClick={startEdit}
                className="bg-forest-500 hover:bg-forest-600 text-white px-4 py-2 rounded-lg font-medium text-sm transition w-full sm:w-auto"
              >
                แก้ไขข้อมูล
              </button>
            )}
          </div>

          {/* แสดงผลแบบ readonly */}
          {!isEditing && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">ชื่อผู้ใช้</div>
                  <div className="font-medium font-mono">{user?.username}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">บทบาท</div>
                  <div className="font-medium">{ROLE_LABELS[user?.role]}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">ชื่อ-นามสกุล</div>
                  <div className="font-medium">{user?.full_name}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">อีเมล</div>
                  <div className="font-medium">{user?.email}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">เบอร์โทรศัพท์</div>
                  <div className="font-medium">{user?.phone || '-'}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">หน่วยงาน</div>
                  <div className="font-medium">{user?.department || '-'}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-gray-500 uppercase mb-1">ตำแหน่ง</div>
                  <div className="font-medium">{user?.position || '-'}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-gray-500 uppercase mb-1">หน้าที่รับผิดชอบ</div>
                  <div className="font-medium whitespace-pre-wrap">{user?.responsibility || '-'}</div>
                </div>
                <div className="md:col-span-2">
                  <div className="text-xs text-gray-500 uppercase mb-1">เหตุผลในการเรียน</div>
                  <div className="font-medium whitespace-pre-wrap">{user?.motivation || '-'}</div>
                </div>
              </div>

              {profileMessage.text && profileMessage.type === 'success' && (
                <div className="flex items-center gap-2">
                  <Icon name="check" className="w-4 h-4 flex-shrink-0" />
                  <span>{profileMessage.text}</span>
                </div>
              )}
            </>
          )}

          {/* โหมดแก้ไข */}
          {isEditing && (
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              {/* Readonly fields */}
              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">ชื่อผู้ใช้ (แก้ไขไม่ได้)</div>
                  <div className="font-medium font-mono text-gray-600">{user?.username}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase mb-1">อีเมล (แก้ไขไม่ได้)</div>
                  <div className="font-medium text-gray-600">{user?.email}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ชื่อ-นามสกุล <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    value={profileForm.full_name}
                    onChange={handleProfileChange}
                    required
                    minLength={2}
                    maxLength={150}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เบอร์โทรศัพท์ <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={profileForm.phone}
                    onChange={handleProfileChange}
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
                    value={profileForm.department}
                    onChange={handleProfileChange}
                    required
                    minLength={2}
                    maxLength={150}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ตำแหน่ง <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="position"
                    value={profileForm.position}
                    onChange={handleProfileChange}
                    required
                    minLength={2}
                    maxLength={100}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    หน้าที่รับผิดชอบ <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="responsibility"
                    value={profileForm.responsibility}
                    onChange={handleProfileChange}
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {profileForm.responsibility.length}/1000 ตัวอักษร
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    เหตุผลในการเรียน <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="motivation"
                    value={profileForm.motivation}
                    onChange={handleProfileChange}
                    required
                    minLength={5}
                    maxLength={1000}
                    rows={3}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none resize-none"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {profileForm.motivation.length}/1000 ตัวอักษร
                  </p>
                </div>
              </div>

              {profileMessage.text && profileMessage.type === 'error' && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">
                  {profileMessage.text}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  type="submit"
                  disabled={profileLoading}
                  className="bg-forest-500 hover:bg-forest-600 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-50"
                >
                  {profileLoading ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-6 rounded-lg transition"
                >
                  ยกเลิก
                </button>
              </div>
            </form>
          )}
        </div>

        {/* my enrolled courses */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">หลักสูตรของฉัน</h2>
            <Link to="/courses" className="text-sm text-forest-600 hover:text-forest-700 font-medium">
              ดูคอร์สทั้งหมด →
            </Link>
          </div>
          <MyCourses />
        </div>

        {/* เปลี่ยนรหัสผ่าน */}
        <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">เปลี่ยนรหัสผ่าน</h2>
          
          <form onSubmit={handlePasswordSubmit} className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                รหัสผ่านปัจจุบัน
              </label>
              <input
                type="password"
                name="current_password"
                value={passwordData.current_password}
                onChange={handlePasswordChange}
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
                onChange={handlePasswordChange}
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
                onChange={handlePasswordChange}
                required
                minLength={6}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
              />
            </div>

            {passwordMessage.text && (
              <div className={`px-4 py-2 rounded-lg text-sm border ${
                passwordMessage.type === 'success'
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                {passwordMessage.text}
              </div>
            )}

            <button
              type="submit"
              disabled={passwordLoading}
              className="w-full sm:w-auto bg-forest-500 hover:bg-forest-600 text-white font-medium py-2 px-6 rounded-lg transition disabled:opacity-50"
            >
              {passwordLoading ? 'กำลังบันทึก...' : 'เปลี่ยนรหัสผ่าน'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}