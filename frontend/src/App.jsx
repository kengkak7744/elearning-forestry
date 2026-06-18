import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import AdminRoute from './components/AdminRoute'
import ErrorBoundary from './components/ErrorBoundary'
import { TOAST_EVENT } from '@/lib/toast'

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
const MyDepartmentPage = lazy(() => import('./pages/MyDepartmentPage'))

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

function AdminIndexRedirect() {
  const { user } = useAuth()
  return <Navigate to={user?.role === 'instructor' ? '/admin/courses' : '/admin/dashboard'} replace />
}

function AdminOnly({ children }) {
  return (
    <AdminRoute allowedRoles={['admin']} unauthorizedTo="/admin/courses">
      {children}
    </AdminRoute>
  )
}

function RouteSeo() {
  const location = useLocation()

  useEffect(() => {
    const baseUrl = 'https://wildfire.forest.go.th/elearning'
    const routePath = location.pathname.startsWith('/elearning')
      ? location.pathname.slice('/elearning'.length) || '/'
      : location.pathname
    const cleanPath = routePath === '/' ? '/' : routePath.replace(/\/$/, '')
    const href = `${baseUrl}${cleanPath === '/' ? '/' : cleanPath}`
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', href)
    document.querySelector('meta[property="og:url"]')?.setAttribute('content', href)
  }, [location.pathname])

  return null
}

function ToastHost() {
  const [ToasterComponent, setToasterComponent] = useState(null)
  const [queue, setQueue] = useState([])

  useEffect(() => {
    let mounted = true
    const handleToast = (event) => {
      if (event.detail?.message) {
        setQueue((prev) => [...prev, event.detail])
      }
      import('@/components/ui/sonner').then((m) => {
        if (mounted) setToasterComponent(() => m.Toaster)
      })
    }
    window.addEventListener(TOAST_EVENT, handleToast)
    return () => {
      mounted = false
      window.removeEventListener(TOAST_EVENT, handleToast)
    }
  }, [])

  useEffect(() => {
    if (!ToasterComponent || queue.length === 0) return
    const pending = queue
    const timer = setTimeout(() => {
      import('sonner').then(({ toast }) => {
        pending.forEach(({ message, type }) => {
          const variant = toast[type] ?? toast
          variant(message)
        })
        setQueue((current) => current.slice(pending.length))
      })
    }, 0)
    return () => {
      clearTimeout(timer)
    }
  }, [ToasterComponent, queue])

  return ToasterComponent ? <ToasterComponent /> : null
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <ToastHost />
        <BrowserRouter basename="/elearning">
          <RouteSeo />
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public — but bounce already-authenticated users to home so a
                  signed-in user can't re-open the login/register forms. */}
              <Route path="/login" element={<PublicOnlyRoute><LoginPage /></PublicOnlyRoute>} />
              <Route path="/register" element={<PublicOnlyRoute><RegisterPage /></PublicOnlyRoute>} />
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
                <Route path="/my-department" element={<MyDepartmentPage />} />
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
                  <AdminRoute allowedRoles={['admin', 'instructor']}>
                    <AdminShell />
                  </AdminRoute>
                }
              >
                <Route
                  path="/admin/dashboard"
                  element={
                    <AdminOnly>
                      <AdminDashboardPage />
                    </AdminOnly>
                  }
                />
                <Route path="/admin/courses" element={<CoursesListPage />} />
                <Route path="/admin/courses/:id/edit" element={<CourseEditPage />} />
                <Route path="/admin/users" element={<AdminOnly><UsersListPage /></AdminOnly>} />
                <Route path="/admin/users/new" element={<AdminOnly><UserFormPage /></AdminOnly>} />
                <Route path="/admin/users/:id/edit" element={<AdminOnly><UserFormPage /></AdminOnly>} />
                <Route path="/admin/audit-logs" element={<AdminOnly><AuditLogsPage /></AdminOnly>} />
                <Route path="/admin/certificates" element={<AdminOnly><AdminCertificatesPage /></AdminOnly>} />
                <Route path="/admin/cert-settings" element={<AdminOnly><AdminCertSettingsPage /></AdminOnly>} />
                <Route path="/admin/departments" element={<AdminOnly><AdminDepartmentsPage /></AdminOnly>} />
                <Route path="/admin/departments/:name" element={<AdminOnly><AdminDepartmentDetailPage /></AdminOnly>} />
              </Route>

              <Route
                path="/admin"
                element={
                  <AdminRoute allowedRoles={['admin', 'instructor']}>
                    <AdminIndexRedirect />
                  </AdminRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
