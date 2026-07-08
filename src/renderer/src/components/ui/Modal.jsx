import React, { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({ isOpen, onClose, title, children }) {
  // Close on ESC keypress
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border-[3px] border-slate-900 bg-white shadow-2xl transition-all flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-slate-900 bg-slate-50 p-4 shrink-0">
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="border-2 border-slate-900 bg-white hover:bg-slate-100 text-slate-900 p-1 rounded-none shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] active:scale-95 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-6 flex-1">{children}</div>
      </div>
    </div>
  )
}
