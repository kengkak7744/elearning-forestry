import { useCallback, useEffect, useRef, useState } from 'react'
import { toastApiError } from '@/utils/apiError'

/**
 * Shared fetch + loading + error-toast pattern used by the list pages.
 *
 * @param {() => Promise<any>} fetchFn  async loader; re-runs when `deps` change
 * @param {Array} deps                  dependency list that should re-trigger the fetch
 * @param {Object} [options]
 * @param {string} [options.errorFallback]  Thai toast fallback when the API gives no detail
 * @param {*}      [options.initialData]
 * @param {number} [options.debounceMs]     delay before fetching (e.g. search-as-you-type)
 * @returns {{ data, setData, loading, error, reload }}
 */
export default function useFetchData(
  fetchFn,
  deps = [],
  { errorFallback = 'โหลดข้อมูลไม่สำเร็จ', initialData = null, debounceMs = 0 } = {}
) {
  const [data, setData] = useState(initialData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Keep the latest fn without making it a dependency — callers pass inline
  // closures over their filter state. Updated in an effect (not during
  // render); this effect is declared first so it runs before the load effect.
  const fnRef = useRef(fetchFn)
  useEffect(() => {
    fnRef.current = fetchFn
  })
  // Monotonic ticket so a slow stale response never overwrites a newer one.
  const ticketRef = useRef(0)

  const load = useCallback(async () => {
    const ticket = ++ticketRef.current
    setLoading(true)
    try {
      const result = await fnRef.current()
      if (ticket === ticketRef.current) {
        setData(result)
        setError(null)
      }
      return result
    } catch (err) {
      if (ticket === ticketRef.current) {
        setError(err)
        toastApiError(err, errorFallback)
      }
    } finally {
      if (ticket === ticketRef.current) setLoading(false)
    }
  }, [errorFallback])

  useEffect(() => {
    // Always defer through setTimeout — a 0ms delay is imperceptible (the
    // initial `loading` state is already true) and keeps the debounced and
    // immediate paths identical.
    const t = setTimeout(load, debounceMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, debounceMs, ...deps])

  return { data, setData, loading, error, reload: load }
}
