const YT_ID_PATTERN =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^?&"'>]+)/

export function extractYoutubeId(url) {
  if (!url) return null
  const match = url.match(YT_ID_PATTERN)
  return match ? match[1] : null
}

export function getYoutubeEmbed(url) {
  if (!url) return null
  const match = url.match(YT_ID_PATTERN)
  if (!match) return url
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({
    enablejsapi: '1',
    cc_load_policy: '1',
    cc_lang_pref: 'th',
  })
  if (origin) params.set('origin', origin)
  return `https://www.youtube.com/embed/${match[1]}?${params.toString()}`
}

export function loadYTApi() {
  return new Promise((resolve) => {
    if (window.YT && window.YT.Player) {
      resolve(window.YT)
      return
    }
    const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
    if (!existingScript) {
      const tag = document.createElement('script')
      tag.src = 'https://www.youtube.com/iframe_api'
      document.body.appendChild(tag)
    }
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      if (typeof prev === 'function') prev()
      resolve(window.YT)
    }
    const poll = setInterval(() => {
      if (window.YT && window.YT.Player) {
        clearInterval(poll)
        resolve(window.YT)
      }
    }, 200)
  })
}

/**
 * Resolve a YouTube video's duration (seconds) via a hidden muted player —
 * no API key needed. Resolves null when the URL is invalid, the video is
 * unavailable, or no duration arrives within the timeout.
 */
export async function fetchYoutubeDuration(url, timeoutMs = 10000) {
  const videoId = extractYoutubeId(url)
  if (!videoId) return null
  const YT = await loadYTApi()
  return new Promise((resolve) => {
    const host = document.createElement('div')
    host.style.cssText =
      'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden'
    document.body.appendChild(host)

    let player = null
    let settled = false
    const finish = (seconds) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try {
        player?.destroy()
      } catch {
        // player never initialised — nothing to tear down
      }
      host.remove()
      resolve(seconds)
    }
    const timer = setTimeout(() => finish(null), timeoutMs)
    const report = (target) => {
      const duration = target?.getDuration?.()
      if (duration > 0) finish(Math.round(duration))
    }

    player = new YT.Player(host, {
      width: 1,
      height: 1,
      videoId,
      playerVars: { mute: 1 },
      events: {
        // getDuration() can return 0 until metadata loads — a muted play
        // nudges it, then onStateChange picks the value up.
        onReady: (e) => {
          report(e.target)
          if (!settled) {
            e.target.mute()
            e.target.playVideo()
          }
        },
        onStateChange: (e) => report(e.target),
        onError: () => finish(null),
      },
    })
  })
}
