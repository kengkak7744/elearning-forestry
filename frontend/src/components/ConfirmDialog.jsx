import { useEffect, useId, useRef } from 'react'

export default function ConfirmDialog({ open, title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', onConfirm, onCancel, danger = false }) {
  const titleId = useId()
  const descId = useId()
  // For destructive actions, default focus to Cancel — the safer choice.
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel?.()
      }
    }
    document.addEventListener('keydown', handleKey)
    // Focus the safer button when the dialog opens
    const target = danger ? cancelRef.current : confirmRef.current
    target?.focus()
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, danger, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel?.() }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md"
      >
        <h3 id={titleId} className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
        <p id={descId} className="text-sm text-gray-600 mb-5 whitespace-pre-line">{message}</p>

        <div className="flex gap-3 justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition min-h-[44px]"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition min-h-[44px] ${
              danger
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-forest-500 hover:bg-forest-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
