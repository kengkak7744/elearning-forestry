import { Navigate, useParams } from 'react-router-dom'

/**
 * Legacy route compat shim. The user create/edit UI is now a Sheet drawer
 * inside `/admin/users`. Old `/admin/users/new` and `/admin/users/:id/edit`
 * links redirect into the list view with the appropriate query param.
 */
export default function UserFormPage() {
  const { id } = useParams()
  if (id) return <Navigate to={`/admin/users?id=${id}`} replace />
  return <Navigate to="/admin/users?new=1" replace />
}
