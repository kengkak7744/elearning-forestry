import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import ProfilePage from './pages/ProfilePage'
import UsersListPage from './pages/admin/UsersListPage'
import UserFormPage from './pages/admin/UserFormPage'
import CoursesPage from './pages/CoursesPage'
import CourseDetailPage from './pages/CourseDetailPage'

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
      {/* On if deploying to a subdirectory */}
      {/* <BrowserRouter basename="/elearning"> */}
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          
          {/* User pages */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route 
            path="/courses" 
            element={
              <ProtectedRoute>
              <CoursesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/courses/:id"
            element={
              <ProtectedRoute>
                <CourseDetailPage />
              </ProtectedRoute>
            }
          />

          {/* Admin pages */}
          <Route path="/admin/users" element={<AdminRoute><UsersListPage /></AdminRoute>} />
          <Route path="/admin/users/new" element={<AdminRoute><UserFormPage /></AdminRoute>} />
          <Route path="/admin/users/:id/edit" element={<AdminRoute><UserFormPage /></AdminRoute>} />
          
          <Route path="/admin" element={<Navigate to="/admin/users" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App