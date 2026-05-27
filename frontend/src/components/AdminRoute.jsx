import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from './Icon'

export default function AdminRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-forest-600">กำลังโหลด...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-xl shadow p-8 text-center max-w-md">
          <Icon name="ban" className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">ไม่มีสิทธิ์เข้าถึง</h1>
          <p className="text-gray-600 mb-4">หน้านี้สำหรับผู้ดูแลระบบเท่านั้น</p>
          <Navigate to="/" replace />
        </div>
      </div>
    )
  }

  return children
}