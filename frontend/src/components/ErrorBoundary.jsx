import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    // Stay visible in dev; in production this is the place to forward
    // to an error tracker (Sentry/Bugsnag) once one is wired up.
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Render error:', error, info)
    }
  }

  handleReload = () => {
    this.setState({ hasError: false })
    window.location.reload()
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-xl shadow-sm p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-800 mb-2">เกิดข้อผิดพลาด</h1>
          <p className="text-sm text-gray-600 mb-5">
            ไม่สามารถแสดงหน้านี้ได้ กรุณาลองโหลดใหม่อีกครั้ง
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="bg-forest-500 hover:bg-forest-600 text-white px-4 py-2 rounded-lg font-medium transition min-h-[44px]"
          >
            โหลดใหม่
          </button>
        </div>
      </div>
    )
  }
}
