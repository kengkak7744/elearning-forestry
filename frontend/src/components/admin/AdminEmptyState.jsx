import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

/**
 * Consistent empty state for admin lists — a dashed card with an optional
 * centered icon and a message. Replaces the divergent one-off dashed cards.
 *
 * @param {React.ComponentType} [props.icon]
 * @param {React.ReactNode} props.children  the message
 */
export default function AdminEmptyState({ icon: Icon, children, className }) {
  return (
    <Card className={cn('border-dashed border-border/60', className)}>
      <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
        {Icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground/70">
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="text-sm text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  )
}
