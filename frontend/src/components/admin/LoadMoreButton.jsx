import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Centered "โหลดเพิ่มเติม" button for the list pages' load-more pagination.
 *
 * @param {() => void} props.onClick
 * @param {boolean} [props.loading]
 */
export default function LoadMoreButton({ onClick, loading = false, className }) {
  return (
    <div className={cn('mt-4 flex justify-center', className)}>
      <Button variant="outline" onClick={onClick} disabled={loading}>
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {loading ? 'กำลังโหลด...' : 'โหลดเพิ่มเติม'}
      </Button>
    </div>
  )
}
