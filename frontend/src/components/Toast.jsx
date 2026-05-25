import { useEffect } from 'react'

export default function Toast({ message, type = 'success', onClose, duration = 3000 }) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onClose])

  if (!message) return null

  const styles = {
    success: 'bg-green-50 border-green-200 text-green-800',
    error: 'bg-red-50 border-red-200 text-red-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-slide-in-top">
      <div className={`border rounded-lg shadow-lg px-4 py-3 max-w-sm ${styles[type]}`}>
        <div className="flex items-start gap-3">
          <span className="font-medium text-sm flex-1">{message}</span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}