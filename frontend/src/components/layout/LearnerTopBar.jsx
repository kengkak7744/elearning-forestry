import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Settings, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function initials(name) {
  if (!name) return 'U'
  const parts = name.trim().split(/\s+/)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

export default function LearnerTopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5 min-w-0">
          <img
            src="/elearning/forest_logo.png"
            alt=""
            width="36"
            height="36"
            fetchpriority="high"
            className="h-9 w-9 flex-shrink-0"
          />
          <div className="min-w-0 leading-tight">
            <div className="truncate text-sm font-semibold text-foreground">e-Learning</div>
            <div className="hidden text-xs text-muted-foreground sm:block">กรมป่าไม้</div>
          </div>
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-11 gap-2 px-2"
              aria-label="เมนูบัญชี"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                  {initials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline max-w-[10rem] truncate">
                {user?.full_name ?? 'บัญชีของฉัน'}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              เข้าสู่ระบบในฐานะ {user?.username}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/profile" className="cursor-pointer">
                <UserIcon className="mr-2 h-4 w-4" />
                โปรไฟล์
              </Link>
            </DropdownMenuItem>
            {(user?.role === 'admin' || user?.role === 'instructor' || user?.role === 'manager') && (
              <DropdownMenuItem asChild>
                <Link to="/admin/dashboard" className="cursor-pointer">
                  <Settings className="mr-2 h-4 w-4" />
                  จัดการระบบ
                </Link>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              ออกจากระบบ
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
