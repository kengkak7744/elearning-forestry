import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

/**
 * The repeated "stack of skeleton rows" loading state used by every admin list.
 *
 * @param {number} [props.count=5]
 * @param {string} [props.className='h-16']  per-row classes (height/radius)
 */
export default function SkeletonRows({ count = 5, className = 'h-16' }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={cn('w-full rounded-lg', className)} />
      ))}
    </div>
  )
}
