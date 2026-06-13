import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute from './components/AdminRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { Toaster } from '@/components/ui/sonner'

// LoginPage is the universal entry point — keep eager. The shells and every
// other page are lazy so the pre-auth login screen doesn't pay for the top
// bar / admin sidebar / mobile nav (and their Radix + icon deps) it never
// renders.
import LoginPage from './pages/LoginPage'

// Shells pull in the top bar, admin sidebar, mobile nav and their Radix
// overlay primitives — none of which the login screen needs. Lazy-loading
// them keeps that weight off first paint; the chunk loads once after auth and
// stays mounted across child-route navigations.
const LearnerShell = lazy(() =>
  import('@/components/layout/AppShell').then((m) => ({ default: m.LearnerShell }))
)
const ViewerShell = lazy(() =>
  import('@/components/layout/AppShell').then((m) => ({ default: m.ViewerShell }))
)
const AdminShell = lazy(() =>
  import('@/components/layout/AppShell').then((m) => ({ default: m.AdminShell }))
)

// Heavier pages are lazy-loaded.
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
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
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage'))
const AdminCertificatesPage = lazy(() => import('./pages/admin/AdminCertificatesPage'))
const AdminCertSettingsPage = lazy(() => import('./pages/admin/AdminCertSettingsPage'))
const AdminDepartmentsPage = lazy(() => import('./pages/admin/AdminDepartmentsPage'))
const AdminDepartmentDetailPage = lazy(() => import('./pages/admin/AdminDepartmentDetailPage'))
const CertificateVerifyPage = lazy(() => import('./pages/CertificateVerifyPage'))

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
        <BrowserRouter basename="/elearning">
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              {/* Public certificate verification — no auth, deliberately
                  outside the LearnerShell so third parties / HR staff at other
                  agencies can scan the QR on a printed cert and land here
                  without being prompted to log in. */}
              <Route path="/verify" element={<CertificateVerifyPage />} />
              <Route path="/verify/:certNumber" element={<CertificateVerifyPage />} />

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
                <Route path="/admin/audit-logs" element={<AuditLogsPage />} />
                <Route path="/admin/certificates" element={<AdminCertificatesPage />} />
                <Route path="/admin/cert-settings" element={<AdminCertSettingsPage />} />
                <Route path="/admin/departments" element={<AdminDepartmentsPage />} />
                <Route path="/admin/departments/:name" element={<AdminDepartmentDetailPage />} />
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
