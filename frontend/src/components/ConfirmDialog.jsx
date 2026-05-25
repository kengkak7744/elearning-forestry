export default function ConfirmDialog({ open, title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก', onConfirm, onCancel, danger = false }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-5 whitespace-pre-line">{message}</p>
        
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 text-white rounded-lg text-sm font-medium transition ${
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