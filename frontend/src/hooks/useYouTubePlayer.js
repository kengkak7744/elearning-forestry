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
    lastSavedRef.current = 0
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

              if (pollRef.current) clearInterval(pollRef.current)
              pollRef.current = setInterval(() => {
                if (!playerRef.current?.getCurrentTime) return
                let t = 0
                try {
                  t = playerRef.current.getCurrentTime()
                } catch {
                  return
                }
                const tFloor = Math.floor(t)
                cbRef.current.onQuizCheck?.(tFloor)
                if (tFloor - lastSavedRef.current >= 10) {
                  lastSavedRef.current = tFloor
                  let duration = 0
                  try {
                    duration = playerRef.current.getDuration() || 0
                  } catch {}
                  const isCompleted = duration > 0 && tFloor >= duration * 0.9
                  cbRef.current.onSaveProgress?.(tFloor, isCompleted)
                }
              }, 2000)
            },
          },
        })
      } catch {}
    })

    return () => {
      cancelled = true
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
