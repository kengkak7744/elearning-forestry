import { ROLE_LABELS } from '@/constants/labels'

const ROLE_TONE = {
  admin: 'bg-destructive/15 text-destructive',
  instructor: 'bg-primary/15 text-primary',
  manager: 'bg-warning/20 text-warning',
  learner: 'bg-muted text-muted-foreground',
}

export default function RoleChip({ role, count }) {
  const label = ROLE_LABELS[role] || role
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
        ROLE_TONE[role] ?? 'bg-muted text-muted-foreground'
      }`}
    >
      {label}
      {count != null && (
        <span className="font-semibold tabular-nums">{count}</span>
      )}
    </span>
  )
}
