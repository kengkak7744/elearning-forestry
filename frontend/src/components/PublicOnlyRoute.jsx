import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Guards the pre-auth pages (login, register). If the visitor is already
 * authenticated, bounce them to the app home instead of letting them re-open
 * the form.
 *
 * While the initial session check is still running we render the children (the
 * form) rather than a spinner: a normal logged-out visitor — the common case —
 * then sees the login form instantly instead of waiting on the /me round-trip.
 * Once auth resolves, an already-signed-in user is redirected home.
 */
export default function PublicOnlyRoute({ children }) {
  const { isAuthenticated, loading } = useAuth()

  if (!loading && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return children
}
