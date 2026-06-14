import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export default function AdminRoute({ children, allowedRoles = ['admin'], unauthorizedTo = '/' }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground"
      >
        กำลังโหลด...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // Non-admins: just redirect to home. The previous "ไม่มีสิทธิ์" card never
  // actually displayed because <Navigate> renders fired immediately — the card
  // markup was unreachable. Home shows the proper learner UI; if a non-admin
  // landed here it's a wrong-URL situation, not something to celebrate with a
  // warning card.
  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to={unauthorizedTo} replace />
  }

  return children
}
