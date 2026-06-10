export function getYoutubeEmbed(url) {
  if (!url) return null
  const pattern =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([^?&"'>]+)/
  const match = url.match(pattern)
  if (!match) return url
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const params = new URLSearchParams({ enablejsapi: '1' })
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
