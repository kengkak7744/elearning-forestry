import { useEffect } from 'react'

const SITE_NAME = 'e-Learning กรมป่าไม้'
const DEFAULT_TITLE = `ระบบ ${SITE_NAME}`

/**
 * Set `document.title` to "<page> — e-Learning กรมป่าไม้" while a page is mounted,
 * restoring the previous value on unmount. Makes browser tabs, bookmarks, and
 * history entries actually distinguishable instead of all saying the site name.
 *
 * Pass falsy to skip (e.g. while data is still loading and there's nothing
 * meaningful to show yet) — title stays as whatever was set before.
 */
export default function useDocumentTitle(title) {
  useEffect(() => {
    if (!title) return
    const prev = document.title
    document.title = `${title} — ${SITE_NAME}`
    return () => {
      document.title = prev
    }
  }, [title])
}

export { SITE_NAME, DEFAULT_TITLE }
