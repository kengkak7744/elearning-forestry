import CourseCard from '@/components/learner/CourseCard'
import CourseRail from '@/components/dashboard/CourseRail'

/**
 * Horizontal rail of saved courses (max 8). Renders nothing while loading
 * (`items === null`) or when empty — no placeholder. Removing a bookmark is
 * handled by the parent via `onToggle` (optimistic, like BookmarksTab).
 */
export default function BookmarksShelf({ items, onToggle }) {
  if (!items || items.length === 0) return null

  return (
    <CourseRail title="บันทึกไว้ดูภายหลัง">
      {items.slice(0, 8).map((c) => (
        <CourseCard
          key={c.id}
          course={c}
          variant="compact"
          bookmarked
          onToggleBookmark={() => onToggle(c)}
        />
      ))}
    </CourseRail>
  )
}
