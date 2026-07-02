import { useEffect, useSyncExternalStore } from 'react'
import { categoriesApi } from '@/api/categories'
import { CATEGORY_BADGES } from '@/constants/labels'

// Module-level store: every badge/filter/select on a page shares one fetch.
// Until the fetch resolves (or if it fails) we serve the four built-in
// categories from CATEGORY_BADGES so labels never flash empty.
const FALLBACK = Object.entries(CATEGORY_BADGES).map(([value, { label }]) => ({
  value,
  label,
}))

let cache = null
let loading = false
const listeners = new Set()

const emit = () => listeners.forEach((fn) => fn())
const subscribe = (fn) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const getSnapshot = () => cache ?? FALLBACK

function ensureLoaded() {
  if (cache || loading) return
  loading = true
  categoriesApi
    .list()
    .then((data) => {
      cache = data
      emit()
    })
    .catch(() => {}) // keep FALLBACK; a later mount retries
    .finally(() => {
      loading = false
    })
}

/** Refetch after add/remove so every mounted consumer updates at once. */
export async function refreshCategories() {
  cache = await categoriesApi.list()
  emit()
  return cache
}

/** Reactive list of course categories: [{ value, label, course_count? }]. */
export function useCategories() {
  const categories = useSyncExternalStore(subscribe, getSnapshot)
  useEffect(() => {
    ensureLoaded()
  }, [])
  return categories
}

/** Display label for a category value; falls back to the raw value (new
 * categories store the Thai name as their value, so this reads fine). */
export function categoryLabel(categories, value) {
  if (!value) return null
  return (
    categories.find((c) => c.value === value)?.label ??
    CATEGORY_BADGES[value]?.label ??
    value
  )
}
