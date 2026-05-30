import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'
import { LearnerShell, ViewerShell, AdminShell } from '@/components/layout/AppShell'

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
  // role=status + aria-live=polite announces the wait state to screen readers
  // without interrupting whatever's already being read.
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground"
    >
      กำลังโหลด...
    </div>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Toaster />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />

              {/* Learner shell — top bar + mobile bottom nav */}
              <Route
                element={
                  <ProtectedRoute>
                    <LearnerShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<DashboardPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/courses" element={<CoursesPage />} />
                <Route path="/courses/:id" element={<CourseDetailPage />} />
              </Route>

              {/* Viewer shell — full-bleed, slim back bar */}
              <Route
                element={
                  <ProtectedRoute>
                    <ViewerShell />
                  </ProtectedRoute>
                }
              >
                <Route path="/courses/:id/learn" element={<CourseViewerPage />} />
                <Route path="/courses/:id/learn/:lessonId" element={<CourseViewerPage />} />
              </Route>

              {/* Admin shell — sidebar + content */}
              <Route
                element={
                  <AdminRoute>
                    <AdminShell />
                  </AdminRoute>
                }
              >
                <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                <Route path="/admin/courses" element={<CoursesListPage />} />
                <Route path="/admin/courses/:id/edit" element={<CourseEditPage />} />
                <Route path="/admin/users" element={<UsersListPage />} />
                <Route path="/admin/users/new" element={<UserFormPage />} />
                <Route path="/admin/users/:id/edit" element={<UserFormPage />} />
              </Route>

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
