import { useEffect, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Award,
  Building2,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  ScrollText,
  Settings,
  Users,
  ArrowLeft,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

const groups = [
  {
    label: 'ภาพรวม',
    items: [{ to: '/admin/dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard }],
  },
  {
    label: 'เนื้อหา',
    items: [{ to: '/admin/courses', label: 'จัดการหลักสูตร', icon: GraduationCap }],
  },
  {
    label: 'ผู้ใช้',
    items: [
      { to: '/admin/users', label: 'จัดการผู้ใช้', icon: Users },
      { to: '/admin/departments', label: 'หน่วยงาน', icon: Building2 },
    ],
  },
  {
    label: 'ตรวจสอบ',
    items: [
      { to: '/admin/audit-logs', label: 'บันทึกการเปลี่ยนแปลง', icon: ScrollText },
      { to: '/admin/certificates', label: 'ใบรับรองทั้งหมด', icon: Award },
      { to: '/admin/cert-settings', label: 'ตั้งค่าใบรับรอง', icon: Settings },
    ],
  },
]

const STORAGE_KEY = 'admin.sidebar.collapsed'

const routeRoles = {
  '/admin/dashboard': ['admin'],
  '/admin/courses': ['admin', 'instructor'],
  '/admin/users': ['admin'],
  '/admin/departments': ['admin'],
  '/admin/audit-logs': ['admin'],
  '/admin/certificates': ['admin'],
  '/admin/cert-settings': ['admin'],
}

export default function AdminSidebar({ onNavigate }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const adminHome = user?.role === 'instructor' ? '/admin/courses' : '/admin/dashboard'
  const visibleGroups = groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => (routeRoles[item.to] ?? ['admin']).includes(user?.role)),
    }))
    .filter((group) => group.items.length > 0)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem(STORAGE_KEY) === 'true'
  })

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed))
  }, [collapsed])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const handleClickItem = () => onNavigate?.()

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-background border-r border-border transition-[width] duration-200',
        collapsed ? 'w-16' : 'w-60'
      )}
      aria-label="เมนูจัดการระบบ"
    >
      <div className="flex h-16 items-center gap-2 px-3 border-b border-border">
        <Link to={adminHome} onClick={handleClickItem} className="flex min-w-0 flex-1 items-center gap-2.5">
          <img
            src="/elearning/forest_logo.png"
            alt=""
            width="36"
            height="36"
            className="h-9 w-9 flex-shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-semibold text-foreground">จัดการระบบ</div>
              <div className="truncate text-xs text-muted-foreground">e-Learning</div>
            </div>
          )}
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="hidden h-8 w-8 lg:inline-flex"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'ขยายเมนู' : 'ย่อเมนู'}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && user && (
        <div className="px-4 py-3 border-b border-border">
          <div className="text-xs text-muted-foreground">เข้าสู่ระบบในฐานะ</div>
          <div className="truncate text-sm font-medium text-foreground">{user.full_name}</div>
          <div className="text-xs text-primary">
            {user.role === 'admin' ? 'ผู้ดูแลระบบ' : user.role === 'instructor' ? 'ผู้สอน' : user.role === 'manager' ? 'ผู้จัดการ' : 'ผู้ใช้'}
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-2">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-4">
            {!collapsed && (
              <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {group.label}
              </div>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    onClick={handleClickItem}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors',
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground/80 hover:bg-muted hover:text-foreground'
                      )
                    }
                    title={collapsed ? label : undefined}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                    {!collapsed && <span className="truncate">{label}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <Separator />
      <div className="p-2 space-y-0.5">
        <Link
          to="/"
          onClick={handleClickItem}
          className="flex items-center gap-3 rounded-md px-2.5 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground"
          title={collapsed ? 'กลับสู่หน้าผู้เรียน' : undefined}
        >
          <ArrowLeft className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span>กลับสู่หน้าผู้เรียน</span>}
        </Link>
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground"
          title={collapsed ? 'ออกจากระบบ' : undefined}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
          {!collapsed && <span>ออกจากระบบ</span>}
        </button>
      </div>
    </aside>
  )
}
