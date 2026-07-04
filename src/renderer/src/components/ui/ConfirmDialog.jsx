import React, { useEffect } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

export default function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm', 
  cancelText = 'Cancel',
  type = 'danger' 
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const isDanger = type === 'danger'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Container */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border-[3px] border-slate-900 bg-white p-5 shadow-2xl transition-all">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`rounded-full border-2 border-slate-900 p-2.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${isDanger ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'}`}>
            {isDanger ? <AlertTriangle size={20} /> : <Info size={20} />}
          </div>

          {/* Details */}
          <div className="flex-1">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800">{title}</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-500">{message}</p>
          </div>
        </div>

        {/* Buttons */}
        <div className="mt-6 flex justify-end gap-3 pb-1 pr-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-none border-2 border-slate-900 px-4 py-1.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm()
              onClose()
            }}
            className={`rounded-none border-2 border-slate-900 px-4 py-1.5 text-xs font-extrabold uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all ${
              isDanger 
                ? 'bg-red-500 text-white hover:bg-red-600' 
                : 'bg-sky-500 text-slate-950 hover:bg-sky-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
