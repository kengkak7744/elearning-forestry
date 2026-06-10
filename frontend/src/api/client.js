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

// Legacy fallback: if a previous session stored a JWT in localStorage, still send it via Authorization.
// New logins use httpOnly cookies and don't write to localStorage.
apiClient.interceptors.request.use((config) => {
  const legacy = localStorage.getItem('access_token')
  if (legacy) {
    config.headers.Authorization = `Bearer ${legacy}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token')
    }
    return Promise.reject(error)
  }
)

export default apiClient
