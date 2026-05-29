import { Navigate } from 'react-router-dom'
import { Ban } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent } from '@/components/ui/card'

export default function AdminRoute({ children }) {
  const { user, loading, isAuthenticated } = useAuth()

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        กำลังโหลด...
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (user?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="max-w-md border-border/60">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Ban className="h-7 w-7" />
            </div>
            <h1 className="text-xl font-semibold text-foreground">ไม่มีสิทธิ์เข้าถึง</h1>
            <p className="text-sm text-muted-foreground">
              หน้านี้สำหรับผู้ดูแลระบบเท่านั้น
            </p>
            <Navigate to="/" replace />
          </CardContent>
        </Card>
      </div>
    )
  }

  return children
}
