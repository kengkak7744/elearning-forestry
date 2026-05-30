import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import LearnerTopBar from './LearnerTopBar'
import MobileBottomNav from './MobileBottomNav'
import AdminSidebar from './AdminSidebar'

function SkipLink() {
  return (
    <a href="#main-content" className="skip-link">
      ข้ามไปยังเนื้อหาหลัก
    </a>
  )
}

export function LearnerShell() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SkipLink />
      <LearnerTopBar />
      <main id="main-content" tabIndex={-1} className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>
      <MobileBottomNav />
    </div>
  )
}

export function ViewerShell() {
  return (
    <div className="min-h-screen bg-background">
      <SkipLink />
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}

export function AdminShell() {
  const { user } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      <SkipLink />
      {/* Desktop sidebar — sticky to viewport so footer (back/logout) is always
          visible regardless of main-content scroll. */}
      <div className="hidden h-screen flex-shrink-0 lg:flex">
        <AdminSidebar />
      </div>

      <div className="flex h-screen min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <div className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-background/95 px-3 lg:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="เปิดเมนู">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>เมนูจัดการระบบ</SheetTitle>
              </SheetHeader>
              <AdminSidebar onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold text-foreground">จัดการระบบ</span>
          {user && (
            <span className="ml-auto max-w-[8rem] truncate text-xs text-muted-foreground">
              {user.full_name}
            </span>
          )}
        </div>

        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
