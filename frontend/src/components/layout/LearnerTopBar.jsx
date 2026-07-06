import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Building2, LogOut, Settings, User as UserIcon } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
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
import { initials } from '@/utils/formatting'

export default function LearnerTopBar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const canManageCourses = user?.role === 'admin' || user?.role === 'instructor'
  const manageHref = user?.role === 'instructor' ? '/admin/courses' : '/admin/dashboard'

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <Link to="/" className="flex min-h-11 min-w-0 items-center gap-2.5">
            <img
              src="/elearning/forest_logo.png"
              alt=""
              width="36"
              height="36"
              fetchPriority="high"
              className="h-9 w-9 flex-shrink-0"
            />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-foreground">e-Learning</div>
              <div className="hidden text-xs text-muted-foreground sm:block">กรมป่าไม้</div>
            </div>
          </Link>

          {/* Desktop nav — mirrors MobileBottomNav (which is md:hidden) so
              every viewport has a persistent way to reach the course catalog. */}
          <nav aria-label="เมนูหลัก" className="ml-4 hidden items-center gap-1 md:flex">
            {[
              { to: '/', label: 'หน้าหลัก', end: true },
              { to: '/courses', label: 'หลักสูตร' },
            ].map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

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
            {user?.role === 'manager' && (
              <DropdownMenuItem asChild>
                <Link to="/my-department" className="cursor-pointer">
                  <Building2 className="mr-2 h-4 w-4" />
                  หน่วยงานของฉัน
                </Link>
              </DropdownMenuItem>
            )}
            {canManageCourses && (
              <DropdownMenuItem asChild>
                <Link to={manageHref} className="cursor-pointer">
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
