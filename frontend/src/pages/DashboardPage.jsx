import { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { certificatesApi } from '@/api/certificates'
import { coursesApi } from '@/api/courses'
import { BUTTONS } from '@/constants/labels'
import useDocumentTitle from '@/hooks/useDocumentTitle'
import CourseCard from '@/components/learner/CourseCard'
import DashboardGreeting from '@/components/dashboard/DashboardGreeting'
import ActionNeededPanel from '@/components/dashboard/ActionNeededPanel'
import ResumeHeroCard from '@/components/dashboard/ResumeHeroCard'
import DashboardStats from '@/components/dashboard/DashboardStats'
import CourseRail from '@/components/dashboard/CourseRail'
import BookmarksShelf from '@/components/dashboard/BookmarksShelf'
import CertificatesSection from '@/components/dashboard/CertificatesSection'

const progressOf = (e) => e?.progress_percent ?? 0

// Hero = the in-progress enrollment the learner touched most recently
// (fallback: most recently enrolled). Derived here so the page can also drop it
// from the "my courses" rail and hand it to ResumeHeroCard.
function pickHero(inProgress) {
  if (inProgress.length === 0) return null
  return [...inProgress].sort((a, b) => {
    const lb = b.last_accessed_at ? new Date(b.last_accessed_at).getTime() : 0
    const la = a.last_accessed_at ? new Date(a.last_accessed_at).getTime() : 0
    if (lb !== la) return lb - la
    const eb = b.enrolled_at ? new Date(b.enrolled_at).getTime() : 0
    const ea = a.enrolled_at ? new Date(a.enrolled_at).getTime() : 0
    return eb - ea
  })[0]
}

export default function DashboardPage() {
  useDocumentTitle('หน้าหลัก')
  const { user } = useAuth()
  const [enrollments, setEnrollments] = useState(null)
  const [certs, setCerts] = useState(null)
  const [mandatory, setMandatory] = useState(null)
  const [bookmarks, setBookmarks] = useState(null)

  // Four parallel list fetches, each isolated: one failure degrades only its
  // own section. Hero adds at most three more, scoped to one course. Nothing
  // here scales with the number of enrollments.
  useEffect(() => {
    coursesApi.myEnrollments().then(setEnrollments).catch(() => setEnrollments([]))
    certificatesApi.mine().then(setCerts).catch(() => setCerts([]))
    coursesApi.list({ is_mandatory: true }).then(setMandatory).catch(() => setMandatory([]))
    coursesApi.myBookmarks().then(setBookmarks).catch(() => setBookmarks([]))
  }, [])

  const enrollmentList = Array.isArray(enrollments) ? enrollments : []
  const certList = Array.isArray(certs) ? certs : []
  const inProgress = enrollmentList.filter((e) => progressOf(e) < 100)
  const completed = enrollmentList.filter((e) => progressOf(e) >= 100)
  const hero = pickHero(inProgress)

  // Bookmarks state is shared by the shelf and the explore rail's toggles.
  const bookmarkList = Array.isArray(bookmarks) ? bookmarks : []
  const bookmarkedIds = new Set(bookmarkList.map((c) => c.id))
  const reloadBookmarks = () =>
    coursesApi.myBookmarks().then(setBookmarks).catch(() => setBookmarks([]))
  const toggleBookmark = async (course) => {
    const isBookmarked = bookmarkedIds.has(course.id)
    // Optimistic; revert by re-fetching truth on failure (cf. BookmarksTab).
    setBookmarks((prev) => {
      const list = prev ?? []
      return isBookmarked ? list.filter((c) => c.id !== course.id) : [course, ...list]
    })
    try {
      if (isBookmarked) await coursesApi.unbookmark(course.id)
      else await coursesApi.bookmark(course.id)
    } catch {
      reloadBookmarks()
    }
  }

  // My courses — in-progress first, then completed, minus the hero (it has the
  // top card). Capped at 8. (No "explore other courses" rail here — the home
  // page stays focused on the user's own learning; the catalog lives at
  // /courses via the nav.)
  const myCourses = [...inProgress, ...completed]
    .filter((e) => e.course_id !== hero?.course_id)
    .slice(0, 8)

  const certCount = certs === null ? null : certList.filter((c) => !c.is_revoked).length

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      <DashboardGreeting user={user} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:order-2">
          <ActionNeededPanel enrollments={enrollments} certs={certs} mandatory={mandatory} />
        </div>
        <div className="lg:order-1 lg:col-span-2">
          <ResumeHeroCard enrollments={enrollments} hero={hero} />
        </div>
      </div>

      <div className="mt-6">
        <DashboardStats
          inProgress={enrollments === null ? null : inProgress.length}
          completed={enrollments === null ? null : completed.length}
          certificates={certCount}
        />
      </div>

      <BookmarksShelf items={bookmarks} onToggle={toggleBookmark} />

      {myCourses.length > 0 && (
        <CourseRail title="หลักสูตรของฉัน" viewAllTo="/profile" viewAllLabel={BUTTONS.VIEW_ALL}>
          {myCourses.map((e) => (
            <CourseCard
              key={e.course_id}
              course={{
                id: e.course_id,
                title: e.title,
                cover_image: e.cover_image,
                category: e.category,
                is_mandatory: e.is_mandatory,
              }}
              variant="compact"
              progress={progressOf(e)}
            />
          ))}
        </CourseRail>
      )}

      <CertificatesSection certs={certs} />
    </div>
  )
}
