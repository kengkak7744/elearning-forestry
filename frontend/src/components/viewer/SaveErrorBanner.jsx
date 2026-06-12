import { AlertTriangle, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Amber banner shown under the header after 2+ consecutive progress-save
 * failures (the spotty-connection persona). "ลองใหม่" retries the last save;
 * the next successful save clears the banner from the page. Dismissible.
 */
export default function SaveErrorBanner({ onRetry, onDismiss }) {
  return (
    <div role="alert" className="border-b border-warning/30 bg-warning/10">
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-2 sm:px-4">
        <AlertTriangle className="h-4 w-4 flex-shrink-0 text-warning" />
        <span className="min-w-0 flex-1 text-xs text-foreground">
          การบันทึกความคืบหน้าขัดข้อง — ตรวจสอบการเชื่อมต่อ
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-shrink-0 border-warning/40"
          onClick={onRetry}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          ลองใหม่
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 flex-shrink-0"
          onClick={onDismiss}
          aria-label="ปิด"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
