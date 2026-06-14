import axios from 'axios'

// Detect the deployment prefix at runtime.
// - Prod (behind Traefik at /elearning): pathname starts with /elearning → use /elearning/api
// - Dev (vite at /): pathname starts with / → use /api (proxied by vite to backend)
// Exported for the handful of direct-navigation URLs (CSV/PDF downloads)
// that bypass axios so the browser sends the auth cookie itself.
export function apiPathPrefix() {
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  return path.startsWith('/elearning') ? '/elearning/api' : '/api'
}

const API_BASE = apiPathPrefix()

const apiClient = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  // Send the httpOnly auth cookie with every request.
  withCredentials: true,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Migration cleanup only. The browser app must not authenticate from
    // localStorage; httpOnly cookies are the sole session mechanism.
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
    }
    return Promise.reject(error)
  }
)

export default apiClient
