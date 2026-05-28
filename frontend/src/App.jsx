import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import ErrorBoundary from './components/ErrorBoundary'

// Login/Register are small and accessed first — keep eager.
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'

// Heavier pages are lazy-loaded.
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const CoursesPage = lazy(() => import('./pages/CoursesPage'))
const CourseDetailPage = lazy(() => import('./pages/CourseDetailPage'))
const CourseViewerPage = lazy(() => import('./pages/CourseViewerPage'))
const UsersListPage = lazy(() => import('./pages/admin/UsersListPage'))
const UserFormPage = lazy(() => import('./pages/admin/UserFormPage'))
const CoursesListPage = lazy(() => import('./pages/admin/CoursesListPage'))
const CourseEditPage = lazy(() => import('./pages/admin/CourseEditPage'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-gray-500 text-sm">
      กำลังโหลด...
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
    <AuthProvider>
      <BrowserRouter>
      {/* On if deploying to a subdirectory */}
      {/* <BrowserRouter basename="/elearning"> */}
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            {/* User pages */}
            <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/courses" element={<ProtectedRoute><CoursesPage /></ProtectedRoute>} />
            <Route path="/courses/:id" element={<ProtectedRoute><CourseDetailPage /></ProtectedRoute>} />
            <Route path="/courses/:id/learn" element={<ProtectedRoute><CourseViewerPage /></ProtectedRoute>} />
            <Route path="/courses/:id/learn/:lessonId" element={<ProtectedRoute><CourseViewerPage /></ProtectedRoute>} />

            {/* Admin pages */}
            <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboardPage /></AdminRoute>} />
            <Route path="/admin/courses" element={<AdminRoute><CoursesListPage /></AdminRoute>} />
            <Route path="/admin/courses/:id/edit" element={<AdminRoute><CourseEditPage /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><UsersListPage /></AdminRoute>} />
            <Route path="/admin/users/new" element={<AdminRoute><UserFormPage /></AdminRoute>} />
            <Route path="/admin/users/:id/edit" element={<AdminRoute><UserFormPage /></AdminRoute>} />

            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
