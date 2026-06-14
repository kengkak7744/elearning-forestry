import { useEffect, useRef } from 'react'
import { loadYTApi } from '@/utils/youtube'

/**
 * Owns the YouTube IFrame player lifecycle for a lesson: creates the player
 * when the lesson is a YouTube video, seeks to the resume position on ready,
 * polls every 2s, and tears everything down on lesson change/unmount.
 *
 * Callbacks are kept fresh via a ref (same effect as the original page-level
 * refs), so they may close over current render state safely:
 * - getResumePosition(): seconds to seek to on ready (0 = start)
 * - onQuizCheck(tFloor): called every tick — fire due mid-video quizzes
 * - onSaveProgress(tFloor, isCompleted): called on the 10s save cadence
 */
export default function useYouTubePlayer({
  lesson,
  getResumePosition,
  onQuizCheck,
  onSaveProgress,
}) {
  const iframeRef = useRef(null)
  const playerRef = useRef(null)
  const pollRef = useRef(null)
  const lastSavedRef = useRef(0)

  const cbRef = useRef({})
  useEffect(() => {
    cbRef.current = { getResumePosition, onQuizCheck, onSaveProgress }
  })

  useEffect(() => {
    if (!lesson || lesson.content_type !== 'video_youtube' || !lesson.content_url) {
      return
    }

    let cancelled = false
    let fallbackTimer = null
    lastSavedRef.current = 0

    const handlePlayerTime = (time, durationHint = 0) => {
      if (cancelled) return
      const numericTime = Number(time)
      if (!Number.isFinite(numericTime)) return
      const tFloor = Math.floor(numericTime)
      cbRef.current.onQuizCheck?.(tFloor)
      if (tFloor - lastSavedRef.current >= 10) {
        lastSavedRef.current = tFloor
        let duration = Number(durationHint) || 0
        if (!duration && playerRef.current?.getDuration) {
          try {
            duration = playerRef.current.getDuration() || 0
          } catch {}
        }
        const isCompleted = duration > 0 && tFloor >= duration * 0.9
        cbRef.current.onSaveProgress?.(tFloor, isCompleted)
      }
    }

    const pollPlayer = () => {
      if (cancelled || !playerRef.current?.getCurrentTime) return
      try {
        handlePlayerTime(playerRef.current.getCurrentTime())
      } catch {}
    }

    const startPolling = () => {
      if (cancelled || pollRef.current) return
      pollPlayer()
      pollRef.current = setInterval(pollPlayer, 1000)
    }

    const handleMessage = (event) => {
      if (cancelled) return
      if (iframeRef.current?.contentWindow && event.source !== iframeRef.current.contentWindow) {
        return
      }
      if (!String(event.origin || '').includes('youtube.com')) return
      let data = event.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch {
          return
        }
      }
      const info = data?.info
      if (data?.event !== 'infoDelivery' || !info) return
      if (info.currentTime != null) {
        handlePlayerTime(info.currentTime, info.duration)
      }
      if (info.playerState === 0) {
        cbRef.current.onQuizCheck?.(Math.floor(Number(info.currentTime) || 0))
      }
    }

    window.addEventListener('message', handleMessage)

    loadYTApi().then((YT) => {
      if (cancelled || !iframeRef.current) return
      try {
        playerRef.current = new YT.Player(iframeRef.current, {
          events: {
            onReady: () => {
              const resume = cbRef.current.getResumePosition?.() || 0
              if (resume > 0) {
                try {
                  playerRef.current.seekTo(resume, true)
                } catch {}
                lastSavedRef.current = resume
              }
              startPolling()
            },
            onStateChange: () => {
              startPolling()
            },
          },
        })
        // Some embedded YouTube iframes occasionally miss the API onReady
        // callback. Start a guarded poll anyway; it no-ops until the player can
        // report currentTime, then mid-video quizzes become deterministic.
        fallbackTimer = setTimeout(startPolling, 1000)
      } catch {}
    })

    return () => {
      cancelled = true
      window.removeEventListener('message', handleMessage)
      if (fallbackTimer) clearTimeout(fallbackTimer)
      if (pollRef.current) {
        clearInterval(pollRef.current)
        pollRef.current = null
      }
      if (playerRef.current) {
        try {
          playerRef.current.destroy()
        } catch {}
        playerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, lesson?.content_type, lesson?.content_url])

  return { iframeRef, playerRef }
}
