import { Link } from 'react-router-dom'
import { Award, BookOpen, Building2, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Verified routes only (see App.jsx).
const ACTIONS = [
  { to: '/admin/users/new', label: 'เพิ่มผู้ใช้', icon: UserPlus },
  { to: '/admin/courses', label: 'จัดการหลักสูตร', icon: BookOpen },
  { to: '/admin/certificates', label: 'ใบรับรอง', icon: Award },
  { to: '/admin/departments', label: 'หน่วยงาน', icon: Building2 },
]

export default function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2 sm:justify-end">
      {ACTIONS.map(({ to, label, icon: Icon }) => (
        <Button key={to} asChild variant="outline" size="sm">
          <Link to={to}>
            <Icon className="mr-1.5 h-3.5 w-3.5" />
            {label}
          </Link>
        </Button>
      ))}
    </div>
  )
}
