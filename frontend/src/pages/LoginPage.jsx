import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { showToast } from '@/lib/toast'
import { BUTTONS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import PasswordInput from '@/components/shared/PasswordInput'
import { toastApiError } from '@/utils/apiError'

export default function LoginPage() {
  useDocumentTitle('เข้าสู่ระบบ')

  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(identifier, password)
      showToast('เข้าสู่ระบบสำเร็จ', 'success')
      navigate(from, { replace: true })
    } catch (err) {
      toastApiError(err, 'เข้าสู่ระบบไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center text-center">
          <img
            src="/elearning/forest_logo.png"
            alt=""
            width="72"
            height="72"
            fetchPriority="high"
            className="mb-3 h-16 w-16"
          />
          <h1 className="text-2xl font-semibold text-foreground">ระบบ e-Learning</h1>
          <p className="text-sm text-muted-foreground">กรมป่าไม้</p>
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold">{BUTTONS.LOGIN}</h2>
            <p className="text-sm text-muted-foreground">กรอกข้อมูลเพื่อเข้าใช้งานระบบ</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="login-identifier">ชื่อผู้ใช้ หรือ อีเมล</Label>
                <Input
                  id="login-identifier"
                  name="username"
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  placeholder="username หรือ email@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="login-password">รหัสผ่าน</Label>
                <PasswordInput
                  id="login-password"
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                aria-busy={loading || undefined}
                className="w-full"
                size="lg"
              >
                {loading ? BUTTONS.LOGGING_IN : BUTTONS.LOGIN}
              </Button>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col gap-1 border-t border-border/60 pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              ยังไม่มีบัญชี?{' '}
              <Link to="/register" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                {BUTTONS.REGISTER}
              </Link>
            </p>
            <p className="text-xs text-muted-foreground/80">สำหรับเจ้าหน้าที่กรมป่าไม้</p>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
