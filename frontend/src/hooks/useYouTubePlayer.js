import { useEffect, useRef } from 'react'

/**
 * Drives a YouTube embed for the current lesson WITHOUT the YT IFrame API JS.
 *
 * Why not YT.Player? `new YT.Player(node)` takes ownership of the DOM node and
 * `destroy()` removes it, which fights React's own management of the same
 * <iframe key={lesson.id}> — after switching/replaying lessons the player
 * frequently came back dead, silently killing mid-video quiz triggers. It also
 * meant the video only rendered once the iframe_api script loaded (ad-blockers
 * block it → black screen).
 *
 * Instead React fully owns the <iframe src=...> (so the video always loads),
 * and we speak YouTube's postMessage protocol directly — the same `listening`
 * handshake + `infoDelivery` events + `command` calls the API library uses
 * under the hood. The iframe src must carry enablejsapi=1 (getYoutubeEmbed
 * adds it). No external script, no DOM ownership conflict.
 *
 * Callbacks are kept fresh via a ref:
 * - getResumePosition(): seconds to seek to once ready (0 = start)
 * - onQuizCheck(tFloor): called on each time update — fire due mid-video quizzes
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
  const lastSavedRef = useRef(0)

  // Latest values pushed from infoDelivery, so the page's synchronous
  // getCurrentTime()/getDuration()/getPlayerState() calls keep working.
  const timeRef = useRef(0)
  const durationRef = useRef(0)
  const stateRef = useRef(-1)

  const cbRef = useRef({})
  useEffect(() => {
    cbRef.current = { getResumePosition, onQuizCheck, onSaveProgress }
  })

  useEffect(() => {
    if (!lesson || lesson.content_type !== 'video_youtube' || !lesson.content_url) {
      return
    }
    // NOTE: do NOT read iframeRef.current once here and bail if missing — on
    // first load currentLesson is set while the page is still showing its
    // loading screen, so the <iframe> isn't mounted yet and the effect's deps
    // won't change once it is. Read the iframe *dynamically* below instead, and
    // let the handshake retry until it appears.
    let cancelled = false
    let resumed = false
    let gotResponse = false
    let attempts = 0
    lastSavedRef.current = 0
    timeRef.current = 0
    durationRef.current = 0
    stateRef.current = -1

    const win = () => iframeRef.current?.contentWindow
    const post = (event, payload) => {
      try {
        win()?.postMessage(
          JSON.stringify({ event, id: 1, channel: 'widget', ...payload }),
          '*'
        )
      } catch {}
    }
    const sendListening = () => post('listening')
    const command = (func, args = []) => post('command', { func, args })

    // Lightweight stand-in for YT.Player so useLessonPlayback's pause/play/seek
    // and synchronous getters keep working unchanged.
    playerRef.current = {
      getCurrentTime: () => timeRef.current,
      getDuration: () => durationRef.current,
      getPlayerState: () => stateRef.current,
      pauseVideo: () => command('pauseVideo'),
      playVideo: () => command('playVideo'),
      seekTo: (s) => command('seekTo', [Number(s) || 0, true]),
    }

    const maybeResume = () => {
      if (resumed) return
      resumed = true
      const resume = cbRef.current.getResumePosition?.() || 0
      if (resume > 0) {
        command('seekTo', [resume, true])
        lastSavedRef.current = resume
      }
    }

    const handleTime = (rawTime, rawDuration) => {
      const d = Number(rawDuration)
      if (Number.isFinite(d) && d > 0) durationRef.current = d
      const t = Number(rawTime)
      if (!Number.isFinite(t)) return
      timeRef.current = t
      const tFloor = Math.floor(t)
      cbRef.current.onQuizCheck?.(tFloor)
      if (tFloor - lastSavedRef.current >= 10) {
        lastSavedRef.current = tFloor
        const dur = durationRef.current
        const isCompleted = dur > 0 && tFloor >= dur * 0.9
        cbRef.current.onSaveProgress?.(tFloor, isCompleted)
      }
    }

    const handleMessage = (event) => {
      if (cancelled) return
      // Only filter by origin (one YT player at a time). Matching on
      // event.source was dropping every message in some browsers.
      if (!String(event.origin || '').includes('youtube.com')) return
      const w = win()
      if (w && event.source && event.source !== w) return
      let data = event.data
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data)
        } catch {
          return
        }
      }
      if (!data || typeof data !== 'object') return
      gotResponse = true

      if (data.event === 'onReady') {
        maybeResume()
        return
      }
      const info = data.info
      if (!info || typeof info !== 'object') return
      // Any responsive payload means the player is alive — safe to resume-seek.
      maybeResume()
      if (info.playerState != null) stateRef.current = Number(info.playerState)
      if (info.currentTime != null) handleTime(info.currentTime, info.duration)
      // playerState 0 === ENDED — let the page run its end-of-video handler.
      if (info.playerState === 0) {
        cbRef.current.onQuizCheck?.(Math.floor(Number(info.currentTime) || timeRef.current))
      }
    }

    window.addEventListener('message', handleMessage)

    // The embed only answers after it receives `listening`, and it isn't
    // listening until its document has loaded (which may be after this effect
    // runs). Keep sending until YouTube responds — `post` reads the iframe
    // freshly each tick, so this also covers the iframe mounting late. ~60s cap.
    sendListening()
    const handshake = setInterval(() => {
      attempts += 1
      if (cancelled || gotResponse || attempts > 120) {
        clearInterval(handshake)
        return
      }
      sendListening()
    }, 500)

    return () => {
      cancelled = true
      window.removeEventListener('message', handleMessage)
      clearInterval(handshake)
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, lesson?.content_type, lesson?.content_url])

  return { iframeRef, playerRef }
}
