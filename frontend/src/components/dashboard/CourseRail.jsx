import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Shared horizontal-scroll section used by the "my courses" and "explore"
 * rails. Presentational only — the caller supplies the CourseCard children.
 */
export default function CourseRail({ title, viewAllTo, viewAllLabel, children }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        {viewAllTo && (
          <Button asChild variant="ghost" size="sm">
            <Link to={viewAllTo}>
              {viewAllLabel}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
      <div className="-mx-4 overflow-x-auto px-4 pb-2">
        <div className="flex gap-4">{children}</div>
      </div>
    </section>
  )
}
